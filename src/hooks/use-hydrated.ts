"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** false en el HTML del servidor, true una vez que React hidrató en el navegador. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
