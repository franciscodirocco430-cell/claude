import { expect, test } from "@playwright/test";
import { createCampaign, goToWizardStep, inviteAndJoin, signUp } from "./support/helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("el wizard valida cada paso y crea la campaña activa", async ({ page }) => {
  await page.goto("/campanas/nueva");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText("El nombre de la campaña es muy corto.")).toBeVisible();

  const { name } = await createCampaign(page, { name: "Odontólogos CABA" });
  await expect(page.getByText("Activa").first()).toBeVisible();
  await expect(page.getByText("Sistema de captación de pacientes particulares")).toBeVisible();
  await expect(page.getByText("Instagram: 25 · Email: 40")).toBeVisible();

  await page.goto("/campanas");
  await expect(page.getByRole("heading", { name })).toBeVisible();
});

test("editar, pausar y archivar una campaña", async ({ page }) => {
  await createCampaign(page, { name: "Para editar" });
  await page.getByRole("link", { name: "Editar" }).click();
  await page.getByLabel("Nombre de la campaña").fill("Editada");
  await goToWizardStep(page, "Límites diarios");
  await page.getByLabel("Instagram (por setter, por día)").fill("12");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Editada" })).toBeVisible();
  await expect(page.getByText("Instagram: 12")).toBeVisible();

  await page.getByRole("button", { name: "Pausar" }).click();
  await expect(page.getByText("Pausada").first()).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Archivar" }).click();
  await expect(page.getByText("Archivada").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Importar CSV" })).toHaveCount(0);

  await page.goto("/campanas");
  await expect(page.getByRole("heading", { name: "Editada" })).toHaveCount(0);
  await page.getByRole("link", { name: "Ver archivadas" }).click();
  await expect(page.getByRole("heading", { name: "Editada" })).toBeVisible();
});

test("importar CSV con mapeo, deduplicación y reporte", async ({ page }) => {
  await createCampaign(page);
  await page.getByRole("link", { name: "Importar CSV" }).click();

  const csv = [
    "Nombre;Correo;Teléfono;Instagram;Columna rara",
    "Laura Gómez;laura@clinica.example.com;+54 9 11 2345 6789;@laura.dent;x",
    "Laura repetida;LAURA@clinica.example.com;;;x",
    "Sin contacto;;;;x",
    "Martín Ruiz;martin@dental.example.com;;instagram.com/dental.ruiz;x",
  ].join("\n");
  await page.locator("#csv-file").setInputFiles({
    name: "prospectos.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });

  await expect(page.getByText("prospectos.csv · 4 filas")).toBeVisible();
  await expect(page.getByLabel("Campo para la columna Correo")).toHaveValue("email");
  await expect(page.getByLabel("Campo para la columna Columna rara")).toHaveValue("");
  await page.getByRole("button", { name: "Importar 4 filas" }).click();

  const stat = (label: string) =>
    page
      .locator("dl > div")
      .filter({ has: page.getByText(label, { exact: true }) })
      .locator("dd");
  await expect(stat("Cargados")).toHaveText("2");
  await expect(stat("Repetidos en el archivo")).toHaveText("1");
  await expect(stat("Inválidos")).toHaveText("1");
  await expect(page.getByText("Fila 4 · Inválido")).toBeVisible();

  await page.getByRole("link", { name: "Ver prospectos" }).click();
  await expect(page.getByText("Prospectos (2)")).toBeVisible();
  await expect(page.getByText("Instagram: dental.ruiz")).toBeVisible();

  // Reimportar el mismo archivo: todo ya existe.
  await page.getByRole("link", { name: "Importar CSV" }).click();
  await page.locator("#csv-file").setInputFiles({
    name: "prospectos.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });
  await page.getByRole("button", { name: "Importar 4 filas" }).click();
  await expect(stat("Cargados")).toHaveText("0");
  await expect(stat("Ya existían")).toHaveText("2");
});

test("alta manual pegando el link del perfil", async ({ page }) => {
  await createCampaign(page);
  await page.getByRole("link", { name: "Agregar prospecto" }).click();
  await page
    .getByLabel("Link del perfil, web o email")
    .fill("https://www.instagram.com/clinica.demo/?igshid=123");
  await expect(page.getByText("Detectado → Instagram: clinica.demo")).toBeVisible();
  await page.getByLabel("Nombre").fill("Clínica Demo");
  await page.getByRole("button", { name: "Agregar prospecto" }).click();
  await expect(page.getByText("Prospecto agregado.")).toBeVisible();
  await expect(page.getByText("Instagram: clinica.demo")).toBeVisible();

  await page.getByRole("link", { name: "Agregar prospecto" }).click();
  await page.getByLabel("Link del perfil, web o email").fill("instagram.com/Clinica.Demo");
  await page.getByRole("button", { name: "Agregar prospecto" }).click();
  await expect(page.getByText("Este prospecto ya existe en tu organización.")).toBeVisible();

  await page.getByLabel("Link del perfil, web o email").fill("https://www.instagram.com/p/abc123/");
  await expect(page.getByText("No reconocemos ese link.")).toBeVisible();
});

test("un setter ve las campañas y carga prospectos, pero no las gestiona", async ({ page }) => {
  const { url, name } = await createCampaign(page, { name: "Campaña del equipo" });
  await inviteAndJoin(page, "Setter", "Sofía Setter");

  await expect(page.getByRole("link", { name: "Nueva campaña" })).toHaveCount(0);
  await page.getByRole("heading", { name }).click();
  await expect(page).toHaveURL(url);
  await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pausar" })).toHaveCount(0);

  await page.getByRole("link", { name: "Agregar prospecto" }).click();
  await page.getByLabel("Link del perfil, web o email").fill("tiktok.com/@orto.demo");
  await page.getByRole("button", { name: "Agregar prospecto" }).click();
  await expect(page.getByText("TikTok: orto.demo")).toBeVisible();

  await page.goto("/campanas/nueva");
  await expect(page).toHaveURL(/\/campanas$/);
});
