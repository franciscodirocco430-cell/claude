import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "clave-segura-123";

export function uniqueEmail(prefix = "user") {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.com`;
}

export async function signUp(
  page: Page,
  opts: { name?: string; email?: string; organization?: string } = {},
) {
  const email = opts.email ?? uniqueEmail();
  const organization = opts.organization ?? `Org ${randomUUID().slice(0, 6)}`;
  await page.goto("/registro");
  await page.getByLabel("Tu nombre").fill(opts.name ?? "Persona de Prueba");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByLabel("Nombre de tu organización").fill(organization);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/campanas$/);
  return { email, organization };
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Salir" }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function logIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}
