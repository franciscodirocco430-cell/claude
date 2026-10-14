import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  normalizeHandle,
  normalizePhone,
  normalizeUrl,
  websiteDomain,
} from "./normalize";

describe("normalización", () => {
  it("emails", () => {
    expect(normalizeEmail("  Laura@Clinica.COM ")).toBe("laura@clinica.com");
    expect(normalizeEmail("no-es-email")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
  });

  it("teléfonos argentinos a E.164", () => {
    expect(normalizePhone("+54 9 11 2345-6789")).toBe("+5491123456789");
    expect(normalizePhone("011 15-2345-6789")).toBe("+5491123456789");
    expect(normalizePhone("+1 415 555 2671")).toBe("+14155552671");
    expect(normalizePhone("123")).toBeNull();
  });

  it("URLs", () => {
    expect(normalizeUrl("Clinica.com.ar")).toBe("https://clinica.com.ar");
    expect(normalizeUrl("https://WWW.Clinica.com/turnos/?utm_source=x&id=2#top")).toBe(
      "https://www.clinica.com/turnos/?id=2",
    );
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("localhost")).toBeNull();
  });

  it("dominio para deduplicar, ignorando agregadores", () => {
    expect(websiteDomain("https://www.clinica.com.ar/contacto")).toBe("clinica.com.ar");
    expect(websiteDomain("https://linktr.ee/clinica")).toBeNull();
    expect(websiteDomain("https://algo.wixsite.com/clinica")).toBeNull();
  });

  it("handles", () => {
    expect(normalizeHandle("@Clinica.Dental_BA")).toBe("clinica.dental_ba");
    expect(normalizeHandle("con espacios")).toBeNull();
  });
});
