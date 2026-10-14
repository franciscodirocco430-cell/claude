import {
  MailProviderError,
  type MailboxRef,
  type MailProvider,
  type SendResult,
  type ThreadMessage,
} from "./provider";
import { toBase64Url } from "./mime";

interface GmailHeader {
  name: string;
  value: string;
}
interface GmailPart {
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { data?: string };
  parts?: GmailPart[];
}
interface GmailMessage {
  id: string;
  threadId: string;
  internalDate?: string;
  payload?: GmailPart;
}

const header = (part: GmailPart | undefined, name: string) =>
  part?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;

function findText(part: GmailPart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  }
  for (const child of part.parts ?? []) {
    const text = findText(child);
    if (text) return text;
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url")
      .toString("utf8")
      .replace(/<[^>]+>/g, " ");
  }
  return "";
}

export function parseGmailMessage(m: GmailMessage): ThreadMessage {
  const from = header(m.payload, "From") ?? "";
  const contentType = header(m.payload, "Content-Type") ?? m.payload?.mimeType ?? "";
  const autoSubmitted = header(m.payload, "Auto-Submitted");
  return {
    id: m.id,
    from,
    date: new Date(Number(m.internalDate ?? Date.now())),
    rfcMessageId: header(m.payload, "Message-ID") ?? header(m.payload, "Message-Id"),
    subject: header(m.payload, "Subject"),
    autoSubmitted:
      (!!autoSubmitted && autoSubmitted.toLowerCase() !== "no") ||
      !!header(m.payload, "X-Autoreply") ||
      !!header(m.payload, "X-Autorespond"),
    isBounce:
      /mailer-daemon|postmaster/i.test(from) ||
      /multipart\/report.*delivery-status/i.test(contentType),
    text: findText(m.payload),
  };
}

/** Gmail por su API REST oficial. El token lo provee `getAccessToken` (con refresco). */
export class GmailProvider implements MailProvider {
  constructor(
    private readonly apiUrl: string,
    private readonly getAccessToken: (mailbox: MailboxRef) => Promise<string>,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call<T>(mailbox: MailboxRef, path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken(mailbox);
    const res = await this.fetchImpl(`${this.apiUrl}/users/me${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...init.headers,
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) return (await res.json()) as T;
    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403)
      throw new MailProviderError("auth", `Gmail rechazó el acceso (${res.status}).`);
    if (res.status === 429)
      throw new MailProviderError("rate_limit", "Gmail limitó los envíos (429).");
    if (res.status >= 500)
      throw new MailProviderError("transient", `Gmail no disponible (${res.status}).`);
    if (res.status === 400 && /recipient|address|invalid to/i.test(body)) {
      throw new MailProviderError("invalid_recipient", "Gmail rechazó el destinatario.");
    }
    throw new MailProviderError("other", `Error de Gmail (${res.status}).`);
  }

  async send(
    mailbox: MailboxRef,
    input: { raw: string; threadId?: string | null },
  ): Promise<SendResult> {
    const sent = await this.call<{ id: string; threadId: string }>(mailbox, "/messages/send", {
      method: "POST",
      body: JSON.stringify({
        raw: toBase64Url(input.raw),
        ...(input.threadId ? { threadId: input.threadId } : {}),
      }),
    });
    let rfcMessageId: string | null = null;
    try {
      const meta = await this.call<GmailMessage>(
        mailbox,
        `/messages/${encodeURIComponent(sent.id)}?format=metadata&metadataHeaders=Message-ID`,
      );
      rfcMessageId = header(meta.payload, "Message-ID");
    } catch {
      // Sin Message-ID igual se puede responder por threadId.
    }
    return { messageId: sent.id, threadId: sent.threadId, rfcMessageId };
  }

  async getThread(mailbox: MailboxRef, threadId: string): Promise<ThreadMessage[]> {
    const thread = await this.call<{ messages?: GmailMessage[] }>(
      mailbox,
      `/threads/${encodeURIComponent(threadId)}?format=full`,
    );
    return (thread.messages ?? []).map(parseGmailMessage);
  }
}

/** Proveedor en memoria para tests: registra envíos y permite simular respuestas. */
export class FakeMailProvider implements MailProvider {
  sent: { mailbox: MailboxRef; raw: string; threadId: string }[] = [];
  threads = new Map<string, ThreadMessage[]>();
  failNext: MailProviderError | null = null;
  private seq = 0;
  // Prefijo aleatorio: los ids no se repiten entre instancias (como en Gmail).
  private readonly prefix = Math.random().toString(36).slice(2, 8);

  async send(
    mailbox: MailboxRef,
    input: { raw: string; threadId?: string | null },
  ): Promise<SendResult> {
    if (this.failNext) {
      const e = this.failNext;
      this.failNext = null;
      throw e;
    }
    const id = `msg-${this.prefix}-${++this.seq}`;
    const threadId = input.threadId ?? `thread-${this.prefix}-${this.seq}`;
    const rfc = `<${id}@fake.mail>`;
    this.sent.push({ mailbox, raw: input.raw, threadId });
    const list = this.threads.get(threadId) ?? [];
    list.push({
      id,
      from: mailbox.email,
      date: new Date(),
      rfcMessageId: rfc,
      subject: null,
      autoSubmitted: false,
      isBounce: false,
      text: "",
    });
    this.threads.set(threadId, list);
    return { messageId: id, threadId, rfcMessageId: rfc };
  }

  async getThread(_mailbox: MailboxRef, threadId: string) {
    return this.threads.get(threadId) ?? [];
  }

  addReply(threadId: string, msg: Partial<ThreadMessage> & { from: string; text: string }) {
    const list = this.threads.get(threadId) ?? [];
    list.push({
      id: `reply-${this.prefix}-${++this.seq}`,
      date: new Date(),
      rfcMessageId: null,
      subject: null,
      autoSubmitted: false,
      isBounce: false,
      ...msg,
    });
    this.threads.set(threadId, list);
  }
}
