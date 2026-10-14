import type { ProspectSource } from "./types";

/**
 * Google Places API (datos públicos de negocios). NO IMPLEMENTADA todavía:
 * antes de activarla hay que verificar el costo vigente por request en la
 * página oficial y completar `cost.verifiedSummary`. Ver CLAUDE.md.
 */
export const googlePlacesSource: ProspectSource = {
  id: "google_places",
  label: "Google Places",
  dataOrigin: "official_business_api",
  enableEnvVar: "PROSPECT_SOURCE_GOOGLE_PLACES_ENABLED",
  cost: {
    verifiedSummary: null,
    pricingUrl: "https://developers.google.com/maps/billing-and-pricing/pricing",
  },
  async search() {
    throw new Error("Google Places todavía no está implementada (pendiente verificar costos).");
  },
};
