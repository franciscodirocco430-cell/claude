import { and, eq, sql } from "drizzle-orm";
import type { DbExecutor } from "@/db/rls";
import { campaigns, connectedAccounts } from "@/db/schema";
import { isAdminRole, type Role } from "@/server/auth/permissions";
import { DomainError } from "@/server/errors";
import type { AgentSettings } from "./settings";

/** Guarda la configuración del agente de una campaña (owner/admin; RLS además lo exige). */
export async function updateAgentSettings(
  db: DbExecutor,
  input: { organizationId: string; campaignId: string; actorRole: Role; settings: AgentSettings },
) {
  if (!isAdminRole(input.actorRole)) {
    throw new DomainError("forbidden", "Solo owners y admins pueden configurar el agente.");
  }
  if (input.settings.calendarAccountId) {
    const [cal] = await db
      .select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.organizationId, input.organizationId),
          eq(connectedAccounts.id, input.settings.calendarAccountId),
          eq(connectedAccounts.status, "active"),
          sql`${connectedAccounts.settings}->>'kind' = 'calendar'`,
        ),
      );
    if (!cal) throw new DomainError("invalid_calendar", "Elegí un calendario conectado.");
  }
  const [row] = await db
    .update(campaigns)
    .set({ agentSettings: input.settings })
    .where(
      and(eq(campaigns.organizationId, input.organizationId), eq(campaigns.id, input.campaignId)),
    )
    .returning({ id: campaigns.id });
  if (!row) throw new DomainError("not_found", "La campaña no existe.");
}
