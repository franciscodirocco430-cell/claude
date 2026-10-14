export interface MailboxRef {
  id: string;
  organizationId: string;
  email: string;
}

export interface SendResult {
  messageId: string;
  threadId: string;
  /** Message-ID RFC del email enviado (para encadenar respuestas). */
  rfcMessageId: string | null;
}

export interface ThreadMessage {
  id: string;
  from: string;
  date: Date;
  rfcMessageId: string | null;
  subject: string | null;
  /** Respuesta automática (fuera de oficina, etc.): no cuenta como respuesta real. */
  autoSubmitted: boolean;
  /** Aviso de rebote (mailer-daemon / multipart/report). */
  isBounce: boolean;
  text: string;
}

export type MailErrorKind = "auth" | "rate_limit" | "invalid_recipient" | "transient" | "other";

export class MailProviderError extends Error {
  constructor(
    public readonly kind: MailErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "MailProviderError";
  }
}

/** Abstracción del proveedor de email (Gmail hoy). Permite tests sin cuentas reales. */
export interface MailProvider {
  send(mailbox: MailboxRef, input: { raw: string; threadId?: string | null }): Promise<SendResult>;
  getThread(mailbox: MailboxRef, threadId: string): Promise<ThreadMessage[]>;
}

/** Quita el texto citado de una respuesta ("> …", "El … escribió:", "On … wrote:"). */
export function extractReplyText(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*(El|On)\s.+(escribió|wrote):\s*$/i.test(line)) break;
    if (/^-{2,}\s*(Original Message|Mensaje original)/i.test(line)) break;
    if (/^\s*>/.test(line)) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}
