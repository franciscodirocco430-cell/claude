import { z } from "zod";

/*
 * Salida del agente. Simple a propósito (sin límites de largo) para que sea
 * compatible con salidas estructuradas; los límites se validan en código.
 */
export const agentOutputSchema = z.object({
  reply: z.string().describe("Respuesta para enviar al prospecto, lista para mandar."),
  askedIfBot: z
    .boolean()
    .describe("true si en su último mensaje el prospecto pregunta si sos un bot, IA o persona."),
  handoff: z.object({
    needed: z.boolean().describe("true si hay que pasar la conversación a una persona del equipo."),
    reason: z
      .enum(["asked_human", "angry", "out_of_scope", "other"])
      .nullable()
      .describe("Motivo del pase a una persona, o null."),
    summary: z.string().describe("Resumen breve para la persona que toma la conversación."),
  }),
  answers: z
    .array(
      z.object({
        question: z.number().int().describe("Número de la pregunta de calificación (desde 1)."),
        answer: z.string().describe("Lo que respondió el prospecto, en sus palabras resumidas."),
      }),
    )
    .describe("Respuestas a preguntas de calificación que aparecen en la conversación."),
  criteria: z
    .array(
      z.object({
        criterion: z.number().int().describe("Número del criterio (desde 1)."),
        met: z.boolean().nullable().describe("true/false si se puede afirmar; null si no se sabe."),
        evidence: z.string().describe("Qué dijo el prospecto que lo justifica."),
      }),
    )
    .describe("Evaluación de los criterios de calificación con la información disponible."),
  wantsMeeting: z
    .boolean()
    .describe("true si el prospecto acepta o pide agendar una llamada/reunión."),
  selectedSlotId: z
    .string()
    .nullable()
    .describe("Id del horario ofrecido que eligió el prospecto (ej. h2), o null."),
});
export type AgentOutput = z.infer<typeof agentOutputSchema>;
