import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guardas estáticas de las reglas no negociables (ver CLAUDE.md). Si alguno de
 * estos tests falla, no lo "arregles" relajándolo: revisá la regla primero.
 */
const ROOT = join(__dirname, "../..");

const BANNED_DEPENDENCIES = [
  "whatsapp-web.js",
  "@whiskeysockets/baileys",
  "baileys",
  "venom-bot",
  "instagram-private-api",
  "puppeteer",
  "puppeteer-core",
  "selenium-webdriver",
  "playwright-extra",
  "puppeteer-extra",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mjs|js)$/.test(name) ? [path] : [];
  });
}

describe("guardas de cumplimiento", () => {
  it("no hay dependencias de clientes no oficiales ni automatización de navegadores", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => BANNED_DEPENDENCIES.includes(d))).toEqual([]);
  });

  it("no hay nombres de modelos de IA hardcodeados en el código", () => {
    const offenders = ["src", "worker", "scripts"]
      .flatMap((d) => sourceFiles(join(ROOT, d)))
      .filter((f) => !f.endsWith(".test.ts"))
      .filter((f) => /["'`]claude-[a-z0-9.-]+["'`]/i.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("playwright solo aparece en los tests e2e", () => {
    const offenders = ["src", "worker", "scripts"]
      .flatMap((d) => sourceFiles(join(ROOT, d)))
      .filter((f) => /from ["'](@playwright\/test|playwright)["']/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});
