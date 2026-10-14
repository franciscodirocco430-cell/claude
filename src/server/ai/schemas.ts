import { z } from "zod";

/*
 * Esquemas de salida de la IA. Se mantienen simples (sin límites de largo) para
 * que sean compatibles con salidas estructuradas; los límites se aplican en
 * código después de validar.
 */

export const researchOutputSchema = z.object({
  summary: z.string().describe("Resumen de 2 a 4 oraciones sobre el prospecto y su negocio."),
  businessType: z.string().nullable().describe("Tipo de negocio, o null si no se sabe."),
  pains: z.array(z.string()).describe("Hasta 5 dolores probables, formulados como hipótesis."),
  hooks: z
    .array(z.string())
    .describe("Hasta 5 ganchos concretos y verificables para abrir la conversación."),
  icpFit: z.enum(["alto", "medio", "bajo", "desconocido"]),
  confidence: z.enum(["baja", "media", "alta"]),
});
export type ResearchOutput = z.infer<typeof researchOutputSchema>;

export const socialDraftSchema = z.object({
  message: z.string().describe("El primer mensaje, listo para enviar."),
});

export const emailDraftSchema = z.object({
  subject: z.string().describe("Asunto del email."),
  body: z.string().describe("Cuerpo del email, sin firma ni link de baja."),
});

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export function normalizeResearch(r: ResearchOutput): ResearchOutput {
  const list = (items: string[]) =>
    items
      .map((i) => i.trim())
      .filter(Boolean)
      .slice(0, 5)
      .map((i) => clip(i, 300));
  return {
    ...r,
    summary: clip(r.summary.trim(), 1200),
    businessType: r.businessType ? clip(r.businessType.trim(), 200) : null,
    pains: list(r.pains),
    hooks: list(r.hooks),
  };
}
