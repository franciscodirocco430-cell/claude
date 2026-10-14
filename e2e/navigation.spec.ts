import { expect, test } from "@playwright/test";
import { signUp } from "./support/helpers";

const SECTIONS = [
  { label: "Campañas", path: "/campanas", heading: "Campañas" },
  { label: "Cola", path: "/cola", heading: "Cola de tareas" },
  { label: "Bandeja", path: "/bandeja", heading: "Bandeja" },
  { label: "CRM", path: "/crm", heading: "CRM" },
  { label: "Métricas", path: "/metricas", heading: "Métricas" },
  { label: /Configuración|Ajustes/, path: "/configuracion", heading: "Configuración" },
];

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("la raíz redirige a Campañas", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/campanas$/);
  await expect(page.getByRole("heading", { level: 1, name: "Campañas" })).toBeVisible();
});

test("se puede navegar por todas las secciones", async ({ page }) => {
  await page.goto("/campanas");
  const nav = page.getByRole("navigation", { name: "Principal" }).filter({ visible: true });
  for (const section of SECTIONS) {
    await nav.getByRole("link", { name: section.label }).click();
    await expect(page).toHaveURL(new RegExp(`${section.path}$`));
    await expect(page.getByRole("heading", { level: 1, name: section.heading })).toBeVisible();
    await expect(nav.getByRole("link", { name: section.label })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
});

test("sin scroll horizontal de página", async ({ page }) => {
  for (const section of SECTIONS) {
    await page.goto(section.path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, section.path).toBeLessThanOrEqual(0);
  }
});
