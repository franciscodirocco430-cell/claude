import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./support/helpers";

/** Cuenta de prueba de Instagram + un mensaje entrante de un contacto nuevo. */
async function inboundConversation(page: Page) {
  await signUp(page);
  await page.goto("/configuracion");
  await page.getByLabel("Canal").selectOption({ label: "Instagram" });
  await page.getByRole("button", { name: "Conectar cuenta de prueba" }).click();
  await expect(page.getByText("Cuenta de prueba conectada.")).toBeVisible();
  const row = page
    .getByRole("listitem")
    .filter({ hasText: "Cuenta de prueba de Instagram" })
    .last();
  const handle = `lead.${randomUUID().slice(0, 6)}`;
  await row.getByText("Simular mensaje entrante").click();
  await row.getByLabel(/de quien escribe/).fill(handle);
  await row.getByLabel("Mensaje").fill("Hola, ¿precios?");
  await row.getByRole("button", { name: "Simular mensaje" }).click();
  await expect(row.getByText(/Mensaje simulado/)).toBeVisible();
  await page.goto("/bandeja");
  const link = page
    .getByRole("list", { name: "Conversaciones" })
    .getByRole("link", { name: new RegExp(`@${handle}`) });
  await expect(link).toBeVisible({ timeout: 20_000 });
  return { handle, link };
}

test("responder a mano desde la Bandeja y filtrar", async ({ page }) => {
  const { handle, link } = await inboundConversation(page);
  await link.click();
  await page.getByLabel("Tu respuesta").fill("¡Hola! Te paso la info por acá.");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Enviado.")).toBeVisible();
  const messages = page.getByRole("list", { name: "Mensajes" });
  await expect(messages).toContainText("¡Hola! Te paso la info por acá.");
  await expect(messages).toContainText("Equipo");
  // Quien responde se queda con la conversación.
  await expect(page.getByLabel("Asignada a")).not.toHaveValue("");

  await page.goto("/bandeja?asignado=yo");
  await expect(page.getByRole("link", { name: new RegExp(`@${handle}`) })).toBeVisible();
  await page.goto("/bandeja?canal=email");
  await expect(page.getByText("Ninguna conversación con esos filtros")).toBeVisible();
  await page.getByRole("link", { name: "Limpiar filtros" }).click();
  await expect(page.getByRole("link", { name: new RegExp(`@${handle}`) })).toBeVisible();
});

test("CRM: mover un lead de etapa y abrir su ficha", async ({ page, isMobile }) => {
  const { handle } = await inboundConversation(page);
  await page.goto("/crm");
  const respondio = page.getByRole("region", { name: "Respondió" });
  // En la compu se arrastra a una columna visible ("Contactado": una persona puede volver atrás).
  const target = isMobile ? "Ganado" : "Contactado";
  const destination = page.getByRole("region", { name: target });
  await expect(respondio.getByRole("link", { name: `@${handle}` })).toBeVisible();

  if (isMobile) {
    // En el celular: el selector de cada tarjeta.
    await page.getByLabel(`Mover a @${handle} a otra etapa`).selectOption({ label: "Ganado" });
  } else {
    // En la compu: arrastrar desde el asa hasta la columna.
    const grip = page.getByRole("button", { name: `Arrastrar a @${handle}` });
    const from = (await grip.boundingBox())!;
    const to = (await destination.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 20, from.y + 20, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 15 });
    await page.mouse.up();
  }
  await expect(destination.getByRole("link", { name: `@${handle}` })).toBeVisible();
  // La UI es optimista: se recarga hasta ver el cambio guardado en el servidor.
  await expect(async () => {
    await page.reload();
    await expect(
      page.getByRole("region", { name: target }).getByRole("link", { name: `@${handle}` }),
    ).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });

  await page.getByRole("link", { name: `@${handle}` }).click();
  await expect(page.getByRole("heading", { level: 1, name: `@${handle}` })).toBeVisible();
  await expect(page.getByRole("list", { name: "Historial de mensajes" })).toContainText(
    "Hola, ¿precios?",
  );
  await expect(page.getByText(new RegExp(`· ${target}`)).first()).toBeVisible();
});
