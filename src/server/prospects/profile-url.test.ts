import { describe, expect, it } from "vitest";
import { parseProfileInput } from "./profile-url";

describe("parseProfileInput", () => {
  it.each([
    ["https://www.instagram.com/clinica.dental/?igshid=abc", "instagram", "clinica.dental"],
    ["instagram.com/Clinica.Dental", "instagram", "clinica.dental"],
    ["https://ig.me/m/clinica.dental", "instagram", "clinica.dental"],
    ["https://www.tiktok.com/@orto.ba?lang=es", "tiktok", "orto.ba"],
    ["https://m.facebook.com/implantes.caballito/", "facebook", "implantes.caballito"],
    ["https://facebook.com/profile.php?id=1000123", "facebook", "1000123"],
    ["https://wa.me/5491123456789", "whatsapp", "+5491123456789"],
    ["https://api.whatsapp.com/send?phone=5491123456789", "whatsapp", "+5491123456789"],
  ])("%s → %s", (input, channel, handle) => {
    expect(parseProfileInput(input)).toMatchObject({ kind: "handle", channel, handle });
  });

  it.each([
    "https://www.instagram.com/p/Cxyz123/",
    "https://www.instagram.com/explore/",
    "https://www.tiktok.com/discover/dentistas",
    "https://www.facebook.com/groups/123",
    "https://wa.me/123",
  ])("rechaza URLs de redes que no son perfiles: %s", (input) => {
    expect(parseProfileInput(input)).toBeNull();
  });

  it("webs de negocios y emails", () => {
    expect(parseProfileInput("clinica.com.ar")).toEqual({
      kind: "website",
      url: "https://clinica.com.ar",
    });
    expect(parseProfileInput("Hola@Clinica.com")).toEqual({
      kind: "email",
      email: "hola@clinica.com",
    });
    expect(parseProfileInput("cualquier cosa")).toBeNull();
  });
});
