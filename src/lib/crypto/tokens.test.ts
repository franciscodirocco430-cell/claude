import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./tokens";

const key = randomBytes(32).toString("base64");
const otherKey = randomBytes(32).toString("base64");

describe("encryptSecret / decryptSecret", () => {
  it("hace round-trip del texto original", () => {
    const enc = encryptSecret("ya29.token-de-prueba", key);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).not.toContain("token-de-prueba");
    expect(decryptSecret(enc, key)).toBe("ya29.token-de-prueba");
  });

  it("usa un IV distinto en cada cifrado", () => {
    expect(encryptSecret("x", key)).not.toBe(encryptSecret("x", key));
  });

  it("falla con otra clave", () => {
    const enc = encryptSecret("secreto", key);
    expect(() => decryptSecret(enc, otherKey)).toThrow();
  });

  it("detecta manipulación del texto cifrado", () => {
    const enc = encryptSecret("secreto", key);
    const parts = enc.split(".");
    const data = Buffer.from(parts[3]!, "base64url");
    data[0] = data[0]! ^ 0xff;
    parts[3] = data.toString("base64url");
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
  });

  it("ata el secreto a sus datos asociados", () => {
    const enc = encryptSecret("secreto", key, "account-1");
    expect(decryptSecret(enc, key, "account-1")).toBe("secreto");
    expect(() => decryptSecret(enc, key, "account-2")).toThrow();
  });

  it("rechaza claves que no son de 32 bytes", () => {
    expect(() => encryptSecret("x", randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });

  it("rechaza formatos desconocidos", () => {
    expect(() => decryptSecret("v2.a.b.c", key)).toThrow(/inválido/);
    expect(() => decryptSecret("basura", key)).toThrow(/inválido/);
  });
});
