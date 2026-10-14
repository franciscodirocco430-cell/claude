import { expect, test, type Page } from "@playwright/test";
import { createCampaign, signUp } from "./support/helpers";

/** Campaña con un prospecto de Instagram y otro de WhatsApp, con mensajes ya preparados. */
async function setupReadyTasks(page: Page) {
  const { url } = await createCampaign(page, { channels: ["Instagram", "WhatsApp"] });
  for (const [target, company] of [
    ["instagram.com/clinica.cola", "Clínica Cola"],
    ["https://wa.me/5491144445555", "Dental WhatsApp"],
  ] as const) {
    await page.goto(`${url}/prospectos/nuevo`);
    await page.getByLabel("Link del perfil, web o email").fill(target);
    await page.getByLabel("Empresa").fill(company);
    await page.getByRole("button", { name: "Agregar prospecto" }).click();
    await expect(page.getByText("Prospecto agregado.")).toBeVisible();
  }
  await page.getByRole("button", { name: "Preparar mensajes (2)" }).click();
  await expect(page.getByText("Mensajes listos")).toHaveCount(2, { timeout: 30_000 });
  return { url };
}

const openedUrls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);

test.beforeEach(async ({ page, context, browserName }) => {
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  }
  // Los tests nunca salen a las redes reales: se registra la URL que la app intenta abrir.
  await context.addInitScript(() => {
    const w = window as unknown as { __opened: string[] };
    w.__opened = [];
    window.open = (url?: string | URL) => {
      w.__opened.push(String(url));
      return null;
    };
  });
  await signUp(page);
});

test("abrir y copiar, editar, marcar enviado y pasar a la siguiente", async ({ page }) => {
  const { url } = await setupReadyTasks(page);
  await page.goto("/cola");
  await expect(page.getByText(/Instagram · .*: 0\/25/)).toBeVisible();

  const heading = page.getByRole("heading", { level: 2 }).first();
  const first = await heading.innerText();
  await page
    .getByLabel("Mensaje (podés editarlo)")
    .fill("Hola! Mensaje editado por el setter. ¿Charlamos?");

  await page.getByRole("button", { name: /Abrir y copiar/ }).click();
  await expect(page.getByText(/Mensaje copiado/)).toBeVisible();
  const [opened] = await openedUrls(page);
  if (first === "Clínica Cola") {
    expect(opened).toBe("https://ig.me/m/clinica.cola");
  } else {
    expect(opened).toContain("https://wa.me/5491144445555?text=Hola!%20Mensaje%20editado");
  }
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "Hola! Mensaje editado por el setter. ¿Charlamos?",
  );

  await page.getByRole("button", { name: /Enviado/ }).click();
  await expect(heading).not.toHaveText(first);
  await expect(page.getByText(/: 1\/(25|30)/)).toBeVisible();

  // El enviado quedó como contactado y con el mensaje editado.
  await page.goto(url);
  await page.getByRole("link", { name: first }).click();
  await expect(page.getByText("Etapa: Contactado")).toBeVisible();
  await expect(page.getByText("Hola! Mensaje editado por el setter. ¿Charlamos?")).toBeVisible();
  await expect(page.getByText("Enviado", { exact: true })).toBeVisible();
});

test("atajos de teclado: S saltea; al terminar se ve el estado vacío", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Los atajos son para teclado físico");
  await setupReadyTasks(page);
  await page.goto("/cola");
  const heading = page.getByRole("heading", { level: 2 }).first();
  const first = await heading.innerText();
  await page.keyboard.press("s");
  await expect(heading).not.toHaveText(first);
  await page.keyboard.press("s");
  await expect(page.getByText("No tenés tareas pendientes")).toBeVisible();
});

test("regenerar el mensaje: la tarea vuelve a la cola cuando la IA termina", async ({ page }) => {
  await setupReadyTasks(page);
  await page.goto("/cola");
  const first = await page.getByRole("heading", { level: 2 }).first().innerText();
  await page.getByRole("button", { name: /Regenerar mensaje/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: /.+/ })).toHaveCount(0);
  // Con la IA simulada el worker tarda menos de un segundo: la tarea reaparece
  // (asignada al mismo setter). Que se oculte mientras regenera lo cubre tests/db.
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: first })).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 30_000 });
});
