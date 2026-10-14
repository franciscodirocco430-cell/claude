import { AlertTriangle, ChevronLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AutoRefresh } from "@/components/auto-refresh";
import { AiStatusBadge, BUSY_STATUSES } from "@/components/campaigns/ai-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { withUserContext } from "@/db/rls";
import { CHANNEL_RULES } from "@/server/ai/channel-rules";
import { getProspectDetail } from "@/server/campaigns/service";
import { getDb } from "@/server/db";
import { getLeadStage } from "@/server/queue/service";
import { CHANNEL_LABELS } from "@/server/prospects/profile-url";
import { loadCampaign } from "../../load";
import { CopyButton, RegenerateButton, ReresearchButton } from "./prospect-actions";

export const metadata: Metadata = { title: "Prospecto" };

const TASK_STATUS: Record<string, string> = {
  pending: "Pendiente",
  ready: "Listo para enviar",
  sent_manual: "Enviado",
  skipped: "Salteado",
  failed: "No se pudo redactar",
};

function List({ items }: { items: string[] }) {
  return items.length ? (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((i, n) => (
        <li key={n}>{i}</li>
      ))}
    </ul>
  ) : (
    <p className="text-muted-foreground text-sm">Sin datos.</p>
  );
}

export default async function ProspectPage({
  params,
}: {
  params: Promise<{ id: string; pid: string }>;
}) {
  const { id, pid } = await params;
  const { ctx, campaign } = await loadCampaign(id);
  if (!z.uuid().safeParse(pid).success) notFound();
  const [detail, stage] = await withUserContext(
    getDb(),
    { sub: ctx.user.id },
    async (tx) =>
      [
        await getProspectDetail(tx, {
          organizationId: ctx.organizationId,
          campaignId: campaign.id,
          prospectId: pid,
        }),
        await getLeadStage(tx, ctx.organizationId, pid, campaign.id),
      ] as const,
  );
  if (!detail) notFound();
  const { prospect, handles, research, tasks } = detail;
  const busy = BUSY_STATUSES.includes(prospect.aiStatus);
  const canAct = campaign.status === "active" && !busy;
  const name =
    prospect.fullName ?? prospect.company ?? prospect.email ?? handles[0]?.handle ?? "Prospecto";

  return (
    <div className="mx-auto max-w-4xl">
      <AutoRefresh active={busy} />
      <Link
        href={`/campanas/${campaign.id}`}
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden /> {campaign.name}
      </Link>
      <PageHeader
        title={name}
        description={
          [prospect.fullName ? prospect.company : null, prospect.industry]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        actions={
          <ReresearchButton campaignId={campaign.id} prospectId={prospect.id} disabled={!canAct} />
        }
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant="secondary">Etapa: {stage.name}</Badge>
        <AiStatusBadge status={prospect.aiStatus} />
        {handles.map((h) => (
          <Badge key={h.id} variant="outline">
            {CHANNEL_LABELS[h.channel]}: {h.handle ?? h.url}
          </Badge>
        ))}
        {prospect.email ? <Badge variant="outline">{prospect.email}</Badge> : null}
        {prospect.phone ? <Badge variant="outline">{prospect.phone}</Badge> : null}
      </div>
      {prospect.aiError ? (
        <Alert variant="destructive" className="mb-6 flex gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{prospect.aiError}</span>
        </Alert>
      ) : null}
      {campaign.status !== "active" ? (
        <Alert className="mb-6">La campaña no está activa: no se pueden generar mensajes.</Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Investigación</CardTitle>
            <CardDescription>
              Hecha con los datos cargados y, si tiene, su sitio web. Nunca se visitan los perfiles
              de redes.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {research ? (
              <>
                <p className="text-sm">{research.summary}</p>
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium">Ganchos</h3>
                  <List items={research.hooks} />
                </div>
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium">Dolores probables</h3>
                  <List items={research.pains} />
                </div>
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium">Fuentes</h3>
                  <ul className="text-muted-foreground space-y-1 text-xs">
                    {research.sources.map((s, i) => (
                      <li key={i}>
                        {s.kind === "website" ? (
                          <>
                            Sitio web{" "}
                            {s.url ? (
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 underline"
                              >
                                {s.url} <ExternalLink className="size-3" aria-hidden />
                              </a>
                            ) : null}
                            {s.skippedReason ? ` — no se usó: ${s.skippedReason}` : ""}
                          </>
                        ) : s.kind === "csv" ? (
                          "Datos del CSV importado"
                        ) : (
                          "Datos cargados por el equipo"
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                {busy
                  ? "La IA está investigando…"
                  : "Todavía no se investigó. Usá “Preparar mensajes” en la campaña."}
              </p>
            )}
          </CardContent>
        </Card>

        <section aria-labelledby="drafts-title" className="grid content-start gap-3">
          <h2 id="drafts-title" className="text-lg font-semibold">
            Borradores
          </h2>
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {busy ? "La IA está redactando…" : "Sin borradores todavía."}
            </p>
          ) : (
            tasks.map((task) => {
              const label = CHANNEL_RULES[task.channel].label;
              const copyText = task.draftSubject
                ? `${task.draftSubject}\n\n${task.draftMessage ?? ""}`
                : (task.draftMessage ?? "");
              return (
                <Card key={task.id} className="gap-3 py-4">
                  <CardHeader className="px-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle as="h3" className="text-base">
                        {label}
                      </CardTitle>
                      <Badge variant={task.status === "failed" ? "destructive" : "secondary"}>
                        {TASK_STATUS[task.status] ?? task.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-2 px-4">
                    {task.draftSubject ? (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Asunto:</span> {task.draftSubject}
                      </p>
                    ) : null}
                    {task.draftMessage ? (
                      <p className="bg-muted rounded-md p-3 text-sm whitespace-pre-line">
                        {task.draftMessage}
                      </p>
                    ) : null}
                    {task.channel === "email" && task.draftMessage ? (
                      <p className="text-muted-foreground text-xs">
                        {"{{firma}}"} y {"{{link_baja}}"} se completan al enviar.
                      </p>
                    ) : null}
                    {task.failureReason ? (
                      <p className="text-destructive text-sm">{task.failureReason}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-1">
                      {task.draftMessage ? <CopyButton text={copyText} label={label} /> : null}
                      {task.status === "ready" ||
                      task.status === "failed" ||
                      task.status === "pending" ? (
                        <RegenerateButton
                          campaignId={campaign.id}
                          prospectId={prospect.id}
                          channel={task.channel}
                          label={label}
                          disabled={!canAct}
                        />
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
