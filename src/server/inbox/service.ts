import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { DbExecutor } from "@/db/rls";
import { conversations, messages, prospectHandles, prospects } from "@/db/schema";
import type { Channel } from "@/server/compliance/channels";
import { getWindowStatus, type WindowStatus } from "@/server/compliance/messaging-window";
import { CHANNEL_LABELS } from "@/server/prospects/profile-url";

export const INBOX_PAGE_SIZE = 50;

/** Nombre visible del contacto con lo que haya. */
export function contactName(p: {
  fullName: string | null;
  company: string | null;
  handle: string | null;
  phone: string | null;
  email: string | null;
  channel: Channel;
}) {
  return (
    p.fullName ??
    p.company ??
    (p.handle ? `@${p.handle}` : null) ??
    p.phone ??
    p.email ??
    `Contacto de ${CHANNEL_LABELS[p.channel]}`
  );
}

const handleFor = sql<string | null>`(
  select ${prospectHandles.handle} from ${prospectHandles}
  where ${prospectHandles.prospectId} = ${conversations.prospectId}
    and ${prospectHandles.channel} = ${conversations.channel}
    and ${prospectHandles.handle} is not null
  limit 1)`;

/** Conversaciones con al menos un mensaje, la más reciente primero. */
export async function listConversations(db: DbExecutor, organizationId: string, now = new Date()) {
  const last = db
    .select({
      conversationId: messages.conversationId,
      body: messages.body,
      direction: messages.direction,
      sentAt: messages.sentAt,
      rn: sql<number>`row_number() over (partition by ${messages.conversationId} order by ${messages.sentAt} desc)`.as(
        "rn",
      ),
    })
    .from(messages)
    .where(eq(messages.organizationId, organizationId))
    .as("last");
  const rows = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      prospectId: conversations.prospectId,
      campaignId: conversations.campaignId,
      lastInboundAt: conversations.lastInboundAt,
      businessMessagesSinceInbound: conversations.businessMessagesSinceInbound,
      fullName: prospects.fullName,
      company: prospects.company,
      phone: prospects.phone,
      email: prospects.email,
      handle: handleFor,
      lastBody: last.body,
      lastDirection: last.direction,
      lastAt: last.sentAt,
    })
    .from(conversations)
    .innerJoin(prospects, eq(prospects.id, conversations.prospectId))
    .innerJoin(last, and(eq(last.conversationId, conversations.id), eq(last.rn, 1)))
    .where(eq(conversations.organizationId, organizationId))
    .orderBy(desc(last.sentAt))
    .limit(INBOX_PAGE_SIZE);
  return rows.map((r) => ({
    ...r,
    name: contactName(r),
    window: windowOf(r, now),
  }));
}

function windowOf(
  r: { channel: Channel; lastInboundAt: Date | null; businessMessagesSinceInbound: number },
  now: Date,
): WindowStatus {
  return getWindowStatus({
    channel: r.channel,
    lastInboundAt: r.lastInboundAt,
    businessMessagesSinceInbound: r.businessMessagesSinceInbound,
    now,
  });
}

export async function getConversation(
  db: DbExecutor,
  organizationId: string,
  conversationId: string,
  now = new Date(),
) {
  const [conv] = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      prospectId: conversations.prospectId,
      campaignId: conversations.campaignId,
      lastInboundAt: conversations.lastInboundAt,
      businessMessagesSinceInbound: conversations.businessMessagesSinceInbound,
      fullName: prospects.fullName,
      company: prospects.company,
      phone: prospects.phone,
      email: prospects.email,
      source: prospects.source,
      handle: handleFor,
    })
    .from(conversations)
    .innerJoin(prospects, eq(prospects.id, conversations.prospectId))
    .where(
      and(eq(conversations.organizationId, organizationId), eq(conversations.id, conversationId)),
    );
  if (!conv) return null;
  const list = await db
    .select({
      id: messages.id,
      direction: messages.direction,
      author: messages.author,
      body: messages.body,
      sentAt: messages.sentAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(asc(messages.sentAt), asc(messages.createdAt))
    .limit(500);
  return { ...conv, name: contactName(conv), window: windowOf(conv, now), messages: list };
}

/** Texto corto del estado de la ventana para la UI. */
export function windowLabel(w: WindowStatus, now = new Date()): string | null {
  switch (w.kind) {
    case "not_applicable":
      return null;
    case "open": {
      const hours = Math.max(1, Math.ceil((w.expiresAt.getTime() - now.getTime()) / 3_600_000));
      const cap = w.remainingMessages !== null ? ` · quedan ${w.remainingMessages} mensajes` : "";
      return `Ventana abierta · vence en ${hours} h${cap}`;
    }
    case "closed":
      if (w.reason === "no_inbound") return "Sin mensajes del contacto";
      if (w.reason === "message_cap") return "Tope de mensajes alcanzado: solo tarea manual";
      return "Ventana vencida: solo tarea manual";
  }
}
