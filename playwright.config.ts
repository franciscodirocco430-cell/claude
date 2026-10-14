import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

/**
 * e2e contra la app real + Postgres real + una emulación mínima de Supabase Auth
 * (e2e/support/mock-gotrue.ts), para poder correr sin Docker. Requiere
 * TEST_DATABASE_URL (un Postgres donde se pueda crear la base `setter_e2e`).
 */
const port = Number(process.env.E2E_PORT ?? 3100);
const authPort = Number(process.env.MOCK_GOTRUE_PORT ?? 54399);
const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) throw new Error("Los tests e2e necesitan TEST_DATABASE_URL.");

const e2eDbUrl = new URL(testDbUrl);
e2eDbUrl.pathname = "/setter_e2e";

const googlePort = Number(process.env.MOCK_GOOGLE_PORT ?? 54398);
const googleBase = `http://127.0.0.1:${googlePort}`;
/** Google y el email apuntan al mock: ni la app ni el worker salen a internet en e2e. */
const googleEnv = {
  GOOGLE_CLIENT_ID: "e2e-client-id",
  GOOGLE_CLIENT_SECRET: "e2e-client-secret",
  GOOGLE_OAUTH_AUTHORIZE_URL: `${googleBase}/o/oauth2/v2/auth`,
  GOOGLE_OAUTH_TOKEN_URL: `${googleBase}/token`,
  GOOGLE_OAUTH_REVOKE_URL: `${googleBase}/revoke`,
  GMAIL_API_URL: `${googleBase}/gmail/v1`,
  UNSUBSCRIBE_SIGNING_SECRET: "e2e-unsubscribe-secret-de-al-menos-32-caracteres",
  EMAIL_MIN_GAP_SECONDS: "0",
  EMAIL_MAX_GAP_SECONDS: "0",
  EMAIL_DISPATCH_INTERVAL_MS: "1000",
  EMAIL_SYNC_INTERVAL_MS: "2000",
};

/** Canales: cuentas de prueba + simulador, y Meta configurado para probar firma y handshake. */
const channelsEnv = {
  CHANNELS_MOCK: "true",
  CHANNELS_MOCK_SECRET: "e2e-mock-channels-secret",
  META_APP_SECRET: "e2e-meta-app-secret",
  META_WEBHOOK_VERIFY_TOKEN: "e2e-meta-verify-token",
};

const workerHealthPort = Number(process.env.E2E_WORKER_HEALTH_PORT ?? 3199);
const encryptionKey = randomBytes(32).toString("base64");

const appEnv = {
  APP_URL: `http://localhost:${port}`,
  DATABASE_URL: e2eDbUrl.toString(),
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${authPort}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "e2e-service-role-key",
  TOKEN_ENCRYPTION_KEY: encryptionKey,
  NEXT_TELEMETRY_DISABLED: "1",
  ...googleEnv,
  ...channelsEnv,
};

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/support/**"],
  fullyParallel: true,
  // La app compila y atiende varios workers a la vez: margen extra para las aserciones.
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
    // En entornos con Chromium preinstalado (ej. contenedores de CI) se puede apuntar al binario.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "pnpm exec tsx e2e/support/mock-gotrue.ts",
      url: `http://127.0.0.1:${authPort}/health`,
      env: { TEST_DATABASE_URL: testDbUrl, MOCK_GOTRUE_PORT: String(authPort) },
      reuseExistingServer: !!process.env.E2E_REUSE_SERVER,
      timeout: 60_000,
    },
    {
      command: "pnpm exec tsx e2e/support/mock-google.ts",
      url: `${googleBase}/health`,
      env: { MOCK_GOOGLE_PORT: String(googlePort) },
      reuseExistingServer: !!process.env.E2E_REUSE_SERVER,
      timeout: 30_000,
    },
    {
      // Worker real con IA simulada: procesa los jobs de investigación y redacción.
      command: "pnpm exec tsx worker/index.ts",
      url: `http://127.0.0.1:${workerHealthPort}`,
      env: {
        DATABASE_URL: e2eDbUrl.toString(),
        TOKEN_ENCRYPTION_KEY: encryptionKey,
        AI_FAKE: "true",
        WORKER_HEALTH_PORT: String(workerHealthPort),
        WORKER_POLL_INTERVAL_MS: "300",
        NODE_ENV: "test",
        APP_URL: `http://localhost:${port}`,
        ...googleEnv,
      },
      reuseExistingServer: !!process.env.E2E_REUSE_SERVER,
      timeout: 60_000,
    },
    {
      command: `pnpm build && pnpm start --port ${port}`,
      url: `http://localhost:${port}/login`,
      env: appEnv,
      reuseExistingServer: !!process.env.E2E_REUSE_SERVER,
      timeout: 240_000,
    },
  ],
});
