import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { createDatabase, type Database } from "@/db/client";
import { applySupabaseShim } from "../../scripts/db/apply-shim";
import { runMigrations } from "../../scripts/db/migrate";

/** URL de un Postgres donde se pueden crear bases (ej. el de `supabase start`). */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export interface TestDatabase {
  db: Database;
  url: string;
  drop: () => Promise<void>;
}

/** Crea una base efímera, le aplica el shim de Supabase y las migraciones. */
export async function createTestDatabase(): Promise<TestDatabase> {
  if (!TEST_DATABASE_URL) throw new Error("Falta TEST_DATABASE_URL");
  const name = `test_${randomBytes(6).toString("hex")}`;
  const admin = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);
  await admin.end();

  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${name}`;
  await applySupabaseShim(url.toString());
  await runMigrations(url.toString());

  const { db, sql } = createDatabase(url.toString(), { max: 5 });
  return {
    db,
    url: url.toString(),
    drop: async () => {
      await sql.end();
      const a = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
      await a.unsafe(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

/** Drizzle envuelve el error de Postgres en `cause`: devuelve el mensaje original. */
export async function dbErrorMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause;
    return cause instanceof Error ? cause.message : String(error);
  }
  throw new Error("Se esperaba un error de base de datos y la operación funcionó.");
}
