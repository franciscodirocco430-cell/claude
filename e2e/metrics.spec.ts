import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./support/helpers";

async function simulate(page: Page, handle: string, text: string) {
  await page.goto("/configuracion");
  const row = page
    .getByRole("listitem")
    .filter({ hasText: "Cuenta de prueba de Instagram" })
    .last();
  await row.getByText("Simular mensaje entrante").click();
  await row.getByLabel(/de quien escribe/).fill(handle);
  await row.getByLabel("Mensaje").fill(text);
  await row.getByRole("button", { name: "Simular mensaje" }).click();
  await expect(row.getByText(/Mensaje simulado/)).toBeVisible();
}

test("métricas: enviados, tasa de respuesta por setter y exportación CSV", async ({ page }) => {
  await signUp(page, { name: "Sofía Setter" });
  await page.goto("/metricas");
  await expect(page.getByText("Sin actividad en el período")).toBeVisible();

  await page.goto("/configuracion");
  await page.getByLabel("Canal").selectOption({ label: "Instagram" });
  await page.getByRole("button", { name: "Conectar cuenta de prueba" }).click();
  await expect(page.getByText("Cuenta de prueba conectada.")).toBeVisible();
  const handle = `metrica.${randomUUID().slice(0, 6)}`;
  await simulate(page, handle, "Hola, ¿info?");

  // Responder a mano y que el contacto vuelva a escribir: 1 enviado, 1 contactado, 100 % respuesta.
  await page.goto("/bandeja");
  await page
    .getByRole("list", { name: "Conversaciones" })
    .getByRole("link", { name: new RegExp(`@${handle}`) })
    .click({ timeout: 20_000 });
  await page.getByLabel("Tu respuesta").fill("¡Hola! Te cuento.");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Enviado.")).toBeVisible();
  await simulate(page, handle, "Genial, gracias");

  await expect(async () => {
    await page.goto("/metricas");
    const totals = page.getByRole("region", { name: "Totales" });
    await expect(totals).toContainText(/Tasa de respuesta\s*100\s?%/, { timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  const totals = page.getByRole("region", { name: "Totales" });
  await expect(totals).toContainText("Enviados1");
  await expect(totals).toContainText("Contactados1");

  const setters = page.getByRole("region", { name: "Por setter" });
  const row = setters.getByRole("row", { name: /Sofía Setter/ });
  await expect(row).toContainText(/100\s?%/);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    setters.getByRole("link", { name: "Exportar CSV" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^metricas-setters-\d{4}-\d{2}-\d{2}-a-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv).toContain("Setter,Enviados,Contactados,Respondieron,Tasa de respuesta (%)");
  expect(csv).toMatch(/Sofía Setter,1,1,1,100,0,0,/);
});

test("el CSV exige sesión y una vista válida", async ({ page, request }) => {
  const anon = await request.get("/api/metricas/csv?vista=canales", { maxRedirects: 0 });
  expect([302, 307, 401]).toContain(anon.status());
  await signUp(page);
  const bad = await page.request.get("/api/metricas/csv?vista=otra");
  expect(bad.status()).toBe(400);
  const ok = await page.request.get("/api/metricas/csv?vista=canales");
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-type"]).toContain("text/csv");
});
