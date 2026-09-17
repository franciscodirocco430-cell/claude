import Link from "next/link";
import { Sparkles, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  ctaHref,
  ctaLabel,
  icon: Icon = Sparkles,
}: {
  title: string;
  description: string;
  ctaHref?: string;
  ctaLabel?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card-lg border border-dashed border-white/[0.12] bg-surface-card/40 px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {ctaHref && ctaLabel && (
        <Link href={ctaHref} className={cn(buttonVariants({ size: "default" }), "mt-6")}>
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
