import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  campaigns,
  connectedAccounts,
  conversations,
  messages,
  prospects,
  suppressionList,
} from "@/db/schema";
import { pauseAgent } from "@/server/agent/agent";
import { parseAgentSettings } from "@/server/agent/settings";
import { sendConversationMessage } from "@/server/channels/outbound";
import type { ChannelAdapters } from "@/server/channels/registry";
import { ChannelSendError } from "@/server/channels/types";
import { getWindowStatus } from "@/server/compliance/messaging-window";
import { decideOutbound } from "@/server/compliance/outbound-policy";
import { composeEmailBody, finalizeEmailBody } from "@/server/email/compose";
import { buildMimeMessage } from "@/server/email/mime";
import { MailProviderError, type MailProvider } from "@/server/email/provider";
import { signUnsubscribeToken } from "@/server/email/unsubscribe";
import { DomainError } from "@/server/errors";

export const MAX_REPLY_CHARS = 2000;

export interface ReplyDeps {
  db: Database;
  adapters: ChannelAdapters;
  encryptionKey: string;
  /** Null si Gmail no está configurado en el servidor. */
  mail: MailProvider | null;
  appUrl: string;
  unsubscribeSecret: string | null;
  now?: Date;
}

export type ReplyResult =
  | { status: "sent" }
  | { status: "manual_task"; message: string }
  | { status: "blocked"; message: string };

/**
 * Respuesta escrita por una persona desde la Bandeja. Respeta las mismas reglas
 * que la IA: redes por `sendConversationMessage()` (ventana vencida → tarea en la
 * Cola, nunca envío), email en el mismo hilo con firma y link de baja.
 * Si la IA estaba activa en la conversación, se pausa: ahora la lleva una persona.
 */
export async function replyManually(
  deps: ReplyDeps,
  input: { organizationId: string; conversationId: string; userId: string; text: string },
): Promise<ReplyResult> {
  const text = input.text.trim();
  if (!text) throw new DomainError("empty", "Escribí un mensaje.");
  if (text.length > MAX_REPLY_CHARS) {
    throw new DomainError(
      "too_long",
      `El mensaje puede tener hasta ${MAX_REPLY_CHARS} caracteres.`,
    );
  }
  const [row] = await deps.db
    .select({ conv: conversations, agentSettings: campaigns.agentSettings })
    .from(conversations)
    .leftJoin(
      campaigns,
      and(
        eq(campaigns.id, conversations.campaignId),
        eq(campaigns.organizationId, conversations.organizationId),
      ),
    )
    .where(
      and(
        eq(conversations.organizationId, input.organizationId),
        eq(conversations.id, input.conversationId),
      ),
    );
  if (!row) throw new DomainError("not_found", "La conversación no existe.");
  const { conv } = row;

  let result: ReplyResult;
  if (conv.channel === "email") {
    result = await replyByEmail(deps, input, conv, text);
  } else {
    let sent;
    try {
      sent = await sendConversationMessage(
        { db: deps.db, adapters: deps.adapters, encryptionKey: deps.encryptionKey, now: deps.now },
        {
          organizationId: input.organizationId,
          conversationId: conv.id,
          text,
          author: "human",
          userId: input.userId,
        },
      );
    } catch (error) {
      if (error instanceof ChannelSendError) throw new DomainError("send_failed", error.message);
      throw error;
    }
    if (sent.status === "sent") {
      result = { status: "sent" };
    } else {
      const d = sent.decision;
      result =
        d.action === "blocked"
          ? {
              status: "blocked",
              message: "El contacto está en la lista de supresión: no se le escribe.",
            }
          : d.action === "whatsapp_template"
            ? {
                status: "blocked",
                message:
                  "La ventana de 24 h de WhatsApp venció: solo se pueden enviar plantillas aprobadas (todavía no disponibles).",
              }
            : {
                status: "manual_task",
                message:
                  d.reason === "first_contact_requires_human"
                    ? "El contacto todavía no escribió: el primer mensaje lo mandás vos desde la Cola."
                    : d.reason === "message_cap_reached"
                      ? "Se alcanzó el tope de mensajes de TikTok en esta ventana. Quedó una tarea en la Cola para escribirle desde la app."
                      : "La ventana para responder por la API venció. Quedó una tarea en la Cola para escribirle desde la app.",
              };
    }
  }

  if (result.status === "sent") {
    // Toma la conversación quien respondió (si nadie la tenía) y la IA se corre.
    await deps.db
      .update(conversations)
      .set({ assignedTo: input.userId })
      .where(and(eq(conversations.id, conv.id), isNull(conversations.assignedTo)));
    if (!conv.aiPaused && row.agentSettings && parseAgentSettings(row.agentSettings).enabled) {
      await pauseAgent(deps.db, {
        organizationId: input.organizationId,
        conversationId: conv.id,
        reason: "Respondió una persona del equipo.",
      });
    }
  }
  return result;
}

async function replyByEmail(
  deps: ReplyDeps,
  input: { organizationId: string; userId: string },
  conv: typeof conversations.$inferSelect,
  text: string,
): Promise<ReplyResult> {
  if (!deps.mail || !deps.unsubscribeSecret) {
    throw new DomainError("email_disabled", "Gmail no está configurado en el servidor.");
  }
  if (!conv.connectedAccountId || !conv.externalThreadId) {
    throw new DomainError("no_thread", "Esta conversación no tiene un hilo de email asociado.");
  }
  const [mailbox] = await deps.db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.id, conv.connectedAccountId));
  if (!mailbox || mailbox.status !== "active") {
    throw new DomainError("mailbox", "La casilla de esta conversación no está conectada.");
  }
  const [prospect] = await deps.db
    .select({ email: prospects.email })
    .from(prospects)
    .where(eq(prospects.id, conv.prospectId));
  const to = prospect?.email;
  if (!to) throw new DomainError("no_email", "El prospecto no tiene email.");

  const suppressed =
    (
      await deps.db
        .select({ id: suppressionList.id })
        .from(suppressionList)
        .where(
          and(
            eq(suppressionList.organizationId, input.organizationId),
            inArray(suppressionList.value, [to]),
          ),
        )
        .limit(1)
    ).length > 0;
  const now = deps.now ?? new Date();
  const decision = decideOutbound({
    channel: "email",
    window: getWindowStatus({
      channel: "email",
      lastInboundAt: null,
      businessMessagesSinceInbound: 0,
      now,
    }),
    suppressed,
    whatsappOptIn: false,
  });
  if (decision.action !== "auto_send") {
    return {
      status: "blocked",
      message: "El contacto está en la lista de supresión: no se le escribe.",
    };
  }

  const ref = { id: mailbox.id, organizationId: mailbox.organizationId, email: mailbox.externalId };
  // Responder en el mismo hilo: asunto "Re:" y referencia al último mensaje.
  const thread = await deps.mail.getThread(ref, conv.externalThreadId).catch(() => []);
  const last = thread.at(-1);
  const baseSubject = (thread[0]?.subject ?? "").replace(/^(re:\s*)+/i, "").trim();
  const token = signUnsubscribeToken({ o: input.organizationId, e: to }, deps.unsubscribeSecret);
  const body = finalizeEmailBody(
    composeEmailBody(text),
    mailbox.signature,
    `${deps.appUrl}/baja/${token}`,
  );
  const raw = buildMimeMessage({
    from: { email: mailbox.externalId, name: mailbox.signature?.split("\n")[0] ?? null },
    to,
    subject: baseSubject ? `Re: ${baseSubject}` : "Re:",
    text: body,
    inReplyTo: last?.rfcMessageId ?? null,
    references: last?.rfcMessageId ?? null,
    listUnsubscribeUrl: `${deps.appUrl}/api/baja/${token}`,
  });
  let sent;
  try {
    sent = await deps.mail.send(ref, { raw, threadId: conv.externalThreadId });
  } catch (error) {
    if (error instanceof MailProviderError) {
      throw new DomainError("send_failed", "Gmail no aceptó el envío. Probá de nuevo en un rato.");
    }
    throw error;
  }
  await deps.db.transaction(async (tx) => {
    await tx.insert(messages).values({
      organizationId: input.organizationId,
      conversationId: conv.id,
      direction: "out",
      author: "human",
      body,
      sentByUserId: input.userId,
      externalId: sent.messageId,
      sentAt: now,
    });
    await tx
      .update(conversations)
      .set({ lastOutboundAt: now })
      .where(eq(conversations.id, conv.id));
  });
  return { status: "sent" };
}
