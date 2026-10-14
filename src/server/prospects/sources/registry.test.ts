import { describe, expect, it } from "vitest";
import { getAvailableSource, PROSPECT_SOURCES, sourceAvailability } from "./registry";
import type { ProspectSource } from "./types";

const fake = (over: Partial<ProspectSource> = {}): ProspectSource => ({
  id: "fake",
  label: "Fake",
  dataOrigin: "public_business_directory",
  enableEnvVar: "FAKE_ENABLED",
  cost: { verifiedSummary: "Gratis (verificado 2026-10-01)", pricingUrl: "https://example.com" },
  search: async () => [],
  ...over,
});

describe("fuentes de prospectos", () => {
  it("requiere costo verificado y habilitación explícita", () => {
    expect(sourceAvailability(fake(), {})).toEqual({ available: false, reason: "disabled" });
    expect(sourceAvailability(fake(), { FAKE_ENABLED: "true" })).toEqual({ available: true });
    expect(
      sourceAvailability(fake({ cost: { verifiedSummary: null, pricingUrl: "x" } }), {
        FAKE_ENABLED: "true",
      }),
    ).toEqual({ available: false, reason: "cost_not_verified" });
  });

  it("rechaza orígenes no permitidos aunque estén habilitados", () => {
    const social = fake({ dataOrigin: "social_profiles" as never });
    expect(sourceAvailability(social, { FAKE_ENABLED: "true" })).toEqual({
      available: false,
      reason: "forbidden_origin",
    });
  });

  it("Google Places está registrada pero no disponible hasta verificar costos", () => {
    const places = PROSPECT_SOURCES.find((s) => s.id === "google_places")!;
    expect(places.cost.verifiedSummary).toBeNull();
    expect(sourceAvailability(places, { PROSPECT_SOURCE_GOOGLE_PLACES_ENABLED: "true" })).toEqual({
      available: false,
      reason: "cost_not_verified",
    });
    expect(() => getAvailableSource("google_places", {})).toThrow(/no está habilitada/);
  });

  it("todas las fuentes registradas tienen origen permitido", () => {
    for (const s of PROSPECT_SOURCES) {
      expect(["official_business_api", "public_business_directory"]).toContain(s.dataOrigin);
    }
  });
});
