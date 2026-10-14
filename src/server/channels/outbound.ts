import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  connectedAccounts,
  connectedAccountSecrets,
  conversations,
  messages,
  outreachTasks,
  prospectHandles,
  prospects,
  suppressionList,
} from "@/db/schema";
import { decryptSecret } from "@/lib/crypto/tokens";
import { isSocialChannel } from "@/server/compliance/channels";
import { getWindowStatus } from "@/server/compliance/messaging-window";
import { decideOutbound, type OutboundDecision } from "@/server/compliance/outbound-policy";
import { adapterForAccount, type ChannelAdapters } from "./registry";
import { ChannelSendError } from "./types";

export interface OutboundDeps {
  db: Database;
  adapters: ChannelAdapters;
  encryptionKey: string;
  now?: Date;
}

export interface OutboundRequest {
  organizationId: string;
  conversationId: string;
  text: string;
  author: "ai" | "human";
  userId?: string | null;
  aiRunId?: string | null;
}

export type OutboundResult =
  | { status: "sent"; messageId: string; externalMessageId: string }
  /** No se envió: `decision` dice por qué (tarea manual, plantilla de WhatsApp, supresión). */
  | { status: "not_sent"; decision: Exclude<OutboundDecision, { action: "auto_send" }> };

/**
 * Envía un mensaje por un canal con API oficial. ÚNICO camino de envío automático
 * por redes: siempre pasa por `decideOutbound()` (ventana, tope de TikTok,
 * supresión). Si la ventana venció, deja una tarea manual para el setter con el
 * texto, nunca envía.
 *
 * La conversación queda bloqueada (`FOR UPDATE`) durante el envío: dos envíos
 * simultáneos no pueden pasarse del tope de mensajes de la ventana.
 */
export async function sendConversationMessage(
  deps: OutboundDeps,
  req: OutboundRequest,
): Promise<OutboundResult> {
  const now = deps.now ?? new Date();
  const text = req.text.trim();
  if (!text) throw new ChannelSendError("El mensaje está vacío.", false);

  return deps.db.transaction(async (tx) => {
    const [conv] = await tx
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, req.organizationId),
          eq(conversations.id, req.conversationId),
        ),
      )
      .for("update");
    if (!conv) throw new ChannelSendError("La conversación no existe.", false);
    const channel = conv.channel;
    if (!isSocialChannel(channel)) {
      throw new ChannelSendError("El email se envía desde las secuencias.", false);
    }

    const [prospect] = await tx
      .select({ phone: prospects.phone, optIn: prospects.whatsappOptIn })
      .from(prospects)
      .where(eq(prospects.id, conv.prospectId));
    const handles = await tx
      .select({ handle: prospectHandles.handle })
      .from(prospectHandles)
      .where(
        and(eq(prospectHandles.prospectId, conv.prospectId), eq(prospectHandles.channel, channel)),
      );
    const values = [
      ...(channel === "whatsapp" && prospect?.phone ? [prospect.phone] : []),
      ...handles.flatMap((h) => (h.handle ? [h.handle] : [])),
    ];
    const suppressed =
      values.length > 0 &&
      (
        await tx
          .select({ id: suppressionList.id })
          .from(suppressionList)
          .where(
            and(
              eq(suppressionList.organizationId, req.organizationId),
              inArray(suppressionList.value, values),
            ),
          )
          .limit(1)
      ).length > 0;

    const [account] = conv.connectedAccountId
      ? await tx
          .select({
            id: connectedAccounts.id,
            externalId: connectedAccounts.externalId,
            status: connectedAccounts.status,
            mock: sql<boolean>`coalesce((${connectedAccounts.settings}->>'mock')::boolean, false)`,
          })
          .from(connectedAccounts)
          .where(eq(connectedAccounts.id, conv.connectedAccountId))
      : [];
    const adapter = account
      ? adapterForAccount(deps.adapters, { channel, mock: account.mock })
      : null;

    // Sin adapter (cuenta desconectada) igual se calcula la ventana para decidir la tarea manual.
    const window = (adapter?.getWindowStatus ?? getWindowStatus)({
      channel,
      lastInboundAt: conv.lastInboundAt,
      businessMessagesSinceInbound: conv.businessMessagesSinceInbound,
      now,
    });
    const decision = decideOutbound({
      channel,
      window,
      suppressed,
      whatsappOptIn: !!prospect?.optIn,
    });

    if (decision.action !== "auto_send") {
      if (decision.action === "manual_task") {
        // Una sola tarea abierta por prospecto y canal (índice único parcial).
        await tx
          .insert(outreachTasks)
          .values({
            organizationId: req.organizationId,
            campaignId: conv.campaignId,
            prospectId: conv.prospectId,
            channel,
            draftMessage: text,
            status: "ready",
            assignedTo: conv.assignedTo,
          })
          .onConflictDoNothing();
      }
      return { status: "not_sent", decision };
    }

    if (!account || account.status !== "active" || !adapter || !conv.externalThreadId) {
      throw new ChannelSendError("La conversación no tiene una cuenta conectada activa.", false);
    }
    const [secret] = await tx
      .select({ access: connectedAccountSecrets.accessTokenEnc })
      .from(connectedAccountSecrets)
      .where(eq(connectedAccountSecrets.connectedAccountId, account.id));
    if (!secret) throw new ChannelSendError("Faltan los tokens de la cuenta conectada.", false);
    const accessToken = decryptSecret(secret.access, deps.encryptionKey, `${account.id}:access`);
    // externalThreadId = "<cuenta>:<remitente>" (ver threadIdFor).
    const recipientId = conv.externalThreadId.slice(account.externalId.length + 1);

    const sent = await adapter.sendMessage(
      { channel, accountExternalId: account.externalId, accessToken, recipientId },
      text,
    );
    const [row] = await tx
      .insert(messages)
      .values({
        organizationId: req.organizationId,
        conversationId: conv.id,
        direction: "out",
        author: req.author,
        body: text,
        sentByUserId: req.userId ?? null,
        aiRunId: req.aiRunId ?? null,
        externalId: sent.externalMessageId,
        sentAt: now,
      })
      .returning({ id: messages.id });
    await tx
      .update(conversations)
      .set({
        lastOutboundAt: now,
        businessMessagesSinceInbound: sql`${conversations.businessMessagesSinceInbound} + 1`,
      })
      .where(eq(conversations.id, conv.id));
    return { status: "sent", messageId: row!.id, externalMessageId: sent.externalMessageId };
  });
}
