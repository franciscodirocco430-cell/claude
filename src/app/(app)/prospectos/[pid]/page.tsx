import { ChevronLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { withUserContext } from "@/db/rls";
import { cn } from "@/lib/utils";
import { requireAppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { CHANNEL_LABELS } from "@/server/prospects/profile-url";
import { getProspectRecord } from "@/server/prospects/record";

export const metadata: Metadata = { title: "Ficha del prospecto" };

const AUTHOR: Record<string, string> = { human: "Equipo", ai: "IA", prospect: "Contacto" };
const TASK_STATUS: Record<string, string> = {
  pending: "Pendiente",
  ready: "Lista para enviar",
  sent_manual: "Enviada a mano",
  skipped: "Salteada",
  failed: "Falló",
};
const ENROLLMENT_STATUS: Record<string, string> = {
  active: "En curso",
  completed: "Terminada",
  stopped_replied: "Respondió",
  stopped_bounced: "Rebotó",
  stopped_unsubscribed: "Se dio de baja",
  stopped_manual: "Frenada",
};

const timeFormat = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ProspectRecordPage({ params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params;
  if (!z.uuid().safeParse(pid).success) notFound();
  const ctx = await requireAppContext();
  const record = await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
    getProspectRecord(tx, ctx.organizationId, pid),
  );
  if (!record) notFound();
  const { prospect, handles } = record;
  const name =
    prospect.fullName ??
    prospect.company ??
    (handles[0]?.handle ? `@${handles[0].handle}` : null) ??
    prospect.email ??
    prospect.phone ??
    "Prospecto";

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/crm"
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden /> CRM
      </Link>
      <PageHeader
        title={name}
        description={
          [prospect.fullName ? prospect.company : null, prospect.industry]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {record.campaignName && prospect.campaignId ? (
          <Link
            href={`/campanas/${prospect.campaignId}/prospectos/${prospect.id}`}
            className="text-primary text-sm underline-offset-2 hover:underline"
          >
            Campaña: {record.campaignName}
          </Link>
        ) : (
          <Badge variant="outline">Sin campaña</Badge>
        )}
        {handles.map((h) => (
          <Badge key={h.id} variant="outline">
            {CHANNEL_LABELS[h.channel]}: {h.handle ?? h.url}
          </Badge>
        ))}
        {prospect.email ? <Badge variant="outline">{prospect.email}</Badge> : null}
        {prospect.phone ? <Badge variant="outline">{prospect.phone}</Badge> : null}
        {prospect.whatsappOptIn ? <Badge variant="secondary">Opt-in de WhatsApp</Badge> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="history-title" className="grid content-start gap-3">
          <h2 id="history-title" className="text-lg font-semibold">
            Historial
          </h2>
          {record.history.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Todavía no hay mensajes con este prospecto.
            </p>
          ) : (
            <ol className="grid gap-2" aria-label="Historial de mensajes">
              {record.history.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "max-w-[90%] rounded-lg border p-3 text-sm",
                    m.direction === "out" ? "bg-muted ml-auto" : "mr-auto",
                  )}
                >
                  <p className="break-words whitespace-pre-wrap">{m.body}</p>
                  <p className="text-muted-foreground mt-1 flex flex-wrap gap-x-2 text-xs">
                    <span>{CHANNEL_LABELS[m.channel]}</span>
                    <span>{AUTHOR[m.author]}</span>
                    <span>{timeFormat.format(m.sentAt)}</span>
                    <Link
                      href={`/bandeja/${m.conversationId}`}
                      className="underline-offset-2 hover:underline"
                    >
                      Abrir conversación
                    </Link>
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Puntaje</CardTitle>
              <CardDescription>Calificación por campaña.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {record.leads.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sin calificación todavía.</p>
              ) : (
                record.leads.map((l) => (
                  <div key={l.id} className="grid gap-2">
                    <p className="text-sm">
                      <strong>{l.score}/100</strong> · {l.stage}
                      {l.campaignName ? (
                        <span className="text-muted-foreground"> · {l.campaignName}</span>
                      ) : null}
                    </p>
                    {l.questions.length ? (
                      <ul className="grid gap-1 text-xs">
                        {l.questions.map((q) => (
                          <li key={q.text}>
                            <span className="text-muted-foreground">{q.text}</span>{" "}
                            {q.answer ?? "—"}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {l.criteria.length ? (
                      <ul className="grid gap-1 text-xs">
                        {l.criteria.map((c) => (
                          <li key={c.label}>
                            {c.met === true ? "✓" : c.met === false ? "✗" : "?"} {c.label} (
                            {c.weight})
                            {c.evidence ? (
                              <span className="text-muted-foreground"> — {c.evidence}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Investigación</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {record.research ? (
                <>
                  <p>{record.research.summary}</p>
                  {record.research.pains.length ? (
                    <ul className="list-disc space-y-1 pl-5 text-xs">
                      {record.research.pains.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  ) : null}
                  {record.research.sources
                    .filter((s) => s.kind === "website" && s.url && !s.skippedReason)
                    .map((s) => (
                      <a
                        key={s.url}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground inline-flex items-center gap-1 text-xs underline"
                      >
                        {s.url} <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ))}
                </>
              ) : (
                <p className="text-muted-foreground">Sin investigación.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Reuniones</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {record.meetings.length === 0 ? (
                <p className="text-muted-foreground">Sin reuniones.</p>
              ) : (
                record.meetings.map((m) => (
                  <p key={m.id}>
                    {timeFormat.format(m.startsAt)}
                    {m.htmlLink ? (
                      <>
                        {" · "}
                        <a href={m.htmlLink} target="_blank" rel="noreferrer" className="underline">
                          Calendar
                        </a>
                      </>
                    ) : null}
                  </p>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Tareas y secuencias</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {record.tasks.length === 0 && record.enrollments.length === 0 ? (
                <p className="text-muted-foreground">Nada todavía.</p>
              ) : null}
              {record.tasks.map((t) => (
                <p key={t.id}>
                  {CHANNEL_LABELS[t.channel]}: {TASK_STATUS[t.status] ?? t.status}
                  {t.skippedReason ? (
                    <span className="text-muted-foreground"> — {t.skippedReason}</span>
                  ) : null}
                </p>
              ))}
              {record.enrollments.map((e) => (
                <p key={e.id}>
                  Secuencia {e.sequenceName}: {ENROLLMENT_STATUS[e.status] ?? e.status}
                  {e.stopReason ? (
                    <span className="text-muted-foreground"> — {e.stopReason}</span>
                  ) : null}
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
