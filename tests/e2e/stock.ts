import { expect, type Page } from "@playwright/test";

// Stock en celular tiene dos pestañas: «Qué hacer» (la que abre) y «Tu stock» (los totales y la lista de frutas).

/** Pasa a la pestaña «Tu stock» y espera la lista. */
export async function verTuStock(page: Page) {
  await page.getByRole("button", { name: "Tu stock", exact: true }).click();
  await expect(page.getByText("Tienes en el puesto")).toBeVisible({ timeout: 30_000 });
}
