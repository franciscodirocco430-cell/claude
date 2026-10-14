import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Crea una conexión directa a Postgres. Esta conexión NO aplica RLS (usa el rol
 * de la URL, normalmente `postgres`): usala solo en el servidor/worker, y para
 * consultas en nombre de un usuario envolvé la operación con `withUserContext`.
 */
export function createDatabase(url: string, options: { max?: number } = {}) {
  const sql = postgres(url, { max: options.max ?? 10, prepare: false });
  const db = drizzle(sql, { schema });
  return { db, sql };
}
