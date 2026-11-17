import { expect, test } from "@playwright/test";

import { baseLocal, devolverLaHoraDeCierre } from "./base";
import { entrarComo } from "./cuentas";

// La hora de cierre la elige el dueño en Ajustes (ADR-0023): un renglón arriba, una hoja con las horas, un toque y queda guardada.
// Toca una sola fila de la base: corre en serie y deja la hora como nace la base.

test.describe.configure({ mode: "serial" });

const base = baseLocal();
const horaEnLaBase = async () => (await base.from("ajustes_puesto").select("hora_cierre").single()).data?.hora_cierre;

test.beforeEach(async () => devolverLaHoraDeCierre(base));
test.afterAll(async () => devolverLaHoraDeCierre(base));

test("el dueño cambia la hora de cierre con dos toques y queda en la base", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/ajustes");

  const renglon = page.getByRole("button", { name: /Hora de cierre/ });
  await expect(renglon).toContainText("El resumen del día te llega como a las 7 p. m.");
  await renglon.click();

  const hoja = page.getByRole("dialog", { name: "¿A qué hora cierras?" });
  await expect(hoja.getByRole("button", { name: "7 p. m.", pressed: true })).toBeVisible();
  await expect(hoja.getByRole("group", { name: "Hora de cierre" }).getByRole("button")).toHaveCount(16);
  await hoja.getByRole("button", { name: "3 p. m." }).click();

  // La hoja se cierra cuando la base respondió, y el renglón ya dice la hora nueva.
  await expect(hoja).toBeHidden();
  await expect(page.getByText("Listo: el resumen te llega como a las 3 p. m.")).toBeVisible();
  await expect(renglon).toContainText("como a las 3 p. m.");
  expect(await horaEnLaBase()).toBe(15);

  // Al volver a entrar sigue ahí: no era solo la pantalla.
  await page.reload();
  await expect(page.getByRole("button", { name: /Hora de cierre/ })).toContainText("como a las 3 p. m.");
});

test("el ayudante no ve Ajustes, así que no puede cambiar la hora", async ({ page }) => {
  await entrarComo(page, "ayudante");
  await page.goto("/ajustes");
  await expect(page.getByText("Ajustes es solo para el dueño o el administrador")).toBeVisible();
  await expect(page.getByRole("button", { name: /Hora de cierre/ })).toHaveCount(0);
  expect(await horaEnLaBase()).toBe(19);
});
