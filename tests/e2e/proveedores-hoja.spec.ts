import { expect, test } from "@playwright/test";

import { entrarComo } from "./cuentas";

// La hoja de proveedor dice en el pie qué campo está mal, con su nombre, y «Más datos» no se cierra mientras adentro hay un error: con
// «Más datos» cerrado, el pie pedía «Revisa lo marcado en rojo» y lo rojo no se veía (/chaos 2026-11-12, docs/chaos/proveedores-2026-11-12.md).

test("un RUC mal escrito se nombra en el pie y deja «Más datos» abierto hasta corregirlo", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/proveedores");
  await page.getByRole("button", { name: "Nuevo proveedor" }).click();
  const hoja = page.getByRole("dialog", { name: "Nuevo proveedor" });
  await expect(hoja).toBeVisible();

  await hoja.getByLabel("Nombre").fill("Fundo Pie Claro");
  const masDatos = hoja.getByRole("button", { name: /Más datos/ });
  await masDatos.click();
  await expect(masDatos).toHaveAttribute("aria-expanded", "true");
  await hoja.getByLabel("RUC").fill("123");

  // El pie nombra el campo, no un «revisa lo rojo» genérico.
  await expect(hoja.getByText("El RUC tiene 11 números y empieza con 10 o 20.").last()).toBeVisible();

  // Tocar «Más datos» con el error adentro no lo esconde.
  await masDatos.click();
  await expect(masDatos).toHaveAttribute("aria-expanded", "true");
  await expect(hoja.getByLabel("RUC")).toBeVisible();

  // Corregido el RUC, el aviso se va y «Más datos» vuelve a cerrarse con un toque.
  await hoja.getByLabel("RUC").fill("20123456789");
  await expect(hoja.getByText("El RUC tiene 11 números y empieza con 10 o 20.")).toHaveCount(0);
  await masDatos.click();
  await expect(masDatos).toHaveAttribute("aria-expanded", "false");
});
