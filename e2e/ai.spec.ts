import { expect, test } from "@playwright/test";
import { createCampaign, signUp } from "./support/helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("preparar mensajes: investiga, redacta por canal y permite regenerar", async ({ page }) => {
  const { url } = await createCampaign(page, { channels: ["Instagram", "Email"] });

  await page.getByRole("link", { name: "Agregar prospecto" }).click();
  await page.getByLabel("Link del perfil, web o email").fill("instagram.com/clinica.ia");
  await page.getByLabel("Empresa").fill("Clínica IA");
  await page.getByLabel("Email", { exact: true }).fill("hola@clinica-ia.example.com");
  await page.getByRole("button", { name: "Agregar prospecto" }).click();
  await expect(page.getByText("Sin preparar")).toBeVisible();

  await page.getByRole("button", { name: "Preparar mensajes (1)" }).click();
  await expect(page.getByText("Mensajes listos")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("link", { name: "Clínica IA" }).click();
  await expect(page.getByText(/\[Simulado\] Clínica IA/).first()).toBeVisible();
  await expect(page.getByText("Datos cargados por el equipo")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Instagram (mensaje directo)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Email en frío" })).toBeVisible();
  await expect(page.getByText(/Asunto:/)).toBeVisible();
  await expect(page.getByText("Listo para enviar")).toHaveCount(2);

  await page
    .getByRole("button", { name: "Regenerar mensaje de Instagram (mensaje directo)" })
    .click();
  await expect(page.getByText("Mensajes listos")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Listo para enviar")).toHaveCount(2);

  await page.goto(url);
  await expect(page.getByRole("button", { name: "Preparar mensajes (0)" })).toBeDisabled();
});

test("ejemplos por canal: se cargan y se guardan", async ({ page }) => {
  await createCampaign(page, { channels: ["Instagram"] });
  await page.getByRole("link", { name: "Ejemplos" }).click();
  await page.getByRole("button", { name: "Agregar ejemplo" }).click();
  await page
    .getByLabel("Contexto del ejemplo 1 de Instagram (mensaje directo)")
    .fill("clínica con sede nueva");
  await page
    .getByLabel("Mensaje del ejemplo 1 de Instagram (mensaje directo)")
    .fill("Hola! Vi que abrieron sede en Belgrano. ¿Cómo vienen con los turnos?");
  await page.getByRole("button", { name: "Guardar ejemplos" }).click();
  await expect(page.getByText("Ejemplos guardados.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Mensaje del ejemplo 1 de Instagram (mensaje directo)")).toHaveValue(
    /sede en Belgrano/,
  );
});
