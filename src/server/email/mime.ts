/**
 * Arma un email RFC 5322 en texto plano (mejor entregabilidad para email en frío).
 * Los valores de encabezados se limpian de CR/LF: evita inyección de encabezados.
 */
export interface MimeInput {
  from: { email: string; name?: string | null };
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string | null;
  references?: string | null;
  listUnsubscribeUrl: string;
  messageIdDomain?: string;
}

const clean = (v: string) => v.replace(/[\r\n]+/g, " ").trim();

/** RFC 2047 para encabezados con caracteres no ASCII. */
export function encodeHeader(value: string): string {
  const v = clean(value);
  return /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;
}

function address(email: string, name?: string | null) {
  const e = clean(email);
  if (!/^[^\s@<>]+@[^\s@<>]+$/.test(e)) throw new Error("Dirección de email inválida.");
  return name ? `${encodeHeader(name.replace(/["<>]/g, ""))} <${e}>` : e;
}

function wrap76(b64: string) {
  return b64.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

export function buildMimeMessage(input: MimeInput): string {
  const headers = [
    `From: ${address(input.from.email, input.from.name)}`,
    `To: ${address(input.to)}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    `List-Unsubscribe: <${clean(input.listUnsubscribeUrl)}>`,
    "List-Unsubscribe-Post: List-Unsubscribe=One-Click",
  ];
  if (input.inReplyTo) headers.push(`In-Reply-To: ${clean(input.inReplyTo)}`);
  if (input.references) headers.push(`References: ${clean(input.references)}`);
  const body = wrap76(Buffer.from(input.text.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64"));
  return `${headers.join("\r\n")}\r\n\r\n${body}\r\n`;
}

export function toBase64Url(raw: string) {
  return Buffer.from(raw, "utf8").toString("base64url");
}
