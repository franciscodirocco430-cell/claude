import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env";

/**
 * Cliente de Supabase con la sesión del usuario (cookies). Crear uno por request.
 * Desde Server Components no se pueden escribir cookies: el refresco de sesión
 * lo hace el middleware.
 */
export async function createSupabaseServerClient() {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server Component: lo resuelve el middleware.
        }
      },
    },
  });
}
