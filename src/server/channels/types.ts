import { z } from "zod";
import type { Database } from "@/db/client";
import type { SocialChannel } from "@/server/compliance/channels";
import {
  getWindowStatus,
  type WindowInput,
  type WindowStatus,
} from "@/server/compliance/messaging-window";

export type ChannelProvider = "meta" | "tiktok";

/** Proveedor oficial de cada canal de mensajería. */
export const CHANNEL_PROVIDER: Record<SocialChannel, ChannelProvider> = {
  instagram: "meta",
  facebook: "meta",
  whatsapp: "meta",
  tiktok: "tiktok",
};

/**
 * Mensaje entrante normalizado. Es lo único que viaja del webhook al worker
 * (payload del job), validado con Zod en ambos lados.
 */
export const inboundMessageSchema = z.object({
  provider: z.enum(["meta", "tiktok"]),
  channel: z.enum(["instagram", "facebook", "whatsapp", "tiktok"]),
  /** true si vino del adapter mock: solo se asocia a cuentas de prueba. */
  mock: z.boolean(),
  /** Cuenta del negocio que recibió el mensaje (IG id, page id, phone_number_id…). */
  accountExternalId: z.string().min(1).max(200),
  /** Id del remitente en la plataforma (IGSID, PSID, wa_id…). */
  senderId: z.string().min(1).max(200),
  senderHandle: z.string().max(100).nullable(),
  senderPhone: z.string().max(30).nullable(),
  senderName: z.string().max(200).nullable(),
  externalMessageId: z.string().min(1).max(300),
  text: z.string().max(10_000),
  sentAt: z.iso.datetime(),
});
export type InboundMessage = z.infer<typeof inboundMessageSchema>;

export interface WebhookRequest {
  method: "GET" | "POST";
  headers: Headers;
  query: URLSearchParams;
  /** Cuerpo crudo: la firma se calcula sobre los bytes, nunca sobre el JSON re-serializado. */
  rawBody: string;
}

export type WebhookResult =
  /** Handshake de suscripción (Meta): devolver `body` tal cual con 200. */
  | { kind: "challenge"; body: string }
  | { kind: "messages"; messages: InboundMessage[] }
  | { kind: "rejected"; status: 400 | 401 | 403 | 501; reason: string };

export interface ConnectInput {
  db: Database;
  organizationId: string;
  userId: string;
  channel: SocialChannel;
  encryptionKey: string;
}

export type ConnectResult =
  | { kind: "redirect"; url: string }
  | { kind: "connected"; accountId: string }
  | { kind: "unavailable"; reason: string };

export interface SendTarget {
  channel: SocialChannel;
  /** Cuenta del negocio que envía. */
  accountExternalId: string;
  accessToken: string;
  /** Destinatario: id de la plataforma (IGSID, PSID, wa_id…). */
  recipientId: string;
}

/**
 * Interfaz común de todos los canales con API oficial. Ningún adapter decide
 * SI se puede enviar: eso lo hace `decideOutbound()` antes de llamar a `sendMessage`.
 */
export interface ChannelAdapter {
  /** Proveedor real; el mock simula a los dos. */
  readonly provider: ChannelProvider | "mock";
  readonly mock: boolean;
  readonly channels: readonly SocialChannel[];
  connect(input: ConnectInput): Promise<ConnectResult>;
  receiveWebhook(req: WebhookRequest): WebhookResult;
  sendMessage(target: SendTarget, text: string): Promise<{ externalMessageId: string }>;
  getWindowStatus(input: WindowInput): WindowStatus;
}

/** Error de envío del proveedor. `retryable` decide si el job se reintenta. */
export class ChannelSendError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ChannelSendError";
  }
}

/** Las ventanas viven en compliance (única fuente); los adapters solo delegan. */
export const windowStatusFromCompliance = getWindowStatus;
