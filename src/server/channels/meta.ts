import { z } from "zod";
import type { SocialChannel } from "@/server/compliance/channels";
import { safeEqualText, verifySha256Header } from "./signature";
import {
  ChannelSendError,
  windowStatusFromCompliance,
  type ChannelAdapter,
  type ConnectResult,
  type InboundMessage,
  type SendTarget,
  type WebhookRequest,
  type WebhookResult,
} from "./types";

export interface MetaConfig {
  appSecret: string;
  verifyToken: string;
  /** Base versionada de la Graph API (ej. https://graph.facebook.com/vXX.0). */
  graphApiUrl: string | null;
}

/** Texto que se guarda cuando el mensaje no trae texto (foto, audio, sticker…). */
export const ATTACHMENT_PLACEHOLDER = "[Adjunto sin texto]";

// Payloads de webhooks de Meta: solo los campos que usamos. Todo lo demás se ignora.
const messagingEvent = z.object({
  sender: z.object({ id: z.string() }),
  recipient: z.object({ id: z.string() }),
  timestamp: z.number(),
  message: z
    .object({
      mid: z.string(),
      text: z.string().optional(),
      is_echo: z.boolean().optional(),
      attachments: z.array(z.unknown()).optional(),
    })
    .optional(),
});

const pageOrInstagramPayload = z.object({
  object: z.enum(["page", "instagram"]),
  entry: z.array(
    z.object({
      id: z.string(),
      messaging: z.array(z.unknown()).optional(),
    }),
  ),
});

const whatsappPayload = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            metadata: z.object({ phone_number_id: z.string() }).optional(),
            contacts: z
              .array(
                z.object({
                  wa_id: z.string(),
                  profile: z.object({ name: z.string().optional() }).optional(),
                }),
              )
              .optional(),
            messages: z.array(z.unknown()).optional(),
          }),
        }),
      ),
    }),
  ),
});

const whatsappMessage = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
});

/**
 * Convierte un webhook de Meta (Instagram Messaging, Messenger o WhatsApp Cloud
 * API) en mensajes entrantes normalizados. Ignora ecos (mensajes que mandó el
 * propio negocio), lecturas, reacciones y estados de entrega.
 */
export function parseMetaWebhook(body: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];

  const social = pageOrInstagramPayload.safeParse(body);
  if (social.success) {
    const channel: SocialChannel = social.data.object === "instagram" ? "instagram" : "facebook";
    for (const entry of social.data.entry) {
      for (const raw of entry.messaging ?? []) {
        const ev = messagingEvent.safeParse(raw);
        if (!ev.success || !ev.data.message || ev.data.message.is_echo) continue;
        const text =
          ev.data.message.text ??
          (ev.data.message.attachments?.length ? ATTACHMENT_PLACEHOLDER : "");
        if (!text) continue;
        out.push({
          provider: "meta",
          channel,
          mock: false,
          accountExternalId: entry.id,
          senderId: ev.data.sender.id,
          // Meta no manda el usuario en el webhook: se asocia por id de conversación.
          senderHandle: null,
          senderPhone: null,
          senderName: null,
          externalMessageId: ev.data.message.mid,
          text,
          sentAt: new Date(ev.data.timestamp).toISOString(),
        });
      }
    }
    return out;
  }

  const wa = whatsappPayload.safeParse(body);
  if (wa.success) {
    for (const entry of wa.data.entry) {
      for (const change of entry.changes) {
        const { value } = change;
        if (change.field !== "messages" || !value.metadata) continue;
        const names = new Map(
          (value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null] as const),
        );
        for (const raw of value.messages ?? []) {
          const msg = whatsappMessage.safeParse(raw);
          if (!msg.success) continue;
          const seconds = Number(msg.data.timestamp);
          if (!Number.isFinite(seconds)) continue;
          out.push({
            provider: "meta",
            channel: "whatsapp",
            mock: false,
            accountExternalId: value.metadata.phone_number_id,
            senderId: msg.data.from,
            senderHandle: null,
            senderPhone: `+${msg.data.from.replace(/\D/g, "")}`,
            senderName: names.get(msg.data.from) ?? null,
            externalMessageId: msg.data.id,
            text:
              msg.data.type === "text" && msg.data.text
                ? msg.data.text.body
                : ATTACHMENT_PLACEHOLDER,
            sentAt: new Date(seconds * 1000).toISOString(),
          });
        }
      }
    }
  }
  return out;
}

/**
 * Meta: Instagram Messaging, Messenger y WhatsApp Cloud API.
 *
 * Verificado contra la documentación: handshake GET (`hub.mode`, `hub.verify_token`,
 * `hub.challenge`) y firma `X-Hub-Signature-256: sha256=<HMAC-SHA256(app secret, cuerpo crudo)>`.
 * El envío solo se probó contra fixtures: no hay app aprobada todavía.
 */
export class MetaAdapter implements ChannelAdapter {
  readonly provider = "meta" as const;
  readonly mock = false;
  readonly channels = ["instagram", "facebook", "whatsapp"] as const;

  constructor(
    private readonly config: MetaConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async connect(): Promise<ConnectResult> {
    // El alta real es Facebook Login for Business + permisos aprobados en la revisión
    // de la app. Hasta tener la app aprobada, solo se conectan cuentas de prueba (mock).
    return {
      kind: "unavailable",
      reason:
        "La conexión con Meta requiere una app aprobada por Meta. Todavía no está disponible.",
    };
  }

  receiveWebhook(req: WebhookRequest): WebhookResult {
    if (req.method === "GET") {
      const mode = req.query.get("hub.mode");
      const token = req.query.get("hub.verify_token") ?? "";
      const challenge = req.query.get("hub.challenge") ?? "";
      if (mode === "subscribe" && challenge && safeEqualText(token, this.config.verifyToken)) {
        return { kind: "challenge", body: challenge };
      }
      return { kind: "rejected", status: 403, reason: "verify_token inválido" };
    }
    const signature = req.headers.get("x-hub-signature-256");
    if (!verifySha256Header(signature, this.config.appSecret, req.rawBody)) {
      return { kind: "rejected", status: 401, reason: "firma inválida" };
    }
    let body: unknown;
    try {
      body = JSON.parse(req.rawBody);
    } catch {
      return { kind: "rejected", status: 400, reason: "JSON inválido" };
    }
    return { kind: "messages", messages: parseMetaWebhook(body) };
  }

  async sendMessage(target: SendTarget, text: string) {
    if (!this.config.graphApiUrl) {
      throw new ChannelSendError("Falta META_GRAPH_API_URL para enviar por Meta.", false);
    }
    const base = this.config.graphApiUrl.replace(/\/$/, "");
    const isWhatsapp = target.channel === "whatsapp";
    const url = isWhatsapp
      ? `${base}/${encodeURIComponent(target.accountExternalId)}/messages`
      : `${base}/me/messages`;
    const body = isWhatsapp
      ? {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: target.recipientId,
          type: "text",
          text: { body: text },
        }
      : {
          recipient: { id: target.recipientId },
          messaging_type: "RESPONSE",
          message: { text },
        };
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${target.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => null)) as {
      message_id?: string;
      messages?: { id?: string }[];
      error?: { message?: string };
    } | null;
    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      throw new ChannelSendError(
        `Meta respondió ${res.status}: ${json?.error?.message ?? "sin detalle"}`,
        retryable,
      );
    }
    const id = isWhatsapp ? json?.messages?.[0]?.id : json?.message_id;
    if (!id) throw new ChannelSendError("Meta no devolvió el id del mensaje.", false);
    return { externalMessageId: id };
  }

  getWindowStatus = windowStatusFromCompliance;
}
