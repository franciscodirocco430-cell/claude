import { sql } from "drizzle-orm";
import type { Database } from "./client";

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface UserClaims {
  sub: string;
  email?: string;
  role?: "authenticated";
}

/**
 * Ejecuta `fn` dentro de una transacción con el rol `authenticated` y los claims
 * del usuario, igual que PostgREST en Supabase. Así RLS aplica también a las
 * consultas hechas con Drizzle desde el servidor.
 */
export async function withUserContext<T>(
  db: Database,
  claims: UserClaims,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const payload = JSON.stringify({ role: "authenticated", ...claims });
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claims', ${payload}, true)`);
    await tx.execute(sql`select set_config('request.jwt.claim.sub', ${claims.sub}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}
