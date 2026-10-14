import { hmacSha256Hex, safeEqualHex } from "./signature";
import {
  ChannelSendError,
  windowStatusFromCompliance,
  type ChannelAdapter,
  type ConnectResult,
  type WebhookRequest,
  type WebhookResult,
} from "./types";

export interface TikTokConfig {
  clientSecret: string;
}

/** Tolerancia del timestamp firmado (anti-replay). */
const MAX_SKEW_SECONDS = 5 * 60;

/**
 * Verifica `TikTok-Signature: t=<timestamp>,s=<firma>` con
 * firma = HMAC-SHA256(client secret, `${t}.${cuerpo crudo}`).
 *
 * OJO: este esquema sale de la documentación GENERAL de webhooks de TikTok. No se
 * pudo confirmar que Business Messaging use exactamente el mismo; verificarlo con
 * la doc oficial o con una entrega de prueba antes de habilitarlo.
 */
export function verifyTikTokSignature(
  header: string | null,
  secret: string,
  rawBody: string,
  now = new Date(),
): boolean {
  if (!header) return false;
  const parts = new Map(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()] as const;
    }),
  );
  const t = parts.get("t");
  const s = parts.get("s");
  if (!t || !s || !/^\d+$/.test(t)) return false;
  if (Math.abs(now.getTime() / 1000 - Number(t)) > MAX_SKEW_SECONDS) return false;
  return safeEqualHex(s, hmacSha256Hex(secret, `${t}.${rawBody}`));
}

/**
 * TikTok Business Messaging API.
 *
 * Pendiente: el formato del evento DIRECT_MESSAGE y el endpoint de envío no se
 * pudieron confirmar contra la documentación oficial, así que NO se implementan a
 * ciegas. Mientras tanto, el canal se prueba con el adapter mock (que sí aplica las
 * reglas de TikTok: ventana de 48 h y máximo 10 mensajes del negocio).
 */
export class TikTokAdapter implements ChannelAdapter {
  readonly provider = "tiktok" as const;
  readonly mock = false;
  readonly channels = ["tiktok"] as const;

  constructor(private readonly config: TikTokConfig) {}

  async connect(): Promise<ConnectResult> {
    return {
      kind: "unavailable",
      reason:
        "La conexión con TikTok requiere acceso aprobado a Business Messaging. Todavía no está disponible.",
    };
  }

  receiveWebhook(req: WebhookRequest): WebhookResult {
    if (req.method !== "POST") return { kind: "rejected", status: 400, reason: "método inválido" };
    if (
      !verifyTikTokSignature(
        req.headers.get("tiktok-signature"),
        this.config.clientSecret,
        req.rawBody,
      )
    ) {
      return { kind: "rejected", status: 401, reason: "firma inválida" };
    }
    // Firma válida pero formato sin verificar: 501 para que TikTok reintente y no se
    // pierdan mensajes cuando se implemente el parseo.
    return { kind: "rejected", status: 501, reason: "formato de TikTok sin implementar" };
  }

  async sendMessage(): Promise<never> {
    throw new ChannelSendError("El envío por TikTok todavía no está implementado.", false);
  }

  getWindowStatus = windowStatusFromCompliance;
}
