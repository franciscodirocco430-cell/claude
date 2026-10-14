import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SequenceEditor } from "@/components/campaigns/sequence-editor";
import { PageHeader } from "@/components/layout/page-header";
import { withUserContext } from "@/db/rls";
import { isAdminRole } from "@/server/auth/permissions";
import { getDb } from "@/server/db";
import { emptySequence } from "@/server/sequences/schemas";
import { loadCampaign } from "../../load";
import { editorData } from "../data";

export const metadata: Metadata = { title: "Nueva secuencia" };

export default async function NewSequencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, campaign } = await loadCampaign(id);
  if (!isAdminRole(ctx.role)) redirect(`/campanas/${id}/secuencias`);
  const data = await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
    editorData(tx, ctx.organizationId, campaign.id),
  );
  const initial = emptySequence();
  const active = data.mailboxes.find((m) => m.status === "active");
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/campanas/${id}/secuencias`}
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden /> Secuencias
      </Link>
      <PageHeader title="Nueva secuencia" description={campaign.name} />
      <SequenceEditor
        campaignId={campaign.id}
        initial={{ ...initial, mailboxAccountId: active?.id ?? null }}
        mailboxes={data.mailboxes}
        prospects={data.prospects}
        canManage
      />
    </div>
  );
}
