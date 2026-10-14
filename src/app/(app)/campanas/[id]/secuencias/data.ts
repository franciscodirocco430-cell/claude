import "server-only";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import type { DbExecutor } from "@/db/rls";
import { prospects } from "@/db/schema";
import { listMailboxes } from "@/server/google/mailboxes";

/** Datos para el editor: casillas y prospectos con email (para la vista previa). */
export async function editorData(db: DbExecutor, organizationId: string, campaignId: string) {
  const [mailboxes, rows] = await Promise.all([
    listMailboxes(db, organizationId),
    db
      .select({
        id: prospects.id,
        fullName: prospects.fullName,
        company: prospects.company,
        email: prospects.email,
      })
      .from(prospects)
      .where(
        and(
          eq(prospects.organizationId, organizationId),
          eq(prospects.campaignId, campaignId),
          isNotNull(prospects.email),
        ),
      )
      .orderBy(asc(prospects.createdAt))
      .limit(50),
  ]);
  return {
    mailboxes: mailboxes.map((m) => ({ id: m.id, email: m.email, status: m.status })),
    prospects: rows.map((p) => ({
      id: p.id,
      label: `${p.fullName ?? p.company ?? "Sin nombre"} — ${p.email}`,
    })),
  };
}
