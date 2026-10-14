import { serverEnvSchema, workerEnvSchema } from "./env";

export type DeployTarget = "app" | "worker";

export interface DeployCheck {
  errors: string[];
  warnings: string[];
}

const isLocal = (url: string) => {
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
};

const portOf = (url: string | undefined) => {
  try {
    return url ? new URL(url).port || "5432" : null;
  } catch {
    return null;
  }
};

/**
 * Revisa las variables ANTES de deployar (app en Vercel o worker en Fly/Render).
 * Errores = no se puede deployar así; advertencias = funciona, pero algo queda
 * deshabilitado o subóptimo. No reemplaza la validación de `src/lib/env.ts`: la
 * complementa con reglas propias de producción.
 */
export function checkProductionEnv(
  source: Record<string, string | undefined>,
  target: DeployTarget,
): DeployCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const env = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ""));

  const schema = target === "app" ? serverEnvSchema : workerEnvSchema;
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    for (const i of parsed.error.issues) errors.push(`${i.path.join(".")}: ${i.message}`);
  }

  if (env.NODE_ENV !== "production") errors.push("NODE_ENV tiene que ser production.");
  if (env.AI_FAKE === "true") errors.push("AI_FAKE=true está prohibido en producción.");
  if (env.CHANNELS_MOCK === "true") errors.push("CHANNELS_MOCK=true está prohibido en producción.");
  for (const key of ["ANTHROPIC_API_KEY", "AI_MODEL_FAST", "AI_MODEL_SMART"]) {
    if (!env[key]) errors.push(`Falta ${key}: sin esto no funciona la IA.`);
  }
  if (env.APP_URL) {
    if (isLocal(env.APP_URL)) errors.push("APP_URL apunta a localhost.");
    else if (!env.APP_URL.startsWith("https://")) errors.push("APP_URL tiene que ser https.");
  } else {
    errors.push("Falta APP_URL (links de baja, OAuth y webhooks dependen de ella).");
  }

  const prices = [
    "AI_PRICE_FAST_INPUT_PER_MTOK",
    "AI_PRICE_FAST_OUTPUT_PER_MTOK",
    "AI_PRICE_SMART_INPUT_PER_MTOK",
    "AI_PRICE_SMART_OUTPUT_PER_MTOK",
  ];
  if (prices.some((k) => !env[k])) {
    warnings.push("Faltan precios de IA (AI_PRICE_*): el costo en métricas va a quedar vacío.");
  }

  const google = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  if (!google) {
    warnings.push("Sin GOOGLE_CLIENT_ID/SECRET: Gmail y Google Calendar quedan deshabilitados.");
  } else if (!env.UNSUBSCRIBE_SIGNING_SECRET) {
    errors.push("Con Gmail configurado hace falta UNSUBSCRIBE_SIGNING_SECRET (link de baja).");
  }
  for (const key of [
    "GOOGLE_OAUTH_AUTHORIZE_URL",
    "GOOGLE_OAUTH_TOKEN_URL",
    "GOOGLE_OAUTH_REVOKE_URL",
    "GMAIL_API_URL",
    "GOOGLE_CALENDAR_API_URL",
    "GOOGLE_USERINFO_URL",
  ]) {
    if (env[key])
      warnings.push(`${key} está definida: en producción dejala vacía (es para tests).`);
  }

  if (!!env.META_APP_SECRET !== !!env.META_WEBHOOK_VERIFY_TOKEN) {
    warnings.push(
      "Meta queda deshabilitado: hacen falta META_APP_SECRET y META_WEBHOOK_VERIFY_TOKEN.",
    );
  }
  if (env.META_APP_SECRET && !env.META_GRAPH_API_URL) {
    warnings.push("Sin META_GRAPH_API_URL no se puede enviar por Meta (solo recibir).");
  }
  if (env.TIKTOK_CLIENT_SECRET) {
    warnings.push(
      "TIKTOK_CLIENT_SECRET definido: el parseo de TikTok está pendiente (responde 501).",
    );
  }

  const port = portOf(env.DATABASE_URL);
  if (target === "app" && port && port !== "6543") {
    warnings.push(
      "La app en Vercel (serverless) debería usar el pooler de Supabase en modo transacción (puerto 6543).",
    );
  }
  if (target === "worker") {
    if (port === "6543") {
      warnings.push(
        "El worker es un proceso de larga vida: mejor conexión directa o pooler en modo sesión (puerto 5432).",
      );
    }
    if (!env.WORKER_HEALTH_PORT) {
      warnings.push("Sin WORKER_HEALTH_PORT la plataforma no puede chequear la salud del worker.");
    }
  }
  return { errors, warnings };
}
