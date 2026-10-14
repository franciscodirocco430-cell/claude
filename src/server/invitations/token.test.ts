import { describe, expect, it } from "vitest";
import { generateInvitationToken, hashInvitationToken, normalizeEmail } from "./token";

describe("tokens de invitación", () => {
  it("son únicos y url-safe", () => {
    const a = generateInvitationToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateInvitationToken()).not.toBe(a);
  });

  it("el hash es determinístico y no contiene el token", () => {
    const token = generateInvitationToken();
    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token));
    expect(hashInvitationToken(token)).not.toContain(token);
  });

  it("normaliza emails", () => {
    expect(normalizeEmail("  Laura@Example.COM ")).toBe("laura@example.com");
  });
});
