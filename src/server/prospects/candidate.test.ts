import { describe, expect, it } from "vitest";
import { dedupeKeys, parseConsentDate, toCandidate } from "./candidate";

const now = new Date("2026-10-14T12:00:00Z");

describe("toCandidate", () => {
  it("normaliza todo y arma los handles", () => {
    const r = toCandidate(
      {
        fullName: "  Laura   Gómez ",
        email: "LAURA@clinica.com",
        phone: "11 2345-6789",
        website: "clinica.com",
        instagram: "https://instagram.com/Clinica.BA",
        tiktok: "@orto.ba",
      },
      now,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidate).toMatchObject({
      fullName: "Laura Gómez",
      email: "laura@clinica.com",
      phone: "+541123456789",
      website: "https://clinica.com",
      handles: [
        { channel: "instagram", handle: "clinica.ba", url: "https://instagram.com/clinica.ba" },
        { channel: "tiktok", handle: "orto.ba", url: null },
      ],
    });
  });

  it("descarta valores inválidos con advertencia", () => {
    const r = toCandidate(
      { email: "no-email", instagram: "con espacios", website: "clinica.com" },
      now,
    );
    expect(r.ok).toBe(true);
    expect(r.warnings).toHaveLength(2);
  });

  it("rechaza filas sin ninguna vía de contacto", () => {
    const r = toCandidate({ fullName: "Solo nombre", email: "x" }, now);
    expect(r.ok).toBe(false);
  });

  it("usa el WhatsApp como teléfono si no hay otro", () => {
    const r = toCandidate({ whatsapp: "https://wa.me/5491123456789" }, now);
    expect(r.ok && r.candidate.phone).toBe("+5491123456789");
  });

  it("opt-in de WhatsApp solo con fecha válida y teléfono", () => {
    const ok = toCandidate(
      { phone: "+5491123456789", whatsappOptIn: "Sí", whatsappOptInDate: "01/03/2026" },
      now,
    );
    expect(ok.ok && ok.candidate.whatsappOptInAt?.toISOString()).toBe("2026-03-01T00:00:00.000Z");

    const noDate = toCandidate({ phone: "+5491123456789", whatsappOptIn: "si" }, now);
    expect(noDate.ok && noDate.candidate.whatsappOptInAt).toBeNull();
    expect(noDate.warnings[0]).toMatch(/sin fecha/);

    const noPhone = toCandidate(
      { email: "a@b.co", whatsappOptIn: "si", whatsappOptInDate: "2026-03-01" },
      now,
    );
    expect(noPhone.ok && noPhone.candidate.whatsappOptInAt).toBeNull();
  });
});

describe("parseConsentDate", () => {
  it("acepta ISO y dd/mm/aaaa, rechaza futuro e inválidas", () => {
    expect(parseConsentDate("2026-03-01", now)?.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(parseConsentDate("31/12/2025", now)?.toISOString()).toBe("2025-12-31T00:00:00.000Z");
    expect(parseConsentDate("31/02/2026", now)).toBeNull();
    expect(parseConsentDate("2027-01-01", now)).toBeNull();
    expect(parseConsentDate("ayer", now)).toBeNull();
  });
});

describe("dedupeKeys", () => {
  it("genera claves por email, teléfono, dominio y handle", () => {
    const r = toCandidate(
      {
        email: "a@clinica.com",
        phone: "+5491123456789",
        website: "www.clinica.com/x",
        instagram: "clinica",
      },
      now,
    );
    expect(r.ok && dedupeKeys(r.candidate)).toEqual([
      "email:a@clinica.com",
      "phone:+5491123456789",
      "domain:clinica.com",
      "handle:instagram:clinica",
    ]);
  });
});
