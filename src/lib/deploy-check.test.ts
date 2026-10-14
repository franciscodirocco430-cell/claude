import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkProductionEnv } from "./deploy-check";

const base = {
  NODE_ENV: "production",
  APP_URL: "https://app.settercopilot.example",
  DATABASE_URL: "postgresql://u:p@aws-0-sa-east-1.pooler.supabase.com:6543/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  ANTHROPIC_API_KEY: "sk-test",
  AI_MODEL_FAST: "modelo-rapido",
  AI_MODEL_SMART: "modelo-inteligente",
  AI_PRICE_FAST_INPUT_PER_MTOK: "1",
  AI_PRICE_FAST_OUTPUT_PER_MTOK: "1",
  AI_PRICE_SMART_INPUT_PER_MTOK: "1",
  AI_PRICE_SMART_OUTPUT_PER_MTOK: "1",
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret",
  UNSUBSCRIBE_SIGNING_SECRET: "x".repeat(40),
};

describe("checkProductionEnv", () => {
  it("una configuración completa de la app pasa sin errores ni advertencias", () => {
    expect(checkProductionEnv(base, "app")).toEqual({ errors: [], warnings: [] });
  });

  it("bloquea simuladores, localhost, http y falta de IA", () => {
    const r = checkProductionEnv(
      {
        ...base,
        AI_FAKE: "true",
        CHANNELS_MOCK: "true",
        APP_URL: "http://localhost:3000",
        ANTHROPIC_API_KEY: "",
      },
      "app",
    );
    expect(r.errors.join("\n")).toMatch(/AI_FAKE/);
    expect(r.errors.join("\n")).toMatch(/CHANNELS_MOCK/);
    expect(r.errors.join("\n")).toMatch(/localhost/);
    expect(r.errors.join("\n")).toMatch(/ANTHROPIC_API_KEY/);
    expect(
      checkProductionEnv({ ...base, APP_URL: "http://app.example.com" }, "app").errors,
    ).toEqual(["APP_URL tiene que ser https."]);
  });

  it("Gmail sin secreto de baja es error; URLs de mocks son advertencia", () => {
    const r = checkProductionEnv(
      { ...base, UNSUBSCRIBE_SIGNING_SECRET: "", GMAIL_API_URL: "http://127.0.0.1:54398/gmail/v1" },
      "app",
    );
    expect(r.errors.some((e) => e.includes("UNSUBSCRIBE_SIGNING_SECRET"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("GMAIL_API_URL"))).toBe(true);
  });

  it("pooler: transacción para la app, sesión/directa para el worker", () => {
    const session = base.DATABASE_URL.replace(":6543", ":5432");
    expect(checkProductionEnv({ ...base, DATABASE_URL: session }, "app").warnings.join()).toMatch(
      /6543/,
    );
    const worker = checkProductionEnv(base, "worker");
    expect(worker.warnings.join()).toMatch(/larga vida/);
    expect(worker.warnings.join()).toMatch(/WORKER_HEALTH_PORT/);
    expect(
      checkProductionEnv({ ...base, DATABASE_URL: session, WORKER_HEALTH_PORT: "8080" }, "worker"),
    ).toEqual({ errors: [], warnings: [] });
  });

  it("el worker no necesita las claves de Supabase Auth; la app sí", () => {
    const noSupabase = { ...base, NEXT_PUBLIC_SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" };
    expect(checkProductionEnv(noSupabase, "worker").errors).toEqual([]);
    expect(checkProductionEnv(noSupabase, "app").errors.length).toBeGreaterThan(0);
  });

  it("Meta a medias y TikTok avisan", () => {
    const r = checkProductionEnv(
      { ...base, META_APP_SECRET: "s", TIKTOK_CLIENT_SECRET: "t" },
      "app",
    );
    expect(r.warnings.join("\n")).toMatch(/META_WEBHOOK_VERIFY_TOKEN/);
    expect(r.warnings.join("\n")).toMatch(/META_GRAPH_API_URL/);
    expect(r.warnings.join("\n")).toMatch(/TikTok/);
  });
});
