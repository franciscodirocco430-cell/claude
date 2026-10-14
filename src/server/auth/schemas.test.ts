import { describe, expect, it } from "vitest";
import { fieldErrors, inviteSchema, signupSchema } from "./schemas";

describe("esquemas de auth", () => {
  it("normaliza el email del registro", () => {
    const r = signupSchema.parse({
      fullName: " Laura ",
      email: " Laura@Example.com ",
      password: "12345678",
      organizationName: "Agencia",
    });
    expect(r.email).toBe("laura@example.com");
    expect(r.fullName).toBe("Laura");
  });

  it("devuelve un error por campo en español", () => {
    const r = signupSchema.safeParse({
      fullName: "",
      email: "x",
      password: "1",
      organizationName: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errors = fieldErrors(r.error);
      expect(errors.email).toBe("Ingresá un email válido.");
      expect(errors.password).toMatch(/8 caracteres/);
      expect(errors.organizationName).toMatch(/muy corto/);
    }
  });

  it("valida roles de invitación", () => {
    expect(inviteSchema.safeParse({ email: "a@b.co", role: "setter" }).success).toBe(true);
    expect(inviteSchema.safeParse({ email: "a@b.co", role: "superadmin" }).success).toBe(false);
  });
});
