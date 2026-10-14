import {
  CheckCircle2,
  ChevronLeft,
  MessageSquareQuote,
  ChevronRight,
  FileUp,
  Pencil,
  UserPlus,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AiStatusBadge } from "@/components/campaigns/ai-status-badge";
import { CampaignStatusBadge, ChannelBadges } from "@/components/campaigns/campaign-badges";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { withUserContext } from "@/db/rls";
import { isAdminRole } from "@/server/auth/permissions";
import { listCampaignProspects } from "@/server/campaigns/service";
import type { Channel } from "@/server/compliance/channels";
import { getDb } from "@/server/db";
import { CHANNEL_LABELS } from "@/server/prospects/profile-url";
import { countBusy, countPreparable } from "@/server/ai/preparation";
import { loadCampaign } from "./load";
import { PrepareButton } from "./prepare-button";
import { StatusActions } from "./status-actions";

export const metadata: Metadata = { title: "Campaña" };

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  csv: "CSV",
  url: "Link",
  public_business_data: "Datos públicos",
  inbound: "Entrante",
};

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground text-xs font-medium uppercase">{label}</dt>
      <dd className="text-sm whitespace-pre-line">{children}</dd>
    </div>
  );
}

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; page?: string; agregado?: string }>;
}) {
  const { id } = await params;
  const { q, page, agregado } = await searchParams;
  const { ctx, campaign } = await loadCampaign(id);
  const isAdmin = isAdminRole(ctx.role);
  const archived = campaign.status === "archived";
  const list = await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
    listCampaignProspects(tx, {
      organizationId: ctx.organizationId,
      campaignId: campaign.id,
      search: q,
      page: Number(page) || 1,
    }),
  );
  const [preparable, busy] = await Promise.all([
    countPreparable(getDb(), ctx.organizationId, campaign.id),
    countBusy(getDb(), ctx.organizationId, campaign.id),
  ]);
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const pageHref = (p: number) =>
    `/campanas/${campaign.id}?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <Link
        href="/campanas"
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden /> Campañas
      </Link>
      <PageHeader
        title={campaign.name}
        description={campaign.niche}
        actions={
          isAdmin ? (
            <div className="flex flex-wrap items-start gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/campanas/${campaign.id}/editar`}>
                  <Pencil aria-hidden /> Editar
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/campanas/${campaign.id}/ejemplos`}>
                  <MessageSquareQuote aria-hidden /> Ejemplos
                </Link>
              </Button>
              <StatusActions campaignId={campaign.id} status={campaign.status} />
            </div>
          ) : null
        }
      />
      <AutoRefresh active={busy > 0} />
      {busy > 0 ? (
        <p className="text-muted-foreground mb-3 text-sm" role="status">
          La IA está preparando {busy} {busy === 1 ? "prospecto" : "prospectos"}…
        </p>
      ) : null}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <CampaignStatusBadge status={campaign.status} />
        <ChannelBadges channels={campaign.channels} />
      </div>

      {agregado ? (
        <Alert variant="success" className="mb-4 flex items-center gap-2">
          <CheckCircle2 className="size-4" aria-hidden /> Prospecto agregado.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="prospects-title" className="grid content-start gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="prospects-title" className="text-lg font-semibold">
              Prospectos <span className="text-muted-foreground">({list.total})</span>
            </h2>
            {archived ? null : (
              <div className="flex flex-wrap items-start gap-2">
                {isAdmin && campaign.status === "active" ? (
                  <PrepareButton campaignId={campaign.id} pending={preparable} />
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link href={`/campanas/${campaign.id}/importar`}>
                    <FileUp aria-hidden /> Importar CSV
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={`/campanas/${campaign.id}/prospectos/nuevo`}>
                    <UserPlus aria-hidden /> Agregar prospecto
                  </Link>
                </Button>
              </div>
            )}
          </div>

          <form className="flex gap-2" role="search">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Buscar por nombre, empresa, email o usuario"
              aria-label="Buscar prospectos"
            />
            <Button type="submit" variant="outline">
              Buscar
            </Button>
          </form>

          {list.rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title={q ? "Sin resultados" : "Todavía no hay prospectos"}
              description={
                q
                  ? "Probá con otra búsqueda."
                  : "Importá un CSV o agregá prospectos pegando el link de su perfil o su web."
              }
            />
          ) : (
            <ul className="divide-y rounded-xl border">
              {list.rows.map((p) => (
                <li key={p.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <Link
                      href={`/campanas/${campaign.id}/prospectos/${p.id}`}
                      className="block truncate font-medium underline-offset-4 hover:underline"
                    >
                      {p.fullName ?? p.company ?? p.email ?? p.handles[0]?.handle ?? "Sin nombre"}
                    </Link>
                    <p className="text-muted-foreground truncate text-sm">
                      {[p.fullName ? p.company : null, p.email, p.phone]
                        .filter(Boolean)
                        .join(" · ") || p.website}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <AiStatusBadge status={p.aiStatus} />
                    {p.handles.map((h) => (
                      <Badge key={`${h.channel}-${h.handle}`} variant="outline">
                        {CHANNEL_LABELS[h.channel as Channel]}: {h.handle}
                      </Badge>
                    ))}
                    {p.whatsappOptIn ? <Badge variant="secondary">Opt-in WhatsApp</Badge> : null}
                    <Badge variant="secondary">{SOURCE_LABELS[p.source] ?? p.source}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 ? (
            <nav aria-label="Paginación" className="flex items-center justify-between">
              <Button
                asChild
                variant="outline"
                size="sm"
                className={list.page <= 1 ? "invisible" : undefined}
              >
                <Link href={pageHref(list.page - 1)}>
                  <ChevronLeft aria-hidden /> Anterior
                </Link>
              </Button>
              <span className="text-muted-foreground text-sm">
                Página {list.page} de {totalPages}
              </span>
              <Button
                asChild
                variant="outline"
                size="sm"
                className={list.page >= totalPages ? "invisible" : undefined}
              >
                <Link href={pageHref(list.page + 1)}>
                  Siguiente <ChevronRight aria-hidden />
                </Link>
              </Button>
            </nav>
          ) : null}
        </section>

        <Card className="h-fit gap-4">
          <CardHeader>
            <CardTitle as="h2">Resumen</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4">
              <Detail label="Oferta">{campaign.offer}</Detail>
              <Detail label="Cliente ideal">{campaign.icp}</Detail>
              {campaign.nicheReferences.length ? (
                <Detail label="Referentes">{campaign.nicheReferences.join(", ")}</Detail>
              ) : null}
              <Detail label="Criterios">
                {campaign.qualificationCriteria.map((c) => `${c.label} (${c.weight})`).join("\n")}
              </Detail>
              <Detail label="Preguntas">{campaign.qualificationQuestions.join("\n")}</Detail>
              {campaign.tone ? <Detail label="Tono">{campaign.tone}</Detail> : null}
              <Detail label="Límite diario por setter">
                {/* jsonb no conserva el orden de las claves: se recorre por canal. */}
                {campaign.channels
                  .map((ch) => `${CHANNEL_LABELS[ch]}: ${campaign.dailyLimits[ch] ?? "—"}`)
                  .join(" · ")}
              </Detail>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
