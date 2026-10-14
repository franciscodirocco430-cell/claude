import { createHmac, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createCampaign, signUp } from "./support/helpers";

const META_SECRET = "e2e-meta-app-secret";
const META_VERIFY = "e2e-meta-verify-token";

async function connectTestAccount(page: Page, channel: string) {
  await page.goto("/configuracion");
  await page.getByLabel("Canal").selectOption({ label: channel });
  await page.getByRole("button", { name: "Conectar cuenta de prueba" }).click();
  await expect(page.getByText("Cuenta de prueba conectada.")).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: `Cuenta de prueba de ${channel}` });
  await expect(row).toBeVisible();
  return row.last();
}

async function simulate(
  page: Page,
  row: ReturnType<Page["getByRole"]>,
  contact: string,
  text: string,
  name?: string,
) {
  await row.getByText("Simular mensaje entrante").click();
  await row.getByLabel(/de quien escribe/).fill(contact);
  if (name) await row.getByLabel("Nombre (opcional)").fill(name);
  await row.getByLabel("Mensaje").fill(text);
  await row.getByRole("button", { name: "Simular mensaje" }).click();
  await expect(row.getByText(/Mensaje simulado/)).toBeVisible();
}

test("un mensaje entrante de alguien nuevo crea el prospecto y llega a la Bandeja", async ({
  page,
}) => {
  await signUp(page);
  const row = await connectTestAccount(page, "Instagram");
  const handle = `nuevo.${randomUUID().slice(0, 6)}`;
  await simulate(page, row, `@${handle}`, "Hola, ¿cuánto sale el servicio?", "Ana Rivas");

  await page.goto("/bandeja");
  const conv = page.getByRole("link", { name: /Ana Rivas/ });
  await expect(conv).toBeVisible({ timeout: 20_000 });
  await expect(conv).toContainText("Hola, ¿cuánto sale el servicio?");
  await expect(conv).toContainText("Ventana abierta");
  await conv.click();
  await expect(page.getByRole("heading", { level: 1, name: "Ana Rivas" })).toBeVisible();
  await expect(page.getByText("Llegó por mensaje entrante.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Mensajes" })).toContainText(
    "Hola, ¿cuánto sale el servicio?",
  );
});

test("si el handle ya es un prospecto, el mensaje se asocia a él", async ({ page }) => {
  await signUp(page);
  const handle = `clinica.${randomUUID().slice(0, 6)}`;
  const { url } = await createCampaign(page, { channels: ["Instagram"] });
  await page.goto(`${url}/prospectos/nuevo`);
  await page.getByLabel("Link del perfil, web o email").fill(`instagram.com/${handle}`);
  await page.getByLabel("Empresa").fill("Clínica Existente");
  await page.getByRole("button", { name: "Agregar prospecto" }).click();
  await expect(page.getByText("Prospecto agregado.")).toBeVisible();

  const row = await connectTestAccount(page, "Instagram");
  await simulate(page, row, handle, "Vi tu mensaje, contame más");

  await page.goto("/bandeja");
  const conv = page.getByRole("link", { name: /Clínica Existente/ });
  await expect(conv).toBeVisible({ timeout: 20_000 });
  await conv.click();
  await page.getByRole("link", { name: "Ver ficha del prospecto" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Clínica Existente" })).toBeVisible();
});

test("webhook de Meta: handshake con verify token y firma obligatoria", async ({ request }) => {
  const challenge = await request.get(
    `/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=${META_VERIFY}&hub.challenge=4242`,
  );
  expect(challenge.status()).toBe(200);
  expect(await challenge.text()).toBe("4242");
  const wrong = await request.get(
    "/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=4242",
  );
  expect(wrong.status()).toBe(403);

  const body = JSON.stringify({ object: "instagram", entry: [] });
  const unsigned = await request.post("/api/webhooks/meta", {
    data: body,
    headers: { "content-type": "application/json" },
  });
  expect(unsigned.status()).toBe(401);
  const signature = `sha256=${createHmac("sha256", META_SECRET).update(body).digest("hex")}`;
  const signed = await request.post("/api/webhooks/meta", {
    data: body,
    headers: { "content-type": "application/json", "x-hub-signature-256": signature },
  });
  expect(signed.status()).toBe(200);

  // TikTok sin credenciales y proveedores desconocidos: no existen.
  expect((await request.post("/api/webhooks/tiktok", { data: "{}" })).status()).toBe(404);
  expect((await request.post("/api/webhooks/otro", { data: "{}" })).status()).toBe(404);
});
