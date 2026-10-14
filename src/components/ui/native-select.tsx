import type * as React from "react";
import { cn } from "@/lib/utils";

/** Select nativo: en el celular abre el selector del sistema, que es lo más cómodo. */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-10 w-full rounded-md border px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
