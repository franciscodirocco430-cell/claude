import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { loadCampaign } from "../load";
import { CsvImport } from "./csv-import";

export const metadata: Metadata = { title: "Importar prospectos" };

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { campaign } = await loadCampaign(id);
  if (campaign.status === "archived") redirect(`/campanas/${id}`);
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/campanas/${id}`}
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden /> {campaign.name}
      </Link>
      <PageHeader title="Importar prospectos" description="Subí un CSV y asigná sus columnas." />
      <CsvImport campaignId={campaign.id} />
    </div>
  );
}
