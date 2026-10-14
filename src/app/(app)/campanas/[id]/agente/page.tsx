import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { withUserContext } from "@/db/rls";
import { parseAgentSettings } from "@/server/agent/settings";
import { isAdminRole } from "@/server/auth/permissions";
import { getDb } from "@/server/db";
import { listCalendars } from "@/server/google/mailboxes";
import { loadCampaign } from "../load";
import { AgentSettingsForm } from "./agent-settings-form";

export const metadata: Metadata = { title: "Agente IA" };

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, campaign } = await loadCampaign(id);
  if (!isAdminRole(ctx.role)) redirect(`/campanas/${id}`);
  const calendars = await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
    listCalendars(tx, ctx.organizationId),
  );
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/campanas/${id}`}
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden /> {campaign.name}
      </Link>
      <PageHeader
        title="Agente IA"
        description="Continúa las conversaciones entrantes, califica con tus preguntas de a una y agenda la llamada."
      />
      <AgentSettingsForm
        campaignId={campaign.id}
        settings={parseAgentSettings(campaign.agentSettings)}
        calendars={calendars.filter((c) => c.status === "active")}
        hasQuestions={campaign.qualificationQuestions.length > 0}
        bookingUrl={campaign.bookingUrl}
      />
    </div>
  );
}
