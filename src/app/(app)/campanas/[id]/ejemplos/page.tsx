import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { isAdminRole } from "@/server/auth/permissions";
import { loadCampaign } from "../load";
import { ExamplesEditor } from "./examples-editor";

export const metadata: Metadata = { title: "Ejemplos de mensajes" };

export default async function ExamplesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, campaign } = await loadCampaign(id);
  if (!isAdminRole(ctx.role)) redirect(`/campanas/${id}`);
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/campanas/${id}`}
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden /> {campaign.name}
      </Link>
      <PageHeader
        title="Ejemplos de mensajes"
        description="Hasta 3 por canal. La IA imita su estilo (no copia el contenido). Cambiarlos afecta los próximos borradores."
      />
      <ExamplesEditor
        campaignId={campaign.id}
        channels={campaign.channels}
        initial={campaign.fewShotExamples.map(({ channel, context, message }) => ({
          channel,
          context,
          message,
        }))}
      />
    </div>
  );
}
