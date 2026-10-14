import { describe, expect, it } from "vitest";
import { isPublicPath, safeNextPath } from "./redirects";

describe("safeNextPath", () => {
  it.each([
    ["/cola", "/cola"],
    ["/campanas/123?tab=prospectos", "/campanas/123?tab=prospectos"],
    ["/invitacion/abc", "/invitacion/abc"],
  ])("acepta rutas internas: %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "https://evil.example.com",
    "//evil.example.com",
    "/\\evil.example.com",
    "javascript:alert(1)",
    "cola",
    "/\u0000/evil",
  ])("rechaza destinos externos o inválidos: %s", (input) => {
    expect(safeNextPath(input)).toBe("/campanas");
  });
});

describe("isPublicPath", () => {
  it("distingue rutas públicas sin falsos positivos por prefijo", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/invitacion/abc")).toBe(true);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/campanas")).toBe(false);
  });
});
