import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { loadCampaign } from "../../load";
import { ProspectForm } from "./prospect-form";

export const metadata: Metadata = { title: "Agregar prospecto" };

export default async function NewProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { campaign } = await loadCampaign(id);
  if (campaign.status === "archived") redirect(`/campanas/${id}`);
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/campanas/${id}`}
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden /> {campaign.name}
      </Link>
      <PageHeader
        title="Agregar prospecto"
        description="Pegá el link de su perfil o su web y completá lo que sepas."
      />
      <Card>
        <CardContent>
          <ProspectForm campaignId={campaign.id} />
        </CardContent>
      </Card>
    </div>
  );
}
