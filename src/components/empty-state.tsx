import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-in fade-in zoom-in-95 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center duration-500",
        className,
      )}
    >
      <div className="bg-primary/10 animate-float-slow flex size-12 items-center justify-center rounded-full">
        <Icon className="text-primary size-6" aria-hidden />
      </div>
      <div className="max-w-sm space-y-1">
        <h2 className="font-medium">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
