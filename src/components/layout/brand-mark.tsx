import Image from "next/image";
import { cn } from "@/lib/utils";

/** Emblema de Setter Copilot (fondo negro propio: se ve igual en tema claro y oscuro). */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/mark.png"
      alt=""
      width={size}
      height={size}
      priority
      className={cn("shadow-primary/30 shrink-0 rounded-[28%] shadow-md", className)}
    />
  );
}
