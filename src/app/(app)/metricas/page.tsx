import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Métricas" };

export default function MetricsPage() {
  return (
    <>
      <PageHeader
        title="Métricas"
        description="Enviados, tasa de respuesta, calificados, agendados y costo de IA."
      />
      <EmptyState
        icon={BarChart3}
        title="Todavía no hay datos"
        description="Las métricas por campaña, canal y setter aparecen cuando empieces a enviar mensajes."
      />
    </>
  );
}
