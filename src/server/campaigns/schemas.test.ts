import { describe, expect, it } from "vitest";
import {
  campaignInputSchema,
  channelsStep,
  emptyCampaign,
  issuesByPath,
  limitsStep,
  qualificationStep,
  referencesStep,
} from "./schemas";

const valid = {
  ...emptyCampaign(),
  name: "Odontólogos CABA",
  niche: "Clínicas odontológicas",
  offer: "Sistema de captación de pacientes particulares",
  icp: "Clínicas de 2 a 10 sillones en CABA",
  qualificationCriteria: [{ label: "Tiene presupuesto", weight: 60 }],
  qualificationQuestions: ["¿Cuántos pacientes nuevos reciben por mes?"],
  channels: ["whatsapp", "instagram"],
};

describe("esquemas del wizard de campañas", () => {
  it("acepta una campaña completa, ordena canales y guarda solo sus límites", () => {
    const r = campaignInputSchema.parse({ ...valid, dailyLimits: { instagram: 10, tiktok: 99 } });
    expect(r.channels).toEqual(["instagram", "whatsapp"]);
    expect(r.dailyLimits).toEqual({ instagram: 10, whatsapp: 30 });
  });

  it("limpia referentes vacíos y repetidos", () => {
    expect(referencesStep.parse({ nicheReferences: [" Ana ", "", "Ana", "Beto"] })).toEqual({
      nicheReferences: ["Ana", "Beto"],
    });
  });

  it("exige criterios y preguntas", () => {
    const r = qualificationStep.safeParse({
      qualificationCriteria: [],
      qualificationQuestions: [""],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issues = issuesByPath(r.error);
      expect(issues.qualificationCriteria).toMatch(/al menos un criterio/);
      expect(issues.qualificationQuestions).toMatch(/al menos una pregunta/);
    }
  });

  it("valida pesos y límites", () => {
    const r = qualificationStep.safeParse({
      qualificationCriteria: [{ label: "Algo", weight: 500 }],
      qualificationQuestions: ["¿Una?"],
    });
    expect(!r.success && issuesByPath(r.error)["qualificationCriteria.0.weight"]).toMatch(
      /máximo es 100/,
    );
    expect(limitsStep.safeParse({ dailyLimits: { instagram: 1000 } }).success).toBe(false);
    expect(limitsStep.safeParse({ dailyLimits: { instagram: -1 } }).success).toBe(false);
  });

  it("exige al menos un canal válido", () => {
    expect(channelsStep.safeParse({ channels: [] }).success).toBe(false);
    expect(channelsStep.safeParse({ channels: ["telegram"] }).success).toBe(false);
  });
});
