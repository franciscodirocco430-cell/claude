import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AutoRefresh } from "@/components/auto-refresh";
import { SequenceEditor } from "@/components/campaigns/sequence-editor";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { withUserContext } from "@/db/rls";
import { isAdminRole } from "@/server/auth/permissions";
import { getDb } from "@/server/db";
import { enrollmentStats, getSequence } from "@/server/sequences/service";
import { loadCampaign } from "../../load";
import { editorData } from "../data";
import { StatsLine } from "../stats-line";

export const metadata: Metadata = { title: "Secuencia" };

export default async function SequencePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; sid: string }>;
  searchParams: Promise<{ guardada?: string }>;
}) {
  const { id, sid } = await params;
  const { guardada } = await searchParams;
  const { ctx, campaign } = await loadCampaign(id);
  if (!z.uuid().safeParse(sid).success) notFound();
  const result = await withUserContext(getDb(), { sub: ctx.user.id }, async (tx) => {
    const seq = await getSequence(tx, ctx.organizationId, sid);
    if (!seq || seq.campaignId !== campaign.id) return null;
    return {
      seq,
      stats: (await enrollmentStats(tx, ctx.organizationId, [seq.id])).get(seq.id),
      data: await editorData(tx, ctx.organizationId, campaign.id),
    };
  });
  if (!result) notFound();
  const { seq, stats, data } = result;

  return (
    <div className="mx-auto max-w-3xl">
      <AutoRefresh active={seq.status === "active" && (stats?.active ?? 0) > 0} intervalMs={5000} />
      <Link
        href={`/campanas/${id}/secuencias`}
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden /> Secuencias
      </Link>
      <PageHeader title={seq.name} description={campaign.name} />
      {guardada ? (
        <Alert variant="success" className="mb-4">
          Secuencia guardada. Activala e inscribí prospectos para empezar a enviar.
        </Alert>
      ) : null}
      <section aria-label="Estado de la secuencia" className="mb-4">
        <StatsLine stats={stats ?? {}} />
      </section>
      <SequenceEditor
        campaignId={campaign.id}
        sequenceId={seq.id}
        status={seq.status}
        initial={{
          name: seq.name,
          mailboxAccountId: seq.mailboxAccountId,
          sendStartHour: seq.sendStartHour,
          sendEndHour: seq.sendEndHour,
          sendDays: seq.sendDays,
          steps: seq.steps.map((s) => ({
            subject: s.subject,
            body: s.body,
            delayDays: Math.round(s.delayHours / 24),
          })),
        }}
        mailboxes={data.mailboxes}
        prospects={data.prospects}
        canManage={isAdminRole(ctx.role)}
      />
    </div>
  );
}
