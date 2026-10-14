"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";

export function SubmitButton({
  children,
  pendingText,
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  // Antes de hidratar, un envío nativo perdería la respuesta de la acción
  // (errores, link de invitación). Por eso el botón espera a React.
  const hydrated = useHydrated();
  return (
    <Button
      type="submit"
      {...props}
      disabled={!hydrated || pending || props.disabled}
      aria-busy={pending}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
