import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createCampaign, signUp } from "./support/helpers";

const GOOGLE = `http://127.0.0.1:${process.env.MOCK_GOOGLE_PORT ?? 54398}`;
const QUESTION = "¿Cuántos pacientes nuevos reciben por mes?";

/** Campaña con Instagram, agente activo sin demora y cuenta de prueba que entra a esa campaña. */
async function setupAgent(page: Page, opts: { calendar: boolean }) {
  await signUp(page);
  if (opts.calendar) {
    await page.goto("/configuracion");
    await page.getByRole("link", { name: "Conectar Google Calendar" }).click();
    await expect(page.getByText("Google Calendar conectado.")).toBeVisible();
  }
  const { name, url } = await createCampaign(page, { channels: ["Instagram"] });

  await page.goto(`${url}/agente`);
  await page.getByLabel("Agente activo").check();
  await page.getByLabel("Demora mínima (seg.)").fill("0");
  await page.getByLabel("Demora máxima (seg.)").fill("0");
  if (opts.calendar) {
    await page.getByLabel("Calendario de Google").selectOption({ index: 1 });
    await page.getByLabel("Desde (hora)").fill("0");
    await page.getByLabel("Hasta (hora)").fill("24");
    await page.getByLabel("Anticipación mínima (h)").fill("0");
    for (const d of ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]) {
      await page.getByRole("checkbox", { name: d, exact: true }).check();
    }
  }
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado. El agente está activo.")).toBeVisible();

  await page.goto("/configuracion");
  await page.getByLabel("Canal").selectOption({ label: "Instagram" });
  await page.getByRole("button", { name: "Conectar cuenta de prueba" }).click();
  await expect(page.getByText("Cuenta de prueba conectada.")).toBeVisible();
  const row = page
    .getByRole("listitem")
    .filter({ hasText: "Cuenta de prueba de Instagram" })
    .last();
  await row.getByLabel("Campaña para contactos nuevos").selectOption({ label: name });
  await row.getByRole("button", { name: "Guardar campaña" }).click();
  await expect(row.getByText("Guardado.")).toBeVisible();
  return { handle: `contacto.${randomUUID().slice(0, 6)}` };
}

async function say(page: Page, handle: string, text: string) {
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

async function openConversation(page: Page, handle: string) {
  await page.goto("/bandeja");
  await page
    .getByRole("list", { name: "Conversaciones" })
    .getByRole("link", { name: new RegExp(`@${handle.replace(".", "\\.")}`) })
    .click();
}

test("el agente califica, ofrece horarios reales y agenda en Google Calendar", async ({
  page,
  request,
}) => {
  const { handle } = await setupAgent(page, { calendar: true });
  const messages = page.getByRole("list", { name: "Mensajes" });

  await say(page, handle, "Hola! Vi su publicación");
  await openConversation(page, handle);
  await expect(messages).toContainText(QUESTION, { timeout: 20_000 });
  await expect(page.getByText("IA activa")).toBeVisible();

  await say(page, handle, "Unos 30 por mes");
  await openConversation(page, handle);
  await expect(messages).toContainText("¿Te queda bien alguno de estos horarios", {
    timeout: 20_000,
  });
  await expect(page.getByText(/Puntaje: 100\/100/)).toBeVisible();

  await say(page, handle, "El 1 me viene bien");
  await openConversation(page, handle);
  await expect(messages).toContainText("Quedó agendada", { timeout: 20_000 });
  await expect(page.getByText(/Reunión agendada:/)).toBeVisible();
  await expect(page.getByText("Etapa: Agendado", { exact: false })).toBeVisible();

  const events = (await (await request.get(`${GOOGLE}/__test/events`)).json()) as {
    summary: string;
  }[];
  expect(
    events.some((e) => e.summary.includes(handle) || e.summary.startsWith("Llamada con")),
  ).toBe(true);
});

test("si pide una persona: avisa al equipo, pausa la IA y se puede reanudar", async ({ page }) => {
  const { handle } = await setupAgent(page, { calendar: false });
  await say(page, handle, "Quiero hablar con una persona");

  await page.goto("/bandeja");
  const alert = page.getByRole("region", { name: "Avisos" }).getByRole("link").first();
  await expect(alert).toContainText("necesita una persona", { timeout: 20_000 });
  await alert.click();
  await expect(page.getByRole("list", { name: "Mensajes" })).toContainText(
    "Le aviso a alguien del equipo",
  );
  await expect(page.getByText("IA pausada", { exact: true })).toBeVisible();
  await expect(page.getByText(/pidió hablar con una persona/)).toBeVisible();

  await page.getByRole("button", { name: "Reanudar IA" }).click();
  await expect(page.getByText("IA activa")).toBeVisible();
  await page.getByRole("button", { name: "Pausar IA" }).click();
  await expect(page.getByText("Pausada a mano por el equipo.")).toBeVisible();
});

test("si pregunta si es un bot, responde la verdad", async ({ page }) => {
  const { handle } = await setupAgent(page, { calendar: false });
  await say(page, handle, "¿Sos un bot?");
  await openConversation(page, handle);
  await expect(page.getByRole("list", { name: "Mensajes" })).toContainText(
    "soy un asistente con inteligencia artificial",
    { timeout: 20_000 },
  );
});
