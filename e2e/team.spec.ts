import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, signOut, signUp, uniqueEmail } from "./support/helpers";

async function invite(page: Page, email: string, role: "Setter" | "Admin" = "Setter") {
  await page.goto("/configuracion");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Rol", { exact: true }).selectOption({ label: role });
  await page.getByRole("button", { name: "Invitar" }).click();
  const link = page.getByLabel("Link de invitación");
  await expect(link).toBeVisible();
  return link.inputValue();
}

test("invitar a un setter: crea su cuenta desde el link y entra con rol Setter", async ({
  page,
}) => {
  const { organization } = await signUp(page, { organization: "Equipo Invitador" });
  const setterEmail = uniqueEmail("setter");
  const link = await invite(page, setterEmail);
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: setterEmail })
      .getByRole("button", { name: "Revocar" }),
  ).toBeVisible();
  await signOut(page);

  await page.goto(link);
  await expect(page.getByText(`Te invitaron a ${organization} como Setter.`)).toBeVisible();
  await page.getByRole("link", { name: "Crear cuenta" }).click();
  await expect(page.getByLabel("Email")).toHaveValue(setterEmail);
  await expect(page.getByLabel("Nombre de tu organización")).toHaveCount(0);
  await page.getByLabel("Tu nombre").fill("Sofía Setter");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page).toHaveURL(/\/invitacion\//);
  await page.getByRole("button", { name: "Aceptar invitación" }).click();
  await expect(page).toHaveURL(/\/campanas$/);
  await expect(page.getByText(organization).filter({ visible: true }).first()).toBeVisible();

  await page.goto("/configuracion");
  await expect(page.getByRole("button", { name: "Invitar" })).toHaveCount(0);
  await expect(page.getByText("Sofía Setter")).toBeVisible();

  // El link ya usado no sirve más.
  await page.goto(link);
  await expect(page.getByText("Esta invitación ya fue usada.")).toBeVisible();
});

test("un link de invitación no sirve con otra cuenta", async ({ page }) => {
  await signUp(page);
  const link = await invite(page, uniqueEmail("destino"));
  await signOut(page);

  await signUp(page); // otra persona, con su propia org
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Cuenta equivocada" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aceptar invitación" })).toHaveCount(0);
});

test("cada organización ve solo a su equipo", async ({ page }) => {
  const a = await signUp(page, { name: "Persona A" });
  await signOut(page);
  await signUp(page, { name: "Persona B" });
  await page.goto("/configuracion");
  await expect(page.getByText("Persona B")).toBeVisible();
  await expect(page.getByText("Persona A")).toHaveCount(0);
  await expect(page.getByText(a.email)).toHaveCount(0);
});
