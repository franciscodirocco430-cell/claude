import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createCampaign, signUp } from "./support/helpers";

const GOOGLE = `http://127.0.0.1:${process.env.MOCK_GOOGLE_PORT ?? 54398}`;

interface SentMail {
  threadId: string;
  subject: string;
  text: string;
}

async function sentTo(request: APIRequestContext, to: string): Promise<SentMail[]> {
  return (await request.get(`${GOOGLE}/__test/sent?to=${encodeURIComponent(to)}`)).json();
}

async function connectGmail(page: Page) {
  await page.goto("/configuracion");
  await page.getByRole("link", { name: "Conectar Gmail" }).click();
  await expect(page.getByText("Gmail conectado.")).toBeVisible();
  await expect(page.getByText("ventas@agencia-e2e.example.com")).toBeVisible();
}

/** Campaña con email, un prospecto con borrador de IA listo y una secuencia activa con él inscripto. */
async function campaignWithActiveSequence(page: Page, email: string, company: string) {
  await connectGmail(page);
  await page.getByLabel("Firma").fill("Ana Pérez\nAgencia E2E");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();

  const { url } = await createCampaign(page, { channels: ["Email"] });
  await page.goto(`${url}/prospectos/nuevo`);
  await page.getByLabel("Link del perfil, web o email").fill(email);
  await page.getByLabel("Empresa").fill(company);
  await page.getByRole("button", { name: "Agregar prospecto" }).click();
  await page.getByRole("button", { name: "Preparar mensajes (1)" }).click();
  await expect(page.getByText("Mensajes listos")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("link", { name: "Secuencias" }).click();
  await page.getByRole("link", { name: "Nueva secuencia" }).first().click();
  // Envío a cualquier hora y día: el test no puede depender del reloj.
  await page.getByLabel("Hora de inicio").fill("0");
  await page.getByLabel("Hora de fin").fill("24");
  for (const d of ["Dom", "Sáb"]) await page.getByRole("checkbox", { name: d }).check();

  await page.getByRole("button", { name: "Vista previa" }).first().click();
  await expect(page.getByText(`Asunto: Una idea para ${company}`)).toBeVisible();

  await page.getByRole("button", { name: "Guardar secuencia" }).click();
  await expect(page.getByText("Secuencia guardada. Activala")).toBeVisible();
  await page.getByRole("button", { name: "Activar" }).click();
  await expect(page.getByText("Secuencia activa.")).toBeVisible();
  await page.getByRole("button", { name: "Inscribir prospectos elegibles" }).click();
  await expect(page.getByText("1 prospecto inscripto.")).toBeVisible();
  return { url, sequenceUrl: page.url() };
}

const stat = (page: Page, label: string) =>
  page
    .getByRole("region", { name: "Estado de la secuencia" })
    .locator("div")
    .filter({ hasText: label })
    .locator("dd");

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("conectar Gmail por OAuth y configurar la casilla", async ({ page }) => {
  await connectGmail(page);
  await page.getByLabel("Tope diario").fill("15");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Tope diario")).toHaveValue("15");
});

test("secuencia: envía con firma y baja, detecta la respuesta y frena", async ({
  page,
  request,
}) => {
  const email = `laura-${Date.now()}@clinica-e2e.example.com`;
  const { url } = await campaignWithActiveSequence(page, email, "Clínica Respuesta");

  await expect.poll(async () => (await sentTo(request, email)).length, { timeout: 30_000 }).toBe(1);
  const [mail] = await sentTo(request, email);
  expect(mail!.subject).toBe("Una idea para Clínica Respuesta");
  expect(mail!.text).toContain("Ana Pérez");
  expect(mail!.text).toMatch(/darte de baja acá: http:\/\/localhost:\d+\/baja\//);

  await request.post(`${GOOGLE}/__test/reply`, {
    data: { to: email, from: `Laura <${email}>`, text: "¡Me interesa! ¿Hablamos el martes?" },
  });
  await expect(async () => {
    await page.reload();
    await expect(stat(page, "Respondieron")).toHaveText("1", { timeout: 1000 });
  }).toPass({ timeout: 30_000 });

  await page.goto(url);
  await page.getByRole("link", { name: "Clínica Respuesta" }).click();
  await expect(page.getByText("Etapa: Respondió")).toBeVisible();
});

test("baja: el link del email da de baja y suprime el contacto", async ({ page, request }) => {
  const email = `baja-${Date.now()}@clinica-e2e.example.com`;
  const { sequenceUrl } = await campaignWithActiveSequence(page, email, "Clínica Baja");
  await expect.poll(async () => (await sentTo(request, email)).length, { timeout: 30_000 }).toBe(1);
  const [mail] = await sentTo(request, email);
  const link = /http:\/\/localhost:\d+\/baja\/\S+/.exec(mail!.text)![0];

  // El destinatario no tiene sesión: abre el link en otro navegador.
  const visitor = await page.context().browser()!.newContext();
  const v = await visitor.newPage();
  await v.goto(link);
  await expect(v.getByText(`Vas a dejar de recibir emails de`)).toBeVisible();
  await v.getByRole("button", { name: "Darme de baja" }).click();
  await expect(v.getByText("Listo: no vas a recibir más emails nuestros.")).toBeVisible();
  await visitor.close();

  await page.goto(sequenceUrl);
  await expect(stat(page, "Bajas")).toHaveText("1");
  await page.goto("/configuracion");
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText("Se dio de baja")).toBeVisible();
});

test("baja en un clic (POST del encabezado List-Unsubscribe)", async ({ page, request }) => {
  const email = `oneclick-${Date.now()}@clinica-e2e.example.com`;
  const { sequenceUrl } = await campaignWithActiveSequence(page, email, "Clínica Un Clic");
  await expect.poll(async () => (await sentTo(request, email)).length, { timeout: 30_000 }).toBe(1);
  const [mail] = await sentTo(request, email);
  const token = /\/baja\/(\S+)/.exec(mail!.text)![1]!;
  const res = await request.post(`/api/baja/${token}`, {
    form: { "List-Unsubscribe": "One-Click" },
  });
  expect(res.status()).toBe(200);
  expect((await request.post(`/api/baja/${token}x`)).status()).toBe(400);
  await page.goto(sequenceUrl);
  await expect(stat(page, "Bajas")).toHaveText("1");
});
