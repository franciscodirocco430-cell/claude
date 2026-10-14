import { ListTodo } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Cola" };

export default function QueuePage() {
  return (
    <>
      <PageHeader
        title="Cola de tareas"
        description="Abrí el chat, pegá el mensaje y envialo vos. Una tarea por vez."
      />
      <EmptyState
        icon={ListTodo}
        title="No tenés tareas pendientes"
        description="Cuando haya prospectos con mensajes listos para enviar, van a aparecer acá."
      />
    </>
  );
}
