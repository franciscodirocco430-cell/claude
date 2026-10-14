import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { PageHeader } from "@/components/layout/page-header";
import { isAdminRole } from "@/server/auth/permissions";
import { requireAppContext } from "@/server/auth/session";
import { emptyCampaign } from "@/server/campaigns/schemas";

export const metadata: Metadata = { title: "Nueva campaña" };

export default async function NewCampaignPage() {
  const ctx = await requireAppContext();
  if (!isAdminRole(ctx.role)) redirect("/campanas");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Nueva campaña"
        description="Completá los 7 pasos. Podés volver atrás cuando quieras."
      />
      <CampaignWizard initial={emptyCampaign()} />
    </div>
  );
}
