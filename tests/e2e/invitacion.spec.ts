import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { entornoLocal } from "./base";

// Corre el comando real (scripts/invitar.mjs) contra la base local y devuelve el enlace que imprime.
function invitar(correo: string, nombre: string, rol: string) {
  const entorno = entornoLocal();
  const salida = execFileSync("node", ["scripts/invitar.mjs", correo, nombre, rol], {
    env: { ...process.env, ...entorno, SITIO_URL: "http://127.0.0.1:3000" },
    encoding: "utf8",
  });
  const enlace = salida.match(/http\S+\/auth\/confirmar\S+/)?.[0];
  if (!enlace) throw new Error("El comando no imprimió el enlace");
  return enlace;
}

test("una persona invitada abre su enlace, elige su clave y entra con su rol", async ({ page }, info) => {
  const correo = `invitada-${Date.now()}-${info.project.name}@puesto.test`;
  const enlace = invitar(correo, "Rosa del puesto", "ayudante");

  // Una vista previa (WhatsApp) abre el enlace antes que la persona: eso no lo puede gastar.
  const vistaPrevia = await page.request.get(enlace, { maxRedirects: 0 });
  expect(vistaPrevia.status()).toBe(200);

  await page.goto(enlace);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Ya casi entras a Fructus" })).toBeVisible();
  await page.getByRole("button", { name: "Elegir mi clave" }).click();
  await expect(page).toHaveURL("/login/clave", { timeout: 15_000 });
  await page.waitForLoadState("networkidle");

  // Una clave corta se rechaza con su razón.
  await page.getByLabel("Tu clave nueva").fill("corta");
  await page.getByRole("button", { name: "Guardar y entrar" }).click();
  await expect(page.getByText("Usa 8 letras o números como mínimo.")).toBeVisible();

  await page.getByLabel("Tu clave nueva").fill("mango-kent-2026");
  await page.getByRole("button", { name: "Guardar y entrar" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });

  await page.getByRole("button", { name: /^Menú/ }).click();
  const menu = page.getByRole("dialog", { name: "Más" });
  await expect(menu.getByText("Entraste como")).toHaveText("Entraste como Rosa del puesto (Ayudante)");
  await expect(menu.getByRole("link", { name: "Ajustes" })).toHaveCount(0);
  await menu.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL("/login");

  // Con la clave que eligió, entra.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Clave", { exact: true }).fill("mango-kent-2026");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });

  // El enlace sirve una sola vez: abrirlo de nuevo muestra el botón, pero tocarlo ya no entra.
  await page.context().clearCookies();
  await page.goto(enlace);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Elegir mi clave" }).click();
  await expect(page).toHaveURL("/login?enlace=vencido", { timeout: 15_000 });
  await expect(page.getByText("Ese enlace ya no sirve")).toBeVisible();
});

test("un enlace inventado no abre nada", async ({ page }) => {
  await page.goto("/auth/confirmar?token_hash=inventado&type=invite");
  await page.getByRole("button", { name: "Elegir mi clave" }).click();
  await expect(page).toHaveURL("/login?enlace=vencido", { timeout: 15_000 });
  await page.goto("/auth/confirmar");
  await expect(page).toHaveURL("/login?enlace=vencido");
  await page.goto("/login/clave");
  await expect(page).toHaveURL("/login?enlace=vencido");
});
