import { expect, type Page } from "@playwright/test";

// Las cuentas de prueba de supabase/seed.sql (solo existen en la base local y en el CI).
export const CLAVE_PRUEBA = "puesto-prueba-2026";

export const cuentas = {
  duenio: "duenio@puesto.test",
  administrador: "administrador@puesto.test",
  ayudante: "ayudante@puesto.test",
  contador: "contador@puesto.test",
  sinPerfil: "sinperfil@puesto.test",
} as const;

export type Rol = Exclude<keyof typeof cuentas, "sinPerfil">;

export async function entrarComo(page: Page, rol: Rol) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle"); // que React termine de montarse antes de escribir
  await page.getByLabel("Correo").fill(cuentas[rol]);
  await page.getByLabel("Clave", { exact: true }).fill(CLAVE_PRUEBA);
  await page.getByRole("button", { name: "Entrar" }).click();
  // En desarrollo, la primera entrada compila «Hoy»: puede pasar de los 5 s por defecto.
  await expect(page).toHaveURL("/", { timeout: 15_000 });
}
