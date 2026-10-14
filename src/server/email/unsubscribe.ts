import { createHmac, timingSafeEqual } from "node:crypto";

export interface UnsubscribePayload {
  /** organización */
  o: string;
  /** email del destinatario */
  e: string;
  /** inscripción a la secuencia (opcional) */
  n?: string;
}

/** Token firmado (HMAC-SHA256) para el link de baja. No vence: una baja siempre tiene que funcionar. */
export function signUnsubscribeToken(payload: UnsubscribePayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyUnsubscribeToken(token: string, secret: string): UnsubscribePayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as UnsubscribePayload;
    return typeof payload.o === "string" && typeof payload.e === "string" ? payload : null;
  } catch {
    return null;
  }
}
