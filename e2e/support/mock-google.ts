/**
 * Emulación MÍNIMA de Google OAuth + Gmail API para los tests e2e. Implementa
 * solo lo que usa la app: authorize (con PKCE), token, revoke, perfil, envío,
 * metadatos e hilos; Calendar (userinfo, listar y crear eventos). Más endpoints de
 * test: ver lo enviado, simular respuestas y ver los eventos creados.
 * NO usar fuera de tests.
 */
import { createHash, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const PORT = Number(process.env.MOCK_GOOGLE_PORT ?? 54398);
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];
const CALENDAR_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"];
const MAILBOX = "ventas@agencia-e2e.example.com";
const CALENDAR_EMAIL = "agenda@agencia-e2e.example.com";

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime: string };
  end: { dateTime: string };
  htmlLink: string;
}
const events: CalendarEvent[] = [];

interface StoredMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  date: number;
  isBounce?: boolean;
}

const codes = new Map<string, { challenge: string; redirectUri: string; scopes: string[] }>();
const tokenScopes = new Map<string, string[]>();
const accessTokens = new Set<string>();
const refreshTokens = new Set<string>();
const messages: StoredMessage[] = [];

async function body(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString();
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}

function parseMime(raw: string) {
  const [head = "", ...rest] = raw.split("\r\n\r\n");
  const headers = Object.fromEntries(
    head.split("\r\n").map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i).toLowerCase(), l.slice(i + 1).trim()];
    }),
  );
  const decodeHeader = (v = "") =>
    v.replace(/=\?UTF-8\?B\?([^?]+)\?=/g, (_m, b64: string) =>
      Buffer.from(b64, "base64").toString("utf8"),
    );
  return {
    to: headers.to ?? "",
    subject: decodeHeader(headers.subject),
    text: Buffer.from(rest.join("\r\n\r\n").replace(/\r\n/g, ""), "base64").toString("utf8"),
  };
}

function gmailMessage(m: StoredMessage) {
  return {
    id: m.id,
    threadId: m.threadId,
    internalDate: String(m.date),
    payload: {
      mimeType: m.isBounce ? "multipart/report" : "text/plain",
      headers: [
        { name: "From", value: m.from },
        { name: "To", value: m.to },
        { name: "Subject", value: m.subject },
        { name: "Message-ID", value: `<${m.id}@mock.gmail>` },
        ...(m.isBounce
          ? [{ name: "Content-Type", value: "multipart/report; report-type=delivery-status" }]
          : []),
      ],
      body: { data: Buffer.from(m.text, "utf8").toString("base64url") },
    },
  };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    const path = url.pathname;

    if (path === "/health") return json(res, 200, { ok: true });

    // ── OAuth ──
    if (path === "/o/oauth2/v2/auth") {
      const p = url.searchParams;
      const scopes = (p.get("scope") ?? "").split(" ");
      if (
        !p.get("client_id") ||
        !p.get("redirect_uri") ||
        p.get("code_challenge_method") !== "S256"
      ) {
        return json(res, 400, { error: "invalid_request" });
      }
      const granted = SCOPES.every((s) => scopes.includes(s))
        ? SCOPES
        : CALENDAR_SCOPES.every((s) => scopes.includes(s))
          ? CALENDAR_SCOPES
          : null;
      if (!granted) return json(res, 400, { error: "invalid_scope" });
      const code = randomUUID();
      codes.set(code, {
        challenge: p.get("code_challenge")!,
        redirectUri: p.get("redirect_uri")!,
        scopes: granted,
      });
      const back = new URL(p.get("redirect_uri")!);
      back.searchParams.set("code", code);
      back.searchParams.set("state", p.get("state") ?? "");
      res.writeHead(302, { location: back.toString() });
      return res.end();
    }
    if (path === "/token" && req.method === "POST") {
      const p = new URLSearchParams(await body(req));
      let scopes = SCOPES;
      if (p.get("grant_type") === "authorization_code") {
        const stored = codes.get(p.get("code") ?? "");
        codes.delete(p.get("code") ?? "");
        const verifier = p.get("code_verifier") ?? "";
        const challenge = createHash("sha256").update(verifier).digest("base64url");
        if (
          !stored ||
          stored.challenge !== challenge ||
          stored.redirectUri !== p.get("redirect_uri")
        ) {
          return json(res, 400, { error: "invalid_grant" });
        }
        scopes = stored.scopes;
      } else if (p.get("grant_type") === "refresh_token") {
        if (!refreshTokens.has(p.get("refresh_token") ?? ""))
          return json(res, 400, { error: "invalid_grant" });
        scopes = tokenScopes.get(p.get("refresh_token") ?? "") ?? SCOPES;
      } else {
        return json(res, 400, { error: "unsupported_grant_type" });
      }
      const access = `at-${randomUUID()}`;
      const refresh = `rt-${randomUUID()}`;
      accessTokens.add(access);
      refreshTokens.add(refresh);
      tokenScopes.set(access, scopes);
      tokenScopes.set(refresh, scopes);
      // Google devuelve "email" como userinfo.email.
      const scope = scopes
        .map((s) => (s === "email" ? "https://www.googleapis.com/auth/userinfo.email" : s))
        .join(" ");
      return json(res, 200, {
        access_token: access,
        refresh_token: refresh,
        expires_in: 3600,
        scope,
      });
    }
    if (path === "/revoke") return json(res, 200, {});

    // ── OpenID userinfo + Calendar ──
    const bearer = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    const can = (scope: string) =>
      accessTokens.has(bearer) && tokenScopes.get(bearer)?.includes(scope);
    if (path === "/userinfo") {
      if (!can("email")) return json(res, 401, {});
      return json(res, 200, { sub: "123", email: CALENDAR_EMAIL, email_verified: true });
    }
    if (path.startsWith("/calendar/v3/calendars/primary/events")) {
      if (!can("https://www.googleapis.com/auth/calendar.events")) {
        return json(res, 403, { error: { code: 403 } });
      }
      if (req.method === "POST") {
        const data = JSON.parse(await body(req)) as Omit<CalendarEvent, "htmlLink">;
        if (events.some((e) => e.id === data.id)) return json(res, 409, { error: { code: 409 } });
        const event = { ...data, htmlLink: `https://calendar.example/event/${data.id}` };
        events.push(event);
        return json(res, 200, event);
      }
      const one = /\/events\/([^/]+)$/.exec(path);
      if (one) {
        const e = events.find((x) => x.id === decodeURIComponent(one[1]!));
        return e ? json(res, 200, e) : json(res, 404, {});
      }
      const min = new Date(url.searchParams.get("timeMin") ?? 0).getTime();
      const max = new Date(url.searchParams.get("timeMax") ?? 8.64e15).getTime();
      return json(res, 200, {
        timeZone: "America/Argentina/Buenos_Aires",
        items: events.filter(
          (e) =>
            new Date(e.end.dateTime).getTime() > min && new Date(e.start.dateTime).getTime() < max,
        ),
      });
    }
    if (path === "/__test/events") return json(res, 200, events);

    // ── Gmail ──
    if (path.startsWith("/gmail/v1/users/me/")) {
      const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
      if (!accessTokens.has(token)) return json(res, 401, { error: { code: 401 } });
      const rest = path.slice("/gmail/v1/users/me".length);
      if (rest === "/profile") return json(res, 200, { emailAddress: MAILBOX });
      if (rest === "/messages/send" && req.method === "POST") {
        const data = JSON.parse(await body(req)) as { raw: string; threadId?: string };
        const mime = parseMime(Buffer.from(data.raw, "base64url").toString("utf8"));
        const id = `m${messages.length + 1}${randomUUID().slice(0, 6)}`;
        const threadId = data.threadId ?? `t${id}`;
        messages.push({
          id,
          threadId,
          from: MAILBOX,
          to: mime.to,
          subject: mime.subject,
          text: mime.text,
          date: Date.now(),
        });
        return json(res, 200, { id, threadId, labelIds: ["SENT"] });
      }
      const msg = /^\/messages\/([^/]+)$/.exec(rest);
      if (msg) {
        const m = messages.find((x) => x.id === msg[1]);
        return m ? json(res, 200, gmailMessage(m)) : json(res, 404, {});
      }
      const thread = /^\/threads\/([^/]+)$/.exec(rest);
      if (thread) {
        return json(res, 200, {
          id: thread[1],
          messages: messages.filter((m) => m.threadId === thread[1]).map(gmailMessage),
        });
      }
      return json(res, 404, {});
    }

    // ── Solo tests ──
    if (path === "/__test/sent") {
      const to = url.searchParams.get("to") ?? "";
      return json(
        res,
        200,
        messages.filter((m) => m.from === MAILBOX && m.to.includes(to)),
      );
    }
    if (path === "/__test/reply" && req.method === "POST") {
      const data = JSON.parse(await body(req)) as {
        to: string;
        from: string;
        text: string;
        bounce?: boolean;
      };
      const last = [...messages]
        .reverse()
        .find((m) => m.from === MAILBOX && m.to.includes(data.to));
      if (!last) return json(res, 404, { error: "sin hilo" });
      messages.push({
        id: `r${messages.length + 1}${randomUUID().slice(0, 6)}`,
        threadId: last.threadId,
        from: data.from,
        to: MAILBOX,
        subject: `Re: ${last.subject}`,
        text: data.text,
        date: Date.now(),
        isBounce: data.bounce,
      });
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: "mock-google: ruta no implementada" });
  } catch (error) {
    return json(res, 500, { error: String(error) });
  }
});

server.listen(PORT, () => console.log(`mock-google escuchando en :${PORT}`));
