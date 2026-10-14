import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { connectedAccounts, connectedAccountSecrets } from "@/db/schema";
import { encryptSecret } from "@/lib/crypto/tokens";
import { SOCIAL_CHANNELS, type SocialChannel } from "@/server/compliance/channels";
import { CHANNEL_LABELS } from "@/server/prospects/profile-url";
import { hmacSha256Hex, verifySha256Header } from "./signature";
import {
  CHANNEL_PROVIDER,
  windowStatusFromCompliance,
  type ChannelAdapter,
  type ConnectInput,
  type ConnectResult,
  type SendTarget,
  type WebhookRequest,
  type WebhookResult,
} from "./types";

export const MOCK_SIGNATURE_HEADER = "x-mock-signature";

/** Formato propio del mock: simple a propósito, no imita a ningún proveedor. */
export const mockWebhookSchema = z.object({
  channel: z.enum(SOCIAL_CHANNELS),
  accountId: z.string().min(1).max(200),
  from: z.object({
    id: z.string().min(1).max(200),
    handle: z.string().max(100).nullish(),
    phone: z.string().max(30).nullish(),
    name: z.string().max(200).nullish(),
  }),
  messageId: z.string().min(1).max(300),
  text: z.string().min(1).max(10_000),
  timestamp: z.iso.datetime(),
});
export type MockWebhook = z.infer<typeof mockWebhookSchema>;

/** Arma un webhook mock firmado (simulador de Configuración y tests). */
export function buildMockWebhook(payload: MockWebhook, secret: string) {
  const rawBody = JSON.stringify(payload);
  return { rawBody, signature: `sha256=${hmacSha256Hex(secret, rawBody)}` };
}

/** Mensajes "enviados" por el mock (solo memoria del proceso, para tests). */
export const mockOutbox: { target: SendTarget; text: string; externalMessageId: string }[] = [];

/**
 * Adapter de prueba para los cuatro canales mientras no haya apps aprobadas.
 * Usa el mismo camino que los reales (firma → normalización → job → asociación)
 * y las mismas reglas de ventana. Prohibido en producción (ver registry).
 */
export class MockChannelAdapter implements ChannelAdapter {
  readonly provider = "mock" as const;
  readonly mock = true;
  readonly channels = SOCIAL_CHANNELS;

  constructor(private readonly secret: string) {}

  async connect(input: ConnectInput): Promise<ConnectResult> {
    const externalId = `mock-${input.channel}-${randomBytes(4).toString("hex")}`;
    const accountId = await input.db.transaction(async (tx) => {
      const [account] = await tx
        .insert(connectedAccounts)
        .values({
          organizationId: input.organizationId,
          provider: CHANNEL_PROVIDER[input.channel],
          channel: input.channel,
          externalId,
          displayName: `Cuenta de prueba de ${CHANNEL_LABELS[input.channel]}`,
          status: "active",
          settings: { mock: true },
          connectedBy: input.userId,
        })
        .returning({ id: connectedAccounts.id });
      const id = account!.id;
      await tx.insert(connectedAccountSecrets).values({
        connectedAccountId: id,
        organizationId: input.organizationId,
        accessTokenEnc: encryptSecret(`mock-token-${id}`, input.encryptionKey, `${id}:access`),
      });
      return id;
    });
    return { kind: "connected", accountId };
  }

  receiveWebhook(req: WebhookRequest): WebhookResult {
    if (req.method !== "POST") return { kind: "rejected", status: 400, reason: "método inválido" };
    if (!verifySha256Header(req.headers.get(MOCK_SIGNATURE_HEADER), this.secret, req.rawBody)) {
      return { kind: "rejected", status: 401, reason: "firma inválida" };
    }
    let parsed;
    try {
      parsed = mockWebhookSchema.safeParse(JSON.parse(req.rawBody));
    } catch {
      return { kind: "rejected", status: 400, reason: "JSON inválido" };
    }
    if (!parsed.success) return { kind: "rejected", status: 400, reason: "payload inválido" };
    const p = parsed.data;
    return {
      kind: "messages",
      messages: [
        {
          provider: CHANNEL_PROVIDER[p.channel as SocialChannel],
          channel: p.channel,
          mock: true,
          accountExternalId: p.accountId,
          senderId: p.from.id,
          senderHandle: p.from.handle ?? null,
          senderPhone: p.from.phone ?? null,
          senderName: p.from.name ?? null,
          externalMessageId: p.messageId,
          text: p.text,
          sentAt: p.timestamp,
        },
      ],
    };
  }

  async sendMessage(target: SendTarget, text: string) {
    const externalMessageId = `mock-out-${randomUUID()}`;
    mockOutbox.push({ target, text, externalMessageId });
    return { externalMessageId };
  }

  getWindowStatus = windowStatusFromCompliance;
}
