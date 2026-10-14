import { z } from "zod";

const optionalNumber = z.coerce.number().nonnegative().optional();

/** Variables del servidor. Ver `.env.example` para la documentación de cada una. */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  TOKEN_ENCRYPTION_KEY: z.string().refine((v) => Buffer.from(v, "base64").length === 32, {
    message: "Debe ser una clave de 32 bytes en base64 (openssl rand -base64 32)",
  }),

  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  AI_MODEL_FAST: z.string().min(1).optional(),
  AI_MODEL_SMART: z.string().min(1).optional(),
  AI_PRICE_FAST_INPUT_PER_MTOK: optionalNumber,
  AI_PRICE_FAST_OUTPUT_PER_MTOK: optionalNumber,
  AI_PRICE_SMART_INPUT_PER_MTOK: optionalNumber,
  AI_PRICE_SMART_OUTPUT_PER_MTOK: optionalNumber,

  DEFAULT_TIMEZONE: z.string().default("America/Argentina/Buenos_Aires"),

  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/** Lectura perezosa: no rompe el build si falta una variable que no se usa. */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
