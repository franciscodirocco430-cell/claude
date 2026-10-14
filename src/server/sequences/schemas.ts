import { z } from "zod";
import { unknownVariables } from "@/server/email/template";

export const MAX_STEPS = 6;

const templateField = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} puede tener hasta ${max} caracteres.` })
    .superRefine((value, ctx) => {
      const unknown = unknownVariables(value);
      if (unknown.length) {
        ctx.addIssue({
          code: "custom",
          message: `Variable desconocida: {{${unknown.join("}}, {{")}}}.`,
        });
      }
    });

export const sequenceStepSchema = z.object({
  /** Vacío en pasos 2+ = responde en el mismo hilo ("Re: …"). */
  subject: templateField("El asunto", 150),
  body: templateField("El cuerpo", 5000).pipe(
    z.string().min(10, { error: "El cuerpo es muy corto." }),
  ),
  delayDays: z.coerce
    .number({ error: "Días inválidos." })
    .int({ error: "Tiene que ser un número entero." })
    .min(0, { error: "No puede ser negativo." })
    .max(30, { error: "Máximo 30 días entre pasos." }),
});

export const sequenceInputSchema = z
  .object({
    name: z.string().trim().min(3, { error: "El nombre es muy corto." }).max(100),
    mailboxAccountId: z.uuid().nullable(),
    sendStartHour: z.coerce.number().int().min(0).max(23).default(9),
    sendEndHour: z.coerce.number().int().min(1).max(24).default(18),
    sendDays: z
      .array(z.coerce.number().int().min(0).max(6))
      .min(1, { error: "Elegí al menos un día de envío." })
      .default([1, 2, 3, 4, 5])
      .transform((d) => [...new Set(d)].sort()),
    steps: z
      .array(sequenceStepSchema)
      .min(1, { error: "Agregá al menos un paso." })
      .max(MAX_STEPS, { error: `Máximo ${MAX_STEPS} pasos.` }),
  })
  .superRefine((seq, ctx) => {
    if (seq.sendStartHour >= seq.sendEndHour) {
      ctx.addIssue({
        code: "custom",
        path: ["sendEndHour"],
        message: "La hora de fin tiene que ser posterior al inicio.",
      });
    }
    if (seq.steps[0] && !seq.steps[0].subject) {
      ctx.addIssue({
        code: "custom",
        path: ["steps", 0, "subject"],
        message: "El primer email necesita asunto.",
      });
    }
    seq.steps.forEach((s, i) => {
      if (i > 0 && s.delayDays < 1) {
        ctx.addIssue({
          code: "custom",
          path: ["steps", i, "delayDays"],
          message: "Los seguimientos tienen que esperar al menos 1 día.",
        });
      }
    });
  });

export type SequenceInput = z.infer<typeof sequenceInputSchema>;
export type SequenceFormValues = z.input<typeof sequenceInputSchema>;

export function emptySequence(): SequenceFormValues {
  return {
    name: "Secuencia principal",
    mailboxAccountId: null,
    sendStartHour: 9,
    sendEndHour: 18,
    sendDays: [1, 2, 3, 4, 5],
    steps: [
      { subject: "{{asunto_ia}}", body: "{{mensaje_ia}}", delayDays: 0 },
      {
        subject: "",
        body: "Hola {{nombre|}}, te escribo de nuevo por si se perdió el mail anterior. ¿Te sirve que lo charlemos?",
        delayDays: 3,
      },
    ],
  };
}
