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

const appEnv = {
  APP_URL: `http://localhost:${port}`,
  DATABASE_URL: e2eDbUrl.toString(),
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${authPort}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "e2e-service-role-key",
  TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  NEXT_TELEMETRY_DISABLED: "1",
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
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `pnpm build && pnpm start --port ${port}`,
      url: `http://localhost:${port}/login`,
      env: appEnv,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
