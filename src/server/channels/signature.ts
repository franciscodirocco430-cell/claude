import { createHmac, timingSafeEqual } from "node:crypto";

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/** Comparación en tiempo constante de dos strings hex. */
export function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false;
  const ba = Buffer.from(a.toLowerCase(), "hex");
  const bb = Buffer.from(b.toLowerCase(), "hex");
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}

/** Comparación en tiempo constante de dos strings arbitrarios. */
export function safeEqualText(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}

/** Verifica un header `sha256=<hex>` (formato de Meta y del mock). */
export function verifySha256Header(
  header: string | null,
  secret: string,
  rawBody: string,
): boolean {
  if (!header?.startsWith("sha256=")) return false;
  return safeEqualHex(header.slice("sha256=".length), hmacSha256Hex(secret, rawBody));
}
