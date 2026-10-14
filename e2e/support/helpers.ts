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

/** Crea una campaña completa con el wizard y deja la página en su detalle. */
export async function createCampaign(
  page: Page,
  opts: { name?: string; activate?: boolean; channels?: string[] } = {},
) {
  const name = opts.name ?? `Campaña ${randomUUID().slice(0, 6)}`;
  await page.goto("/campanas/nueva");
  await page.getByLabel("Nombre de la campaña").fill(name);
  await page.getByLabel("Nicho").fill("Clínicas odontológicas independientes");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByLabel("Referente 1", { exact: true }).fill("Podcast de odontología (ejemplo)");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByLabel("Oferta").fill("Sistema de captación de pacientes particulares");
  await page.getByLabel("Cliente ideal (ICP)").fill("Clínicas de 2 a 10 sillones en CABA");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByLabel("Criterio 1", { exact: true }).fill("Tiene presupuesto para marketing");
  await page
    .getByLabel("Pregunta 1", { exact: true })
    .fill("¿Cuántos pacientes nuevos reciben por mes?");
  await page.getByRole("button", { name: "Siguiente" }).click();
  for (const ch of opts.channels ?? ["Instagram", "Email"]) {
    await page.getByRole("checkbox", { name: new RegExp(`^${ch}`) }).check();
  }
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Siguiente" }).click(); // tono por defecto
  await page
    .getByRole("button", {
      name: opts.activate === false ? "Guardar como borrador" : "Guardar y activar",
    })
    .click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return { name, url: page.url() };
}

/** El owner logueado invita a alguien; esa persona crea su cuenta y acepta. Termina logueada como invitada. */
export async function inviteAndJoin(
  page: Page,
  role: "Setter" | "Admin",
  name = "Persona Invitada",
) {
  const email = uniqueEmail(role.toLowerCase());
  await page.goto("/configuracion");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Rol", { exact: true }).selectOption({ label: role });
  await page.getByRole("button", { name: "Invitar" }).click();
  const link = await page.getByLabel("Link de invitación").inputValue();
  await signOut(page);
  await page.goto(link);
  await page.getByRole("link", { name: "Crear cuenta" }).click();
  await page.getByLabel("Tu nombre").fill(name);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByRole("button", { name: "Aceptar invitación" }).click();
  await expect(page).toHaveURL(/\/campanas$/);
  return { email };
}

/** Salta a un paso del wizard: pastillas en desktop, select en el celular. */
export async function goToWizardStep(page: Page, title: string) {
  const select = page.locator("#wizard-step");
  if (await select.isVisible()) await select.selectOption({ label: title });
  else await page.getByRole("button", { name: new RegExp(title) }).click();
}
