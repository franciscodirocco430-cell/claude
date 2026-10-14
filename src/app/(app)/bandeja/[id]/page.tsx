import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { withUserContext } from "@/db/rls";
import { cn } from "@/lib/utils";
import { requireAppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { markConversationNotificationsRead } from "@/server/agent/notifications";
import { getConversation, windowLabel } from "@/server/inbox/service";
import { CHANNEL_LABELS } from "@/server/prospects/profile-url";
import { listMembers } from "@/server/organizations/service";
import { AgentToggle } from "./agent-toggle";
import { AssignSelect, ReplyForm } from "./reply-form";

export const metadata: Metadata = { title: "Conversación" };

const AUTHOR: Record<string, string> = { human: "Equipo", ai: "IA", prospect: "Contacto" };

const timeFormat = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await requireAppContext();
  const now = new Date();
  const { conv, members } = await withUserContext(getDb(), { sub: ctx.user.id }, async (tx) => {
    const found = await getConversation(tx, ctx.organizationId, id, now);
    // Abrir la conversación da por vistos sus avisos.
    if (found) await markConversationNotificationsRead(tx, ctx.organizationId, id);
    return { conv: found, members: found ? await listMembers(tx, ctx.organizationId) : [] };
  });
  if (!conv) notFound();
  const label = windowLabel(conv.window, now);
  const replyHint =
    conv.channel === "email"
      ? "Se envía en el mismo hilo, con tu firma y el link de baja."
      : conv.window.kind === "open"
        ? null
        : "La ventana para responder por la API está cerrada: si escribís, queda como tarea en la Cola para enviarlo desde la app.";

  return (
    <div className="mx-auto max-w-3xl">
      <AutoRefresh active intervalMs={5000} />
      <Link
        href="/bandeja"
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden /> Bandeja
      </Link>
      <PageHeader
        title={conv.name}
        description={conv.source === "inbound" ? "Llegó por mensaje entrante." : undefined}
      />
      <div className="mb-4 flex flex-wrap gap-1">
        <Badge variant="secondary">{CHANNEL_LABELS[conv.channel]}</Badge>
        {label ? <Badge variant="outline">{label}</Badge> : null}
        <Link
          href={`/prospectos/${conv.prospectId}`}
          className="text-primary text-xs underline-offset-2 hover:underline"
        >
          Ver ficha del prospecto
        </Link>
      </div>
      {conv.agentEnabled && conv.channel !== "email" ? (
        <section aria-label="Agente IA" className="mb-4 grid gap-3 rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="grid gap-0.5">
              <p className="font-medium">{conv.aiPaused ? "IA pausada" : "IA activa"}</p>
              {conv.aiPaused && conv.aiPausedReason ? (
                <p className="text-muted-foreground text-xs">{conv.aiPausedReason}</p>
              ) : null}
            </div>
            <AgentToggle conversationId={conv.id} paused={conv.aiPaused} />
          </div>
          {conv.lead ? (
            <div className="grid gap-2">
              <p>
                Puntaje: <strong>{conv.lead.score}/100</strong> · Etapa: {conv.lead.stage}
              </p>
              {conv.lead.questions.length ? (
                <ul className="text-muted-foreground grid gap-1 text-xs">
                  {conv.lead.questions.map((q) => (
                    <li key={q.text}>
                      {q.text} <span className="text-foreground">{q.answer ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {conv.meeting ? (
            <p>
              Reunión agendada: {timeFormat.format(conv.meeting.startsAt)}
              {conv.meeting.htmlLink ? (
                <>
                  {" · "}
                  <a
                    href={conv.meeting.htmlLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Ver en Calendar
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </section>
      ) : null}
      <ol className="grid gap-2" aria-label="Mensajes">
        {conv.messages.map((m) => (
          <li
            key={m.id}
            className={cn(
              "max-w-[85%] rounded-lg border p-3 text-sm",
              m.direction === "out" ? "bg-muted ml-auto" : "mr-auto",
            )}
          >
            <p className="break-words whitespace-pre-wrap">{m.body}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {AUTHOR[m.author]} · {timeFormat.format(m.sentAt)}
            </p>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid gap-3">
        <ReplyForm conversationId={conv.id} hint={replyHint} canSend />
        <AssignSelect
          conversationId={conv.id}
          assignedTo={conv.assignedTo}
          members={members.map((m) => ({
            userId: m.userId,
            name: m.fullName ?? m.email ?? "Sin nombre",
          }))}
        />
      </div>
    </div>
  );
}
