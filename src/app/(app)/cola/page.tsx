import { ListTodo, PartyPopper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { withUserContext } from "@/db/rls";
import { cn } from "@/lib/utils";
import { requireAppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { CHANNEL_LABELS } from "@/server/prospects/profile-url";
import { getOrganizationTimeZone, getQueueState } from "@/server/queue/service";
import { QueueWorkspace } from "./queue-workspace";

export const metadata: Metadata = { title: "Cola" };

export default async function QueuePage() {
  const ctx = await requireAppContext();
  const state = await withUserContext(getDb(), { sub: ctx.user.id }, async (tx) =>
    getQueueState(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.user.id,
      timeZone: await getOrganizationTimeZone(tx, ctx.organizationId),
    }),
  );

  return (
    <>
      <PageHeader
        title="Cola de tareas"
        description="Abrí el chat, pegá el mensaje y envialo vos. Una tarea por vez."
      />
      {state.counters.length ? (
        <section aria-label="Enviados hoy" className="mb-4 flex flex-wrap gap-2">
          {state.counters.map((c) => (
            <span
              key={`${c.campaignId}-${c.channel}`}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                c.sent >= c.limit
                  ? "border-destructive/40 text-destructive"
                  : "text-muted-foreground",
              )}
              title={c.campaignName}
            >
              {CHANNEL_LABELS[c.channel]} · {c.campaignName}:{" "}
              <strong className="tabular-nums">
                {c.sent}/{c.limit}
              </strong>
            </span>
          ))}
        </section>
      ) : null}

      {state.task ? (
        <QueueWorkspace key={state.task.id} task={state.task} />
      ) : state.limitReached ? (
        <EmptyState
          icon={PartyPopper}
          title="Llegaste al tope de hoy"
          description="Quedan tareas, pero alcanzaste el límite diario de mensajes de esos canales. Mañana seguís."
        />
      ) : (
        <EmptyState
          icon={ListTodo}
          title="No tenés tareas pendientes"
          description="Cuando la IA prepare mensajes en una campaña activa, van a aparecer acá."
          action={
            <Button asChild variant="outline">
              <Link href="/campanas">Ir a campañas</Link>
            </Button>
          }
        />
      )}
    </>
  );
}
