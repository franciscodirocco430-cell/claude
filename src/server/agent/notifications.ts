import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { DbExecutor } from "@/db/rls";
import { notifications } from "@/db/schema";

export type NotificationKind = "handoff" | "meeting_booked" | "agent_error";

/** Crea un aviso para el equipo (lo escribe el servidor; RLS no deja insertar desde el cliente). */
export async function notify(
  db: DbExecutor,
  input: {
    organizationId: string;
    kind: NotificationKind;
    title: string;
    body?: string | null;
    conversationId?: string | null;
    userId?: string | null;
  },
) {
  await db.insert(notifications).values({
    organizationId: input.organizationId,
    kind: input.kind,
    title: input.title.slice(0, 200),
    body: input.body?.slice(0, 1000) ?? null,
    conversationId: input.conversationId ?? null,
    link: input.conversationId ? `/bandeja/${input.conversationId}` : null,
    userId: input.userId ?? null,
  });
}

/** Avisos sin leer visibles para el usuario (propios o generales). */
export async function listUnreadNotifications(
  db: DbExecutor,
  organizationId: string,
  userId: string,
  limit = 20,
) {
  return db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        isNull(notifications.readAt),
        sql`(${notifications.userId} is null or ${notifications.userId} = ${userId})`,
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function countUnreadNotifications(
  db: DbExecutor,
  organizationId: string,
  userId: string,
) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        isNull(notifications.readAt),
        sql`(${notifications.userId} is null or ${notifications.userId} = ${userId})`,
      ),
    );
  return row?.n ?? 0;
}

/** Al abrir una conversación, sus avisos quedan leídos. */
export async function markConversationNotificationsRead(
  db: DbExecutor,
  organizationId: string,
  conversationId: string,
) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.conversationId, conversationId),
        isNull(notifications.readAt),
      ),
    );
}
