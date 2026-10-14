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
  /** Esfuerzo de razonamiento por tier ("none" = no enviar el parámetro, para modelos viejos). */
  AI_EFFORT_FAST: z.enum(["none", "low", "medium", "high", "xhigh", "max"]).default("low"),
  AI_EFFORT_SMART: z.enum(["none", "low", "medium", "high", "xhigh", "max"]).default("medium"),
  /** Solo desarrollo y tests: respuestas simuladas, sin llamar a la API. Prohibido en producción. */
  AI_FAKE: z.enum(["true", "false"]).default("false"),

  /** Fuentes de datos públicos: deshabilitadas salvo "true" explícito (y costo verificado). */
  PROSPECT_SOURCE_GOOGLE_PLACES_ENABLED: z.enum(["true", "false"]).optional(),

  DEFAULT_TIMEZONE: z.string().default("America/Argentina/Buenos_Aires"),

  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),
  /** Puerto opcional para el health check del worker (Render/Fly). */
  WORKER_HEALTH_PORT: z.coerce.number().int().positive().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Variables que necesita el worker (no usa Supabase Auth). */
export const workerEnvSchema = serverEnvSchema.partial({
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
  SUPABASE_SERVICE_ROLE_KEY: true,
});

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

/**
 * Variables públicas (llegan al navegador). Next solo las inyecta si se
 * referencian literalmente, por eso no se leen dinámicamente.
 */
export function getPublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return { supabaseUrl: url, supabaseAnonKey: anonKey };
}

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

let cachedWorker: WorkerEnv | undefined;

export function getWorkerEnv(): WorkerEnv {
  if (!cachedWorker) {
    const result = workerEnvSchema.safeParse(process.env);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(`Variables de entorno inválidas:\n${issues}`);
    }
    cachedWorker = result.data;
  }
  return cachedWorker;
}
