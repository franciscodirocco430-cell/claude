import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Librerías prohibidas por las reglas de cumplimiento de plataformas (ver CLAUDE.md).
 * Automatizar sesiones de usuario, scrapear redes o usar clientes no oficiales
 * está fuera de discusión. Playwright solo se permite en los tests e2e.
 */
const bannedPackages = [
  { name: "whatsapp-web.js", message: "Cliente no oficial de WhatsApp: prohibido." },
  { name: "@whiskeysockets/baileys", message: "Cliente no oficial de WhatsApp: prohibido." },
  { name: "baileys", message: "Cliente no oficial de WhatsApp: prohibido." },
  { name: "venom-bot", message: "Cliente no oficial de WhatsApp: prohibido." },
  { name: "instagram-private-api", message: "Cliente no oficial de Instagram: prohibido." },
  { name: "puppeteer", message: "Navegadores headless que simulan usuarios: prohibido." },
  { name: "puppeteer-core", message: "Navegadores headless que simulan usuarios: prohibido." },
  { name: "selenium-webdriver", message: "Navegadores headless que simulan usuarios: prohibido." },
  { name: "playwright", message: "Playwright solo se usa en tests e2e (carpeta e2e/)." },
  { name: "@playwright/test", message: "Playwright solo se usa en tests e2e (carpeta e2e/)." },
];

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx,mjs,js}"],
    ignores: ["e2e/**", "playwright.config.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: bannedPackages }],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
];

export default eslintConfig;
