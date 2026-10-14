import type { Channel, SocialChannel } from "./channels";
import { isSocialChannel } from "./channels";

export interface WindowRule {
  /** Horas desde el último mensaje del usuario en las que el negocio puede responder. */
  windowHours: number;
  /** Tope de mensajes del negocio dentro de la ventana (null = sin tope). */
  maxBusinessMessages: number | null;
}

/**
 * Ventanas de mensajería de cada plataforma (ver CLAUDE.md). Si cambian las
 * políticas de la plataforma, se cambia acá y en los tests, en ningún otro lado.
 */
export const MESSAGING_WINDOWS: Record<SocialChannel, WindowRule> = {
  instagram: { windowHours: 24, maxBusinessMessages: null },
  facebook: { windowHours: 24, maxBusinessMessages: null },
  whatsapp: { windowHours: 24, maxBusinessMessages: null },
  tiktok: { windowHours: 48, maxBusinessMessages: 10 },
};

export interface WindowInput {
  channel: Channel;
  /** Último mensaje entrante del prospecto (null si nunca escribió). */
  lastInboundAt: Date | null;
  /** Mensajes del negocio enviados desde ese último entrante. */
  businessMessagesSinceInbound: number;
  now: Date;
}

export type WindowStatus =
  | { kind: "not_applicable" }
  | { kind: "open"; expiresAt: Date; remainingMessages: number | null }
  | {
      kind: "closed";
      reason: "no_inbound" | "expired" | "message_cap";
      expiresAt: Date | null;
    };

const HOUR_MS = 60 * 60 * 1000;

export function getWindowStatus(input: WindowInput): WindowStatus {
  if (!isSocialChannel(input.channel)) return { kind: "not_applicable" };

  const rule = MESSAGING_WINDOWS[input.channel];
  if (!input.lastInboundAt) return { kind: "closed", reason: "no_inbound", expiresAt: null };

  const expiresAt = new Date(input.lastInboundAt.getTime() + rule.windowHours * HOUR_MS);
  if (input.now.getTime() >= expiresAt.getTime()) {
    return { kind: "closed", reason: "expired", expiresAt };
  }

  if (rule.maxBusinessMessages !== null) {
    const remaining = rule.maxBusinessMessages - input.businessMessagesSinceInbound;
    if (remaining <= 0) return { kind: "closed", reason: "message_cap", expiresAt };
    return { kind: "open", expiresAt, remainingMessages: remaining };
  }

  return { kind: "open", expiresAt, remainingMessages: null };
}
