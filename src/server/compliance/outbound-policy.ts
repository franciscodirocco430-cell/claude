import type { Channel } from "./channels";
import type { WindowStatus } from "./messaging-window";

export interface OutboundInput {
  channel: Channel;
  window: WindowStatus;
  /** El destinatario está en la lista de supresión de la organización. */
  suppressed: boolean;
  /** Opt-in de WhatsApp registrado (con fecha) para el prospecto. */
  whatsappOptIn: boolean;
}

export type OutboundDecision =
  | { action: "auto_send" }
  | { action: "whatsapp_template" }
  | {
      action: "manual_task";
      reason: "first_contact_requires_human" | "window_expired" | "message_cap_reached";
    }
  | { action: "blocked"; reason: "suppressed" };

/**
 * Decide qué puede hacer el sistema (IA o worker) con un mensaje saliente.
 * Es la única puerta para envíos automáticos: todo adapter de canal tiene que
 * consultarla antes de enviar.
 *
 * - Nunca se automatiza el primer contacto en redes ni WhatsApp: tarea manual.
 * - Dentro de la ventana de la plataforma: se puede enviar.
 * - Fuera de la ventana: WhatsApp solo con plantilla aprobada y opt-in; el
 *   resto pasa a tarea manual del setter.
 * - Email se envía automático; las reglas propias (baja, límites, horario) las
 *   aplica el módulo de secuencias.
 * - La lista de supresión gana siempre, incluso sobre la ventana abierta.
 */
export function decideOutbound(input: OutboundInput): OutboundDecision {
  if (input.suppressed) return { action: "blocked", reason: "suppressed" };

  const { window } = input;
  if (window.kind === "not_applicable") return { action: "auto_send" };
  if (window.kind === "open") return { action: "auto_send" };

  switch (window.reason) {
    case "no_inbound":
      return { action: "manual_task", reason: "first_contact_requires_human" };
    case "message_cap":
      return { action: "manual_task", reason: "message_cap_reached" };
    case "expired":
      if (input.channel === "whatsapp" && input.whatsappOptIn) {
        return { action: "whatsapp_template" };
      }
      return { action: "manual_task", reason: "window_expired" };
  }
}
