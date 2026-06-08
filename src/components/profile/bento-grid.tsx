import React from "react";
import { cn } from "@/lib/utils";

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
}

export function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 md:grid-cols-4",
        "[&>*[data-col-span='2']]:col-span-2",
        "[&>*[data-col-span='3']]:col-span-2 md:[&>*[data-col-span='3']]:col-span-3",
        "[&>*[data-col-span='4']]:col-span-2 md:[&>*[data-col-span='4']]:col-span-4",
        "[&>*[data-row-span='2']]:row-span-2",
        className
      )}
    >
      {children}
    </div>
  );
}
