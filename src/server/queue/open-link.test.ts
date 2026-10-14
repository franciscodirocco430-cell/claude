import { describe, expect, it } from "vitest";
import { buildOpenUrl, startOfDayInZone } from "./open-link";

const target = {
  phone: "+5491123456789",
  handles: [
    { channel: "instagram", handle: "clinica.demo", url: "https://instagram.com/clinica.demo" },
    { channel: "tiktok", handle: "orto.demo", url: null },
    { channel: "facebook", handle: "1000123", url: "https://facebook.com/profile.php?id=1000123" },
  ],
};

describe("buildOpenUrl", () => {
  it("WhatsApp: wa.me con el mensaje codificado", () => {
    expect(buildOpenUrl("whatsapp", target, "Hola! ¿Cómo va? 50% & más")).toBe(
      "https://wa.me/5491123456789?text=Hola!%20%C2%BFC%C3%B3mo%20va%3F%2050%25%20%26%20m%C3%A1s",
    );
  });
  it("Instagram abre el chat con ig.me", () => {
    expect(buildOpenUrl("instagram", target, "x")).toBe("https://ig.me/m/clinica.demo");
  });
  it("TikTok abre el perfil", () => {
    expect(buildOpenUrl("tiktok", target, "x")).toBe("https://www.tiktok.com/@orto.demo");
  });
  it("Facebook usa el link guardado", () => {
    expect(buildOpenUrl("facebook", target, "x")).toBe(
      "https://facebook.com/profile.php?id=1000123",
    );
  });
  it("sin datos del canal no hay link", () => {
    expect(buildOpenUrl("whatsapp", { phone: null, handles: [] }, "x")).toBeNull();
    expect(buildOpenUrl("instagram", { phone: null, handles: [] }, "x")).toBeNull();
  });
});

describe("startOfDayInZone", () => {
  it("Buenos Aires (UTC-3): 02:00 UTC todavía es el día anterior", () => {
    expect(
      startOfDayInZone(
        new Date("2026-10-15T02:00:00Z"),
        "America/Argentina/Buenos_Aires",
      ).toISOString(),
    ).toBe("2026-10-14T03:00:00.000Z");
    expect(
      startOfDayInZone(
        new Date("2026-10-15T15:30:00Z"),
        "America/Argentina/Buenos_Aires",
      ).toISOString(),
    ).toBe("2026-10-15T03:00:00.000Z");
  });
  it("UTC", () => {
    expect(startOfDayInZone(new Date("2026-10-15T23:59:59Z"), "UTC").toISOString()).toBe(
      "2026-10-15T00:00:00.000Z",
    );
  });
});
