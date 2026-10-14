"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ActionState } from "@/server/actions";

/** Refresca los datos del servidor cuando una acción termina bien. */
export function useRefreshOnSuccess(state: ActionState<unknown>) {
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);
}
