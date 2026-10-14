import "dotenv/config";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export async function runMigrations(url: string) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: resolve(__dirname, "../../drizzle") });
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  runMigrations(url)
    .then(() => console.log("Migraciones aplicadas."))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
