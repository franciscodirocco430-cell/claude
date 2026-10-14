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
import { getConversation, windowLabel } from "@/server/inbox/service";
import { CHANNEL_LABELS } from "@/server/prospects/profile-url";

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
  const conv = await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
    getConversation(tx, ctx.organizationId, id, now),
  );
  if (!conv) notFound();
  const label = windowLabel(conv.window, now);

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
        {conv.campaignId ? (
          <Link
            href={`/campanas/${conv.campaignId}/prospectos/${conv.prospectId}`}
            className="text-primary text-xs underline-offset-2 hover:underline"
          >
            Ver ficha del prospecto
          </Link>
        ) : null}
      </div>
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
      <p className="text-muted-foreground mt-4 text-xs">
        Muy pronto vas a poder responder desde acá.
      </p>
    </div>
  );
}
