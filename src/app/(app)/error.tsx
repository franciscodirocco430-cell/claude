"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={AlertTriangle}
      title="Algo salió mal"
      description="No pudimos cargar esta sección. Probá de nuevo en unos segundos."
      action={<Button onClick={reset}>Reintentar</Button>}
    />
  );
}
