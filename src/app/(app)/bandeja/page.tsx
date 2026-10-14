import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Bandeja" };

export default function InboxPage() {
  return (
    <>
      <PageHeader
        title="Bandeja"
        description="Todas las conversaciones de todos los canales en un solo lugar."
      />
      <EmptyState
        icon={Inbox}
        title="Sin conversaciones todavía"
        description="Las respuestas de tus prospectos por email, Instagram, Messenger, WhatsApp y TikTok van a llegar acá."
      />
    </>
  );
}
