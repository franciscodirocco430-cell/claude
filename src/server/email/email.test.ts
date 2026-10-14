import { describe, expect, it } from "vitest";
import { buildMimeMessage, encodeHeader } from "./mime";
import { isValidTimeZone, nextSendSlot } from "./schedule";
import { firstName, renderTemplate, unknownVariables } from "./template";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe";

describe("plantillas", () => {
  it("reemplaza variables y usa defaults", () => {
    expect(
      renderTemplate("Hola {{nombre}}, ¿cómo va {{empresa}}?", {
        nombre: "Laura",
        empresa: "Sonrisas",
      }),
    ).toEqual({
      ok: true,
      text: "Hola Laura, ¿cómo va Sonrisas?",
    });
    expect(renderTemplate("Hola {{nombre|}}{{ nombre | qué tal}}", {})).toEqual({
      ok: true,
      text: "Hola qué tal",
    });
  });
  it("no renderiza si falta un valor sin default", () => {
    expect(renderTemplate("{{mensaje_ia}}", { mensaje_ia: "  " })).toEqual({
      ok: false,
      missing: ["mensaje_ia"],
    });
  });
  it("detecta variables desconocidas", () => {
    expect(unknownVariables("Hola {{nombr}} de {{empresa}} {{nombr}}")).toEqual(["nombr"]);
  });
  it("primer nombre", () => {
    expect(firstName("  Laura   Gómez ")).toBe("Laura");
    expect(firstName(null)).toBeNull();
  });
});

describe("MIME", () => {
  const base = {
    from: { email: "ventas@agencia.example.com", name: "Agencia Ñandú" },
    to: "laura@clinica.example.com",
    subject: "Una idea para tu clínica",
    text: "Hola Laura,\n\n¿Charlamos?",
    listUnsubscribeUrl: "https://app.example.com/baja/abc",
  };
  it("arma un mensaje de texto plano con baja en un clic", () => {
    const raw = buildMimeMessage(base);
    expect(raw).toContain("From: =?UTF-8?B?");
    expect(raw).toContain("To: laura@clinica.example.com");
    expect(raw).toContain("List-Unsubscribe: <https://app.example.com/baja/abc>");
    expect(raw).toContain("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
    const body = raw.split("\r\n\r\n")[1]!.replace(/\r\n/g, "");
    expect(Buffer.from(body, "base64").toString("utf8")).toBe("Hola Laura,\r\n\r\n¿Charlamos?");
  });
  it("impide inyección de encabezados", () => {
    const raw = buildMimeMessage({ ...base, subject: "Hola\r\nBcc: victima@example.com" });
    expect(raw).not.toMatch(/^Bcc:/m);
    expect(() => buildMimeMessage({ ...base, to: "a@b.com\r\nBcc: x@y.com" })).toThrow();
  });
  it("codifica asuntos con acentos", () => {
    expect(encodeHeader("Plain")).toBe("Plain");
    expect(encodeHeader("Acción")).toMatch(/^=\?UTF-8\?B\?/);
  });
  it("encadena respuestas en el mismo hilo", () => {
    const raw = buildMimeMessage({ ...base, inReplyTo: "<abc@mail>", references: "<abc@mail>" });
    expect(raw).toContain("In-Reply-To: <abc@mail>");
  });
});

describe("horario hábil", () => {
  const TZ = "America/Argentina/Buenos_Aires";
  it("dentro del horario sale ya", () => {
    const wed11 = new Date("2026-10-14T14:00:00Z"); // miércoles 11:00 en BA
    expect(nextSendSlot(wed11, TZ)).toEqual(wed11);
  });
  it("de noche pasa a las 9 del día siguiente (+ jitter)", () => {
    const wed22 = new Date("2026-10-15T01:00:00Z"); // miércoles 22:00 en BA
    expect(nextSendSlot(wed22, TZ, undefined, 7).toISOString()).toBe("2026-10-15T12:07:00.000Z");
  });
  it("viernes a la tarde pasa al lunes", () => {
    const fri19 = new Date("2026-10-16T22:00:00Z"); // viernes 19:00 en BA
    expect(nextSendSlot(fri19, TZ).toISOString()).toBe("2026-10-19T12:00:00.000Z");
  });
  it("respeta la zona del prospecto (Madrid, con horario de verano)", () => {
    const sat = new Date("2026-10-17T10:00:00Z");
    expect(nextSendSlot(sat, "Europe/Madrid").toISOString()).toBe("2026-10-19T07:00:00.000Z");
  });
  it("valida zonas horarias", () => {
    expect(isValidTimeZone("America/Argentina/Buenos_Aires")).toBe(true);
    expect(isValidTimeZone("Marte/Olympus")).toBe(false);
  });
});

describe("token de baja", () => {
  const secret = "secreto-de-prueba";
  it("firma y verifica", () => {
    const token = signUnsubscribeToken({ o: "org", e: "a@b.com", n: "enr" }, secret);
    expect(verifyUnsubscribeToken(token, secret)).toEqual({ o: "org", e: "a@b.com", n: "enr" });
  });
  it("rechaza tokens alterados o firmados con otra clave", () => {
    const token = signUnsubscribeToken({ o: "org", e: "a@b.com" }, secret);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ o: "otra", e: "a@b.com" })).toString("base64url");
    expect(verifyUnsubscribeToken(`${forged}.${sig}`, secret)).toBeNull();
    expect(verifyUnsubscribeToken(token, "otra-clave")).toBeNull();
    expect(verifyUnsubscribeToken(`${body}`, secret)).toBeNull();
    expect(verifyUnsubscribeToken("basura", secret)).toBeNull();
  });
});
