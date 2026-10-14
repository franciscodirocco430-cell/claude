"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moveLeadAction } from "@/app/(app)/crm/actions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BoardColumn, BoardLead } from "@/server/pipeline/board";

function LeadCard({
  lead,
  stages,
  onMove,
}: {
  lead: BoardLead;
  stages: { id: string; name: string }[];
  onMove: (leadId: string, stageId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <li
      ref={setNodeRef}
      style={style}
      data-lead={lead.name}
      className={cn(
        "bg-background grid gap-2 rounded-lg border p-3 shadow-xs",
        isDragging && "relative z-50 opacity-80 shadow-lg",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground -ml-1 cursor-grab touch-none rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
          aria-label={`Arrastrar a ${lead.name}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <Link
            href={`/prospectos/${lead.prospectId}`}
            className="truncate text-sm font-medium underline-offset-2 hover:underline"
          >
            {lead.name}
          </Link>
          {lead.campaignName ? (
            <span className="text-muted-foreground truncate text-xs">{lead.campaignName}</span>
          ) : null}
        </div>
        <Badge variant="secondary" title="Puntaje">
          {lead.score}
        </Badge>
      </div>
      {/* Alternativa sin arrastrar (celular, lectores de pantalla). */}
      <label className="sr-only" htmlFor={`move-${lead.id}`}>
        Mover a {lead.name} a otra etapa
      </label>
      <select
        id={`move-${lead.id}`}
        value={lead.stageId}
        onChange={(e) => onMove(lead.id, e.target.value)}
        className="border-input bg-background h-8 rounded-md border px-2 text-xs"
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </li>
  );
}

function Column({
  column,
  leads,
  stages,
  onMove,
}: {
  column: BoardColumn;
  leads: BoardLead[];
  stages: { id: string; name: string }[];
  onMove: (leadId: string, stageId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const hidden = column.total - column.leads.length;
  return (
    <section
      ref={setNodeRef}
      aria-label={column.name}
      className={cn(
        "bg-muted/40 flex w-72 shrink-0 flex-col gap-3 rounded-xl border p-3 transition-colors",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{column.name}</h2>
        <Badge variant="secondary">{leads.length + Math.max(0, hidden)}</Badge>
      </div>
      {leads.length ? (
        <ul className="grid gap-2">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} stages={stages} onMove={onMove} />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-xs">
          Sin leads en esta etapa
        </p>
      )}
      {hidden > 0 ? (
        <p className="text-muted-foreground text-center text-xs">
          y {hidden} más (usá los filtros para encontrarlos)
        </p>
      ) : null}
    </section>
  );
}

export function PipelineBoard({ columns }: { columns: BoardColumn[] }) {
  const router = useRouter();
  // Movimientos optimistas por encima de los datos del servidor, hasta que el refresh los confirma.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const leads = columns
    .flatMap((c) => c.leads)
    .map((l) => (overrides[l.id] ? { ...l, stageId: overrides[l.id]! } : l));
  const without = (id: string) => (o: Record<string, string>) => {
    const next = { ...o };
    delete next[id];
    return next;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const stages = columns.map((c) => ({ id: c.id, name: c.name }));

  function move(leadId: string, stageId: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stageId === stageId) return;
    setError(null);
    setOverrides((o) => ({ ...o, [leadId]: stageId }));
    startTransition(async () => {
      const result = await moveLeadAction({ leadId, stageId });
      // Después de un await, las actualizaciones tienen que volver a entrar en la transición:
      // así el refresh y la limpieza del optimista se aplican juntos (sin parpadeo).
      startTransition(() => {
        if (result.status === "error") setError(result.message ?? "No se pudo mover el lead.");
        else router.refresh();
        setOverrides(without(leadId));
      });
    });
  }

  function onDragEnd(e: DragEndEvent) {
    if (e.over) move(String(e.active.id), String(e.over.id));
  }

  return (
    <div className="grid gap-3">
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <DndContext
        sensors={sensors}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Para mover un lead, presioná espacio o enter, movelo con las flechas y soltalo con espacio o enter. Escape cancela.",
          },
          announcements: {
            onDragStart: () => "Moviendo lead.",
            onDragOver: ({ over }) =>
              over
                ? `Sobre ${stages.find((s) => s.id === over.id)?.name ?? "una etapa"}.`
                : "Fuera de las etapas.",
            onDragEnd: ({ over }) =>
              over
                ? `Movido a ${stages.find((s) => s.id === over.id)?.name ?? "la etapa"}.`
                : "Sin cambios.",
            onDragCancel: () => "Movimiento cancelado.",
          },
        }}
      >
        {/* El scroll horizontal es del tablero, no de la página. */}
        <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          <div className="flex min-w-max items-start gap-3">
            {columns.map((c) => (
              <Column
                key={c.id}
                column={c}
                leads={leads.filter((l) => l.stageId === c.id)}
                stages={stages}
                onMove={move}
              />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
}
