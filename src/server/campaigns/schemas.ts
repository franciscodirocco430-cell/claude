import { z } from "zod";
import { channel } from "@/db/schema/enums";

/**
 * Esquemas del wizard de campañas. Se usan en el cliente (validar cada paso)
 * y en el servidor (validar todo de nuevo antes de guardar).
 */

export const CHANNELS = channel.enumValues;
export type CampaignChannel = (typeof CHANNELS)[number];

/** Topes diarios por setter por defecto: conservadores a propósito. */
export const DEFAULT_DAILY_LIMITS: Record<CampaignChannel, number> = {
  instagram: 25,
  facebook: 25,
  tiktok: 20,
  whatsapp: 30,
  email: 40,
};
export const MAX_DAILY_LIMIT = 200;

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, { error: min <= 1 ? `Completá ${label}.` : `${label} es muy corto.` })
    .max(max, { error: `${label} es muy largo (máx. ${max} caracteres).` });

const itemList = (label: string, maxItems: number, maxLen = 200) =>
  z
    .array(
      z
        .string()
        .trim()
        .max(maxLen, { error: `Cada ${label} puede tener hasta ${maxLen} caracteres.` }),
    )
    .transform((items) => [...new Set(items.filter(Boolean))])
    .pipe(z.array(z.string()).max(maxItems, { error: `Máximo ${maxItems} ${label}s.` }));

export const nicheStep = z.object({
  name: trimmed(3, 100, "El nombre de la campaña"),
  niche: trimmed(3, 300, "El nicho"),
});

export const referencesStep = z.object({
  nicheReferences: itemList("referente", 15),
});

export const offerStep = z.object({
  offer: trimmed(10, 2000, "La oferta"),
  icp: trimmed(10, 2000, "El cliente ideal"),
});

export const criterionSchema = z.object({
  label: trimmed(3, 150, "El criterio"),
  weight: z.coerce
    .number({ error: "Peso inválido." })
    .int({ error: "El peso tiene que ser un número entero." })
    .min(1, { error: "El peso mínimo es 1." })
    .max(100, { error: "El peso máximo es 100." }),
});

export const qualificationStep = z.object({
  qualificationCriteria: z
    .array(criterionSchema)
    .min(1, { error: "Agregá al menos un criterio de calificación." })
    .max(10, { error: "Máximo 10 criterios." }),
  qualificationQuestions: itemList("pregunta", 10, 300).pipe(
    z.array(z.string()).min(1, { error: "Agregá al menos una pregunta de calificación." }),
  ),
});

export const channelsStep = z.object({
  channels: z
    .array(z.enum(CHANNELS))
    .min(1, { error: "Elegí al menos un canal." })
    .transform((list) => CHANNELS.filter((c) => list.includes(c))),
});

export const toneStep = z.object({
  tone: trimmed(3, 500, "El tono"),
});

export const limitsStep = z.object({
  dailyLimits: z.partialRecord(
    z.enum(CHANNELS),
    z.coerce
      .number({ error: "Límite inválido." })
      .int({ error: "El límite tiene que ser un número entero." })
      .min(0, { error: "El límite no puede ser negativo." })
      .max(MAX_DAILY_LIMIT, { error: `El límite máximo es ${MAX_DAILY_LIMIT} por día.` }),
  ),
});

export const campaignInputSchema = nicheStep
  .extend(referencesStep.shape)
  .extend(offerStep.shape)
  .extend(qualificationStep.shape)
  .extend(channelsStep.shape)
  .extend(toneStep.shape)
  .extend(limitsStep.shape)
  .transform((c) => ({
    ...c,
    // Solo se guardan límites de los canales elegidos; los que falten toman el default.
    dailyLimits: Object.fromEntries(
      c.channels.map((ch) => [ch, c.dailyLimits[ch] ?? DEFAULT_DAILY_LIMITS[ch]]),
    ) as Partial<Record<CampaignChannel, number>>,
  }));

export type CampaignInput = z.infer<typeof campaignInputSchema>;
export type CampaignFormValues = z.input<typeof campaignInputSchema>;

export const WIZARD_STEPS = [
  { key: "niche", title: "Nicho", schema: nicheStep },
  { key: "references", title: "Referentes", schema: referencesStep },
  { key: "offer", title: "Oferta e ICP", schema: offerStep },
  { key: "qualification", title: "Calificación", schema: qualificationStep },
  { key: "channels", title: "Canales", schema: channelsStep },
  { key: "tone", title: "Tono", schema: toneStep },
  { key: "limits", title: "Límites diarios", schema: limitsStep },
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]["key"];

/** Errores por ruta ("qualificationCriteria.0.label") para mostrar en el wizard. */
export function issuesByPath(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}

export function emptyCampaign(): CampaignFormValues {
  return {
    name: "",
    niche: "",
    nicheReferences: [],
    offer: "",
    icp: "",
    qualificationCriteria: [{ label: "", weight: 50 }],
    qualificationQuestions: [""],
    channels: [],
    tone: "Cercano y profesional, sin vender de entrada.",
    dailyLimits: { ...DEFAULT_DAILY_LIMITS },
  };
}

export const MAX_EXAMPLES_PER_CHANNEL = 3;

/** Ejemplos (few-shot) por canal, editables por campaña. */
export const fewShotExamplesSchema = z
  .array(
    z.object({
      channel: z.enum(CHANNELS),
      context: z
        .string()
        .trim()
        .max(200, { error: "El contexto puede tener hasta 200 caracteres." }),
      message: trimmed(10, 1200, "El ejemplo"),
    }),
  )
  .superRefine((items, ctx) => {
    for (const ch of CHANNELS) {
      if (items.filter((i) => i.channel === ch).length > MAX_EXAMPLES_PER_CHANNEL) {
        ctx.addIssue({
          code: "custom",
          message: `Máximo ${MAX_EXAMPLES_PER_CHANNEL} ejemplos por canal.`,
        });
      }
    }
  });
export type FewShotExamplesInput = z.infer<typeof fewShotExamplesSchema>;
