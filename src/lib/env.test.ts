import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

const valid = {
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
};

describe("parseServerEnv", () => {
  it("aplica valores por defecto", () => {
    const env = parseServerEnv(valid);
    expect(env.DEFAULT_TIMEZONE).toBe("America/Argentina/Buenos_Aires");
    expect(env.WORKER_POLL_INTERVAL_MS).toBe(2000);
    expect(env.AI_MODEL_SMART).toBeUndefined();
  });

  it("rechaza una clave de cifrado de largo incorrecto", () => {
    expect(() =>
      parseServerEnv({ ...valid, TOKEN_ENCRYPTION_KEY: randomBytes(16).toString("base64") }),
    ).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it("lista todas las variables faltantes", () => {
    expect(() => parseServerEnv({})).toThrow(/DATABASE_URL[\s\S]*SUPABASE_SERVICE_ROLE_KEY/);
  });
});
