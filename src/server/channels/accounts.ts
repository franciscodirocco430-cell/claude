import { randomUUID } from "node:crypto";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import type { DbExecutor } from "@/db/rls";
import { campaigns, connectedAccounts, connectedAccountSecrets } from "@/db/schema";
import type { SocialChannel } from "@/server/compliance/channels";
import { DomainError } from "@/server/errors";
import { enqueueInboundMessages } from "./inbound";
import { buildMockWebhook, MOCK_SIGNATURE_HEADER } from "./mock";
import type { ChannelAdapters } from "./registry";
import type { InboundMessage } from "./types";

const mockFlag = sql<boolean>`coalesce((${connectedAccounts.settings}->>'mock')::boolean, false)`;

/** Cuentas de mensajería (todo menos email) de la organización. */
export async function listChannelAccounts(db: DbExecutor, organizationId: string) {
  return db
    .select({
      id: connectedAccounts.id,
      provider: connectedAccounts.provider,
      channel: connectedAccounts.channel,
      externalId: connectedAccounts.externalId,
      displayName: connectedAccounts.displayName,
      status: connectedAccounts.status,
      mock: mockFlag,
      defaultCampaignId: sql<string | null>`${connectedAccounts.settings}->>'defaultCampaignId'`,
      createdAt: connectedAccounts.createdAt,
    })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.organizationId, organizationId),
        ne(connectedAccounts.channel, "email"),
        eq(connectedAccounts.status, "active"),
      ),
    )
    .orderBy(asc(connectedAccounts.channel), asc(connectedAccounts.createdAt));
}

/** Cuenta de prueba (solo con CHANNELS_MOCK=true, fuera de producción). */
export async function connectMockAccount(
  db: Database,
  adapters: ChannelAdapters,
  input: { organizationId: string; userId: string; channel: SocialChannel; encryptionKey: string },
) {
  if (!adapters.mock) {
    throw new DomainError("mock_disabled", "Las cuentas de prueba no están habilitadas.");
  }
  const result = await adapters.mock.connect({ db, ...input });
  if (result.kind !== "connected") throw new DomainError("connect_failed", "No se pudo conectar.");
  return result.accountId;
}

/** Desconecta: la cuenta queda revocada y los tokens se borran. */
export async function disconnectChannelAccount(
  db: Database,
  input: { organizationId: string; accountId: string },
) {
  await db.transaction(async (tx) => {
    const [account] = await tx
      .update(connectedAccounts)
      .set({ status: "revoked" })
      .where(
        and(
          eq(connectedAccounts.organizationId, input.organizationId),
          eq(connectedAccounts.id, input.accountId),
          ne(connectedAccounts.channel, "email"),
        ),
      )
      .returning({ id: connectedAccounts.id });
    if (!account) throw new DomainError("not_found", "La cuenta no existe.");
    await tx
      .delete(connectedAccountSecrets)
      .where(eq(connectedAccountSecrets.connectedAccountId, account.id));
  });
}

/**
 * Simulador: arma un webhook mock firmado y lo pasa por el MISMO camino que un
 * webhook real (verificación de firma → normalización → job → asociación).
 */
export async function simulateInboundMessage(
  db: Database,
  adapters: ChannelAdapters,
  input: {
    organizationId: string;
    accountId: string;
    secret: string;
    from: { handle: string | null; phone: string | null; name: string | null };
    text: string;
    now?: Date;
  },
): Promise<InboundMessage> {
  if (!adapters.mock) {
    throw new DomainError("mock_disabled", "El simulador no está habilitado.");
  }
  const [account] = await db
    .select({ channel: connectedAccounts.channel, externalId: connectedAccounts.externalId })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.organizationId, input.organizationId),
        eq(connectedAccounts.id, input.accountId),
        eq(connectedAccounts.status, "active"),
        sql`${mockFlag}`,
      ),
    );
  if (!account || account.channel === "email" || !account.channel) {
    throw new DomainError("not_found", "Solo se puede simular sobre una cuenta de prueba activa.");
  }
  // El id del remitente es estable por handle/teléfono: mensajes del mismo
  // "contacto" caen en la misma conversación, como en la plataforma real.
  const senderKey = input.from.handle ?? input.from.phone ?? input.from.name ?? "anon";
  const { rawBody, signature } = buildMockWebhook(
    {
      channel: account.channel,
      accountId: account.externalId,
      from: {
        id: `sim-${Buffer.from(senderKey.toLowerCase()).toString("hex").slice(0, 40)}`,
        handle: input.from.handle,
        phone: input.from.phone,
        name: input.from.name,
      },
      messageId: `sim-${randomUUID()}`,
      text: input.text,
      timestamp: (input.now ?? new Date()).toISOString(),
    },
    input.secret,
  );
  const result = adapters.mock.receiveWebhook({
    method: "POST",
    headers: new Headers({ [MOCK_SIGNATURE_HEADER]: signature }),
    query: new URLSearchParams(),
    rawBody,
  });
  if (result.kind !== "messages" || !result.messages[0]) {
    throw new DomainError("simulation_failed", "No se pudo simular el mensaje.");
  }
  await enqueueInboundMessages(db, result.messages);
  return result.messages[0];
}

/** Campaña a la que entran los contactos nuevos que escriben a esta cuenta. */
export async function setDefaultCampaign(
  db: DbExecutor,
  input: { organizationId: string; accountId: string; campaignId: string | null },
) {
  if (input.campaignId) {
    const [c] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(
        and(eq(campaigns.organizationId, input.organizationId), eq(campaigns.id, input.campaignId)),
      );
    if (!c) throw new DomainError("not_found", "La campaña no existe.");
  }
  const patch = input.campaignId
    ? sql`${connectedAccounts.settings} || jsonb_build_object('defaultCampaignId', ${input.campaignId}::text)`
    : sql`${connectedAccounts.settings} - 'defaultCampaignId'`;
  const [row] = await db
    .update(connectedAccounts)
    .set({ settings: patch })
    .where(
      and(
        eq(connectedAccounts.organizationId, input.organizationId),
        eq(connectedAccounts.id, input.accountId),
        ne(connectedAccounts.channel, "email"),
      ),
    )
    .returning({ id: connectedAccounts.id });
  if (!row) throw new DomainError("not_found", "La cuenta no existe.");
}
