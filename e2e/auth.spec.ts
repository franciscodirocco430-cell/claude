import { expect, test } from "@playwright/test";
import { logIn, PASSWORD, signOut, signUp, uniqueEmail } from "./support/helpers";

test("sin sesión, la app redirige al login conservando el destino", async ({ page }) => {
  await page.goto("/cola");
  await expect(page).toHaveURL(/\/login\?next=%2Fcola$/);
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
});

test("el registro valida los campos", async ({ page }) => {
  await page.goto("/registro");
  await page.getByLabel("Email").fill("no-es-un-email");
  await page.getByLabel("Contraseña").fill("123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText("Ingresá un email válido.")).toBeVisible();
  await expect(page.getByText(/al menos 8 caracteres/)).toBeVisible();
  await expect(page.getByText(/organización es muy corto/)).toBeVisible();
});

test("registrarse crea la organización y entra a la app", async ({ page }) => {
  const { organization } = await signUp(page, { organization: "Agencia Ñandú" });
  expect(organization).toBe("Agencia Ñandú");
  await expect(page.getByText("Agencia Ñandú").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Campañas" })).toBeVisible();
});

test("login: contraseña incorrecta muestra error; la correcta entra", async ({ page }) => {
  const { email } = await signUp(page);
  await signOut(page);

  await logIn(page, email, "otra-clave-999");
  await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();

  await logIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/campanas$/);
});

test("login respeta el destino original", async ({ page }) => {
  const { email } = await signUp(page);
  await signOut(page);
  await page.goto("/bandeja");
  await expect(page).toHaveURL(/next=%2Fbandeja/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/bandeja$/);
});

test("no se puede registrar dos veces el mismo email", async ({ page }) => {
  const email = uniqueEmail("dup");
  await signUp(page, { email });
  await signOut(page);
  await page.goto("/registro");
  await page.getByLabel("Tu nombre").fill("Otra persona");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByLabel("Nombre de tu organización").fill("Otra org");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText(/Ya existe una cuenta con ese email/)).toBeVisible();
});
