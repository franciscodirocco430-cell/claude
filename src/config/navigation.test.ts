import { describe, expect, it } from "vitest";
import { isNavItemActive, NAV_ITEMS } from "./navigation";

describe("navegación", () => {
  it("tiene las secciones del producto en orden", () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      "Campañas",
      "Cola",
      "Bandeja",
      "CRM",
      "Métricas",
      "Configuración",
    ]);
  });

  it("marca activa la sección y sus subrutas, sin falsos positivos por prefijo", () => {
    expect(isNavItemActive("/campanas", "/campanas")).toBe(true);
    expect(isNavItemActive("/campanas/abc", "/campanas")).toBe(true);
    expect(isNavItemActive("/campanas-viejas", "/campanas")).toBe(false);
    expect(isNavItemActive("/cola", "/campanas")).toBe(false);
  });
});
