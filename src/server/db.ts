import "server-only";
import { createDatabase, type Database } from "@/db/client";
import { getServerEnv } from "@/lib/env";

const globalForDb = globalThis as unknown as { __setterDb?: Database };

/**
 * Conexión compartida del servidor Next. Ojo: saltea RLS. Para leer datos en
 * nombre del usuario, envolvé con `withUserContext(getDb(), { sub }, …)`.
 */
export function getDb(): Database {
  globalForDb.__setterDb ??= createDatabase(getServerEnv().DATABASE_URL, { max: 5 }).db;
  return globalForDb.__setterDb;
}
