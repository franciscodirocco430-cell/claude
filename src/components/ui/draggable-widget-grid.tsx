"use client";

import * as React from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export type WidgetSpan = "sm" | "md" | "lg" | "xl" | "full";

export interface WidgetDefinition {
  id: string;
  span?: WidgetSpan;
  /** Row span on desktop (bento tall cells). */
  rowSpan?: 1 | 2;
  content: React.ReactNode;
  label: string;
}

interface DraggableWidgetGridProps {
  widgets: WidgetDefinition[];
  order: string[];
  onOrderChange: (order: string[]) => void;
  className?: string;
}

const spanClasses: Record<WidgetSpan, string> = {
  sm: "md:col-span-1",
  md: "md:col-span-2",
  lg: "md:col-span-2 xl:col-span-3",
  xl: "md:col-span-2 xl:col-span-4",
  full: "col-span-full",
};

function moveItem(order: string[], from: number, to: number): string[] {
  const next = [...order];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

/**
 * Bento-style widget grid with real drag & drop reordering (pointer events,
 * so it works for mouse and touch alike), smooth layout animations, and a
 * keyboard-operable alternative (grip button + arrow keys) for users who
 * can't drag. Layout order is fully controlled — the parent persists it.
 */
export function DraggableWidgetGrid({
  widgets,
  order,
  onOrderChange,
  className,
}: DraggableWidgetGridProps) {
  const prefersReducedMotion = useReducedMotion();
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  const orderRef = React.useRef(order);
  orderRef.current = order;

  const widgetMap = React.useMemo(() => {
    const map = new Map<string, WidgetDefinition>();
    widgets.forEach((w) => map.set(w.id, w));
    return map;
  }, [widgets]);

  const orderedWidgets = order
    .map((id) => widgetMap.get(id))
    .filter((w): w is WidgetDefinition => Boolean(w));

  const handlePointerEnter = (id: string) => {
    if (!draggingId || draggingId === id) return;
    setDragOverId(id);
  };

  const commitSwap = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    const current = orderRef.current;
    const from = current.indexOf(draggingId);
    const to = current.indexOf(targetId);
    if (from === -1 || to === -1) return;
    onOrderChange(moveItem(current, from, to));
  };

  const endDrag = React.useCallback(() => {
    if (draggingId && dragOverId) commitSwap(dragOverId);
    setDraggingId(null);
    setDragOverId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId, dragOverId]);

  React.useEffect(() => {
    if (!draggingId) return;
    window.addEventListener("pointerup", endDrag);
    return () => window.removeEventListener("pointerup", endDrag);
  }, [draggingId, endDrag]);

  const moveByKeyboard = (id: string, direction: -1 | 1) => {
    const current = orderRef.current;
    const from = current.indexOf(id);
    const to = from + direction;
    if (to < 0 || to >= current.length) return;
    onOrderChange(moveItem(current, from, to));
  };

  return (
    <div
      role="list"
      aria-label="Dashboard widgets"
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-4",
        className
      )}
    >
      <AnimatePresence initial={false}>
        {orderedWidgets.map((widget) => {
          const isDragging = draggingId === widget.id;
          const isDragOver = dragOverId === widget.id && draggingId !== widget.id;

          return (
            <motion.div
              key={widget.id}
              layout={!prefersReducedMotion}
              role="listitem"
              aria-label={widget.label}
              onPointerEnter={() => handlePointerEnter(widget.id)}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className={cn(
                "relative rounded-card-lg",
                spanClasses[widget.span ?? "sm"],
                widget.rowSpan === 2 && "md:row-span-2",
                isDragging && "opacity-60",
                isDragOver && "ring-2 ring-primary"
              )}
              style={{ touchAction: isDragging ? "none" : undefined }}
            >
              <div className="group relative h-full">
                <button
                  type="button"
                  aria-label={`Drag to reorder ${widget.label}. Use arrow keys to move.`}
                  className={cn(
                    "absolute right-3 top-3 z-10 flex h-7 w-7 cursor-grab items-center justify-center rounded-lg",
                    "text-muted-foreground/60 opacity-0 transition-opacity hover:bg-white/10 hover:text-foreground",
                    "group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
                  )}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setDraggingId(widget.id);
                  }}
                  onPointerUp={endDrag}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                      e.preventDefault();
                      moveByKeyboard(widget.id, -1);
                    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                      e.preventDefault();
                      moveByKeyboard(widget.id, 1);
                    }
                  }}
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                {widget.content}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
