import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { asc, eq } from "drizzle-orm";
import { withUserContext } from "@/db/rls";
import { campaigns, pipelineStages } from "@/db/schema";
import { requireAppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { listUnreadNotifications } from "@/server/agent/notifications";
import { listConversations, parseInboxFilters, windowLabel } from "@/server/inbox/service";
import { listMembers } from "@/server/organizations/service";
import { CHANNEL_LABELS } from "@/server/prospects/profile-url";
import { InboxFiltersForm } from "./inbox-filters";

export const metadata: Metadata = { title: "Bandeja" };

const timeFormat = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireAppContext();
  const now = new Date();
  const filters = parseInboxFilters(await searchParams);
  const data = await withUserContext(getDb(), { sub: ctx.user.id }, async (tx) => ({
    result: await listConversations(tx, ctx.organizationId, {
      filters,
      userId: ctx.user.id,
      now,
    }),
    alerts: await listUnreadNotifications(tx, ctx.organizationId, ctx.user.id),
    campaigns: await tx
      .select({ id: campaigns.id, name: campaigns.name })
      .from(campaigns)
      .where(eq(campaigns.organizationId, ctx.organizationId))
      .orderBy(asc(campaigns.name)),
    stages: await tx
      .select({ key: pipelineStages.key, name: pipelineStages.name })
      .from(pipelineStages)
      .where(eq(pipelineStages.organizationId, ctx.organizationId))
      .orderBy(asc(pipelineStages.position)),
    members: await listMembers(tx, ctx.organizationId),
  }));
  const { result, alerts } = data;
  const list = result.items;
  const hasFilters = Object.entries(filters).some(([k, v]) => k !== "pagina" && v);
  const pageHref = (p: number) => {
    const qs = new URLSearchParams(
      Object.entries({ ...filters, pagina: String(p) }).flatMap(([k, v]) =>
        v ? [[k, String(v)]] : [],
      ),
    );
    return `/bandeja?${qs}`;
  };

  return (
    <>
      <PageHeader
        title="Bandeja"
        description="Todas las conversaciones de todos los canales en un solo lugar."
      />
      <AutoRefresh active intervalMs={5000} />
      {alerts.length ? (
        <section aria-label="Avisos" className="mb-4 grid gap-2">
          {alerts.map((a) => (
            <Link
              key={a.id}
              href={a.link ?? "/bandeja"}
              className="border-destructive/40 bg-destructive/5 hover:bg-destructive/10 grid gap-0.5 rounded-lg border p-3"
            >
              <span className="text-sm font-medium">{a.title}</span>
              {a.body ? (
                <span className="text-muted-foreground line-clamp-2 text-xs">{a.body}</span>
              ) : null}
            </Link>
          ))}
        </section>
      ) : null}
      <InboxFiltersForm
        filters={filters}
        campaigns={data.campaigns}
        stages={data.stages}
        members={data.members.map((m) => ({
          userId: m.userId,
          name: m.fullName ?? m.email ?? "Sin nombre",
        }))}
      />
      {list.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={Inbox}
            title="Ninguna conversación con esos filtros"
            description="Probá con otros filtros o limpialos."
          />
        ) : (
          <EmptyState
            icon={Inbox}
            title="Sin conversaciones todavía"
            description="Las respuestas de tus prospectos por email, Instagram, Messenger, WhatsApp y TikTok van a llegar acá."
          />
        )
      ) : (
        <ul className="divide-y rounded-lg border" aria-label="Conversaciones">
          {list.map((c) => {
            const label = windowLabel(c.window, now);
            return (
              <li key={c.id}>
                <Link
                  href={`/bandeja/${c.id}`}
                  className="hover:bg-muted/50 grid gap-1 p-3 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">{c.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {timeFormat.format(c.lastAt)}
                    </span>
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-sm break-words">
                    {c.lastDirection === "out" ? "Vos: " : ""}
                    {c.lastBody}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{CHANNEL_LABELS[c.channel]}</Badge>
                    {label ? <Badge variant="outline">{label}</Badge> : null}
                    {c.aiPaused ? <Badge variant="destructive">IA pausada</Badge> : null}
                    {c.stageName ? <Badge variant="outline">{c.stageName}</Badge> : null}
                    {c.campaignName ? (
                      <span className="text-muted-foreground text-xs">{c.campaignName}</span>
                    ) : null}
                    {c.assigneeName ? (
                      <span className="text-muted-foreground text-xs">· {c.assigneeName}</span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {result.page > 1 || result.hasMore ? (
        <nav aria-label="Paginación" className="mt-4 flex items-center justify-between gap-2">
          {result.page > 1 ? (
            <Link
              href={pageHref(result.page - 1)}
              className="text-sm underline-offset-2 hover:underline"
            >
              ← Anteriores
            </Link>
          ) : (
            <span />
          )}
          {result.hasMore ? (
            <Link
              href={pageHref(result.page + 1)}
              className="text-sm underline-offset-2 hover:underline"
            >
              Siguientes →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
