import { describe, expect, it } from "vitest";
import { composeEmailBody, UNSUBSCRIBE_PLACEHOLDER } from "@/server/email/compose";
import { validateDraft } from "./channel-rules";

describe("validateDraft", () => {
  it("acepta un mensaje de Instagram correcto", () => {
    expect(
      validateDraft("instagram", {
        message:
          "Hola Laura, vi que abrieron una sede nueva en Palermo. ¿Cómo vienen con los turnos?",
      }),
    ).toEqual([]);
  });

  it.each([
    "Mirá esto: https://agencia.com",
    "Entrá a www.agencia.com",
    "Escribime a agencia.com.ar",
  ])("rechaza links en redes: %s", (message) => {
    expect(validateDraft("instagram", { message })).toContainEqual(expect.stringMatching(/link/));
  });

  it("rechaza mensajes largos y marcadores sin completar", () => {
    expect(validateDraft("tiktok", { message: "a".repeat(301) })[0]).toMatch(/300/);
    expect(validateDraft("whatsapp", { message: "Hola [nombre], ¿cómo va?" })).toContainEqual(
      expect.stringMatching(/marcadores/),
    );
    expect(validateDraft("whatsapp", { message: "Hola {{nombre}}" })).toContainEqual(
      expect.stringMatching(/marcadores/),
    );
  });

  it("email: exige asunto corto y sin links", () => {
    expect(validateDraft("email", { message: "Cuerpo", subject: "" })).toContain(
      "Falta el asunto.",
    );
    expect(validateDraft("email", { message: "Cuerpo", subject: "x".repeat(80) })[0]).toMatch(
      /asunto/,
    );
    expect(
      validateDraft("email", { message: "Cuerpo", subject: "Una idea para tu clínica" }),
    ).toEqual([]);
  });
});

describe("composeEmailBody", () => {
  it("siempre agrega firma y link de baja", () => {
    const body = composeEmailBody("Hola Laura,\n\nTe escribo por...");
    expect(body).toContain("{{firma}}");
    expect(body).toContain(UNSUBSCRIBE_PLACEHOLDER);
    expect(body.startsWith("Hola Laura")).toBe(true);
  });
});
