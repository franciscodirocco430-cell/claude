import { Megaphone, Plus } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Campañas" };

export default function CampaignsPage() {
  return (
    <>
      <PageHeader
        title="Campañas"
        description="Nicho, referentes, oferta, cliente ideal y canales de cada campaña."
        actions={
          <Button disabled>
            <Plus aria-hidden /> Nueva campaña
          </Button>
        }
      />
      <EmptyState
        icon={Megaphone}
        title="Todavía no hay campañas"
        description="Creá tu primera campaña para cargar prospectos y que la IA prepare los mensajes."
      />
    </>
  );
}
