import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { PageHeader } from "@/components/layout/page-header";
import { isAdminRole } from "@/server/auth/permissions";
import { loadCampaign } from "../load";

export const metadata: Metadata = { title: "Editar campaña" };

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, campaign } = await loadCampaign(id);
  if (!isAdminRole(ctx.role)) redirect(`/campanas/${id}`);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Editar campaña" description={campaign.name} />
      <CampaignWizard
        campaignId={campaign.id}
        initial={{
          name: campaign.name,
          niche: campaign.niche,
          nicheReferences: campaign.nicheReferences,
          offer: campaign.offer,
          icp: campaign.icp,
          qualificationCriteria: campaign.qualificationCriteria.map(({ label, weight }) => ({
            label,
            weight,
          })),
          qualificationQuestions: campaign.qualificationQuestions,
          channels: campaign.channels,
          tone: campaign.tone ?? "",
          dailyLimits: campaign.dailyLimits,
        }}
      />
    </div>
  );
}
