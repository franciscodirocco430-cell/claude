import { z } from "zod";

const hour = z.coerce.number().int().min(0).max(24);

/**
 * Configuración del agente por campaña (`campaigns.agent_settings`). Defaults
 * conservadores: el agente arranca APAGADO y la demora simula un ritmo humano.
 */
export const agentSettingsSchema = z
  .object({
    enabled: z.boolean().default(false),
    /** Guion propio de la campaña: indicaciones extra para el agente. */
    script: z.string().trim().max(2000).default(""),
    replyDelayMinSeconds: z.coerce.number().int().min(0).max(3600).default(45),
    replyDelayMaxSeconds: z.coerce.number().int().min(0).max(3600).default(180),
    /** Puntaje desde el que el lead se considera calificado (0-100). */
    qualifyScore: z.coerce.number().int().min(0).max(100).default(60),
    calendarAccountId: z.uuid().nullable().default(null),
    meetingTitle: z.string().trim().min(1).max(120).default("Llamada con {{nombre}}"),
    meetingDurationMinutes: z.coerce.number().int().min(15).max(180).default(30),
    meetingStartHour: hour.default(10),
    meetingEndHour: hour.default(18),
    meetingDays: z.array(z.coerce.number().int().min(0).max(6)).min(1).default([1, 2, 3, 4, 5]),
    minNoticeHours: z.coerce.number().int().min(0).max(168).default(12),
    bookingWindowDays: z.coerce.number().int().min(1).max(30).default(7),
  })
  .refine((s) => s.replyDelayMinSeconds <= s.replyDelayMaxSeconds, {
    path: ["replyDelayMaxSeconds"],
    error: "La demora máxima tiene que ser mayor o igual a la mínima.",
  })
  .refine((s) => s.meetingStartHour < s.meetingEndHour, {
    path: ["meetingEndHour"],
    error: "La hora de fin tiene que ser posterior a la de inicio.",
  });

export type AgentSettings = z.infer<typeof agentSettingsSchema>;

/** Lee la configuración guardada; si está rota, cae a los defaults (agente apagado). */
export function parseAgentSettings(raw: unknown): AgentSettings {
  const parsed = agentSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : agentSettingsSchema.parse({});
}

/** Demora aleatoria dentro del rango configurado, para que el ritmo sea natural. */
export function replyDelaySeconds(s: AgentSettings, random: () => number = Math.random) {
  const span = s.replyDelayMaxSeconds - s.replyDelayMinSeconds;
  return s.replyDelayMinSeconds + Math.round(random() * span);
}

export const slotSchema = z.object({
  id: z.string().min(1).max(10),
  start: z.iso.datetime(),
  end: z.iso.datetime(),
});
export type Slot = z.infer<typeof slotSchema>;

/** Estado del agente por conversación (`conversations.agent_state`). */
export const agentStateSchema = z.object({
  offeredSlots: z.array(slotSchema).default([]),
  offeredAt: z.iso.datetime().nullable().default(null),
});
export type AgentState = z.infer<typeof agentStateSchema>;

export function parseAgentState(raw: unknown): AgentState {
  const parsed = agentStateSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : agentStateSchema.parse({});
}
