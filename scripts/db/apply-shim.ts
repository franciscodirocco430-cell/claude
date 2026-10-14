import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

/**
 * Aplica el shim de Supabase sobre un Postgres pelado. Si detecta que la base ya
 * es Supabase (existe el esquema `auth` con su tabla de migraciones), no hace nada.
 */
export async function applySupabaseShim(url: string) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const [row] = await sql<{ supabase: boolean }[]>`
      select exists (
        select 1 from information_schema.tables
        where table_schema = 'auth' and table_name = 'schema_migrations'
      ) as supabase`;
    if (row?.supabase) {
      console.log("Base Supabase detectada: no se aplica el shim.");
      return;
    }
    const shim = readFileSync(resolve(__dirname, "supabase-shim.sql"), "utf8");
    await sql.unsafe(shim);
    console.log("Shim de Supabase aplicado.");
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  applySupabaseShim(url).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
