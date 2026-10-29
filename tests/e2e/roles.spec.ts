import { expect, test, type Page } from "@playwright/test";

import { entrarComo, type Rol } from "./cuentas";

async function abrirMenu(page: Page) {
  await page.getByRole("button", { name: /^Menú/ }).click();
  return page.getByRole("dialog", { name: "Más" });
}

const casos: { rol: Rol; nombre: string; ajustes: boolean }[] = [
  { rol: "duenio", nombre: "Dueño de prueba (Dueño)", ajustes: true },
  { rol: "administrador", nombre: "Administrador de prueba (Administrador)", ajustes: true },
  { rol: "ayudante", nombre: "Ayudante de prueba (Ayudante)", ajustes: false },
  { rol: "contador", nombre: "Contador de prueba (Contador)", ajustes: false },
];

for (const { rol, nombre, ajustes } of casos) {
  test(`${rol}: el menú dice quién entró y ${ajustes ? "muestra" : "esconde"} Ajustes`, async ({ page }) => {
    await entrarComo(page, rol);
    const menu = await abrirMenu(page);
    await expect(menu.getByText("Entraste como")).toHaveText(`Entraste como ${nombre}`);
    await expect(menu.getByRole("link", { name: "Cierre del día" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Ajustes" })).toHaveCount(ajustes ? 1 : 0);
  });

  test(`${rol}: /ajustes ${ajustes ? "abre" : "se rechaza en el servidor"} aunque se escriba a mano`, async ({ page }) => {
    await entrarComo(page, rol);
    await page.goto("/ajustes");
    if (ajustes) {
      await expect(page.getByText("Tu catálogo y tu equipo")).toBeVisible();
    } else {
      await expect(page.getByText("Ajustes es solo para el dueño o el administrador")).toBeVisible();
      await expect(page.getByText("Tu catálogo y tu equipo")).toHaveCount(0);
    }
  });
}

test("una cuenta sin perfil activo no ve la app, solo cómo pedir acceso", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo").fill("sinperfil@puesto.test");
  await page.getByLabel("Clave", { exact: true }).fill("puesto-prueba-2026");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Tu cuenta todavía no está activa")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(0);

  await page.goto("/clientes");
  await expect(page.getByText("Tu cuenta todavía no está activa")).toBeVisible();
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL("/login");
});

for (const { rol, ve } of [
  { rol: "duenio", ve: true },
  { rol: "ayudante", ve: true },
  { rol: "contador", ve: false },
] as const) {
  test(`${rol}: ${ve ? "ve" : "no ve"} el botón de voz en «Hoy»`, async ({ page }) => {
    await entrarComo(page, rol);
    await expect(page.getByText("Cobraste")).toBeVisible();
    await expect(page.getByRole("button", { name: "Botón de voz" })).toHaveCount(ve ? 1 : 0);
  });
}
