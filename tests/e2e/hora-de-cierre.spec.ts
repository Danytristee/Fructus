import { expect, test, type Page } from "@playwright/test";

import { baseLocal, devolverLaHoraDeCierre } from "./base";
import { entrarComo } from "./cuentas";

// La hora de cierre la elige el dueño en Ajustes (ADR-0023, ADR-0024): un renglón arriba, una hoja con un reloj de dos ruedas (horas y
// minutos de 5 en 5) que se giran con el dedo, una frase que dice lo que va a pasar y «Guardar» abajo.
// Toca una sola fila de la base: corre en serie y deja la hora como nace la base.

test.describe.configure({ mode: "serial" });

const base = baseLocal();
const horaEnLaBase = async () => {
  const { data } = await base.from("ajustes_puesto").select("hora_cierre, minuto_cierre").single();
  return data && `${data.hora_cierre}:${String(data.minuto_cierre).padStart(2, "0")}`;
};

test.beforeEach(async () => devolverLaHoraDeCierre(base));
test.afterAll(async () => devolverLaHoraDeCierre(base));

async function abrirElReloj(page: Page) {
  await entrarComo(page, "duenio");
  await page.goto("/ajustes");
  const renglon = page.getByRole("button", { name: /Hora de cierre/ });
  await expect(renglon).toContainText("El resumen del día te llega a las 7 p. m.");
  await renglon.click();
  const hoja = page.getByRole("dialog", { name: "¿A qué hora cierras?" });
  await expect(hoja).toBeVisible();
  // La hoja sube con un resorte de medio segundo: hasta que no termina, la rueda no está donde se ve. (Las de la rueda van atadas al
  // scroll y nunca «terminan»: se esperan solo las que corren con el reloj.)
  await hoja.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).filter((a) => a.timeline === document.timeline).map((a) => a.finished)));
  return { renglon, hoja, hora: hoja.getByRole("spinbutton", { name: "Hora" }), minutos: hoja.getByRole("spinbutton", { name: "Minutos" }) };
}

test("el dueño gira la hora con el dedo y los minutos con el teclado, guarda, y queda en la base", async ({ page }) => {
  const { renglon, hoja, hora, minutos } = await abrirElReloj(page);
  await expect(hora).toHaveAttribute("aria-valuetext", "7");
  await expect(minutos).toHaveAttribute("aria-valuetext", "00");

  // Girar la rueda de la hora tres posiciones hacia arriba: 7 → 4 (p. m.).
  const caja = (await hora.boundingBox())!;
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.wheel(0, -3 * 52);
  await expect(hora).toHaveAttribute("aria-valuetext", "4");

  // Los minutos con el teclado (accesible): seis pasos de 5 → 30.
  await minutos.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowDown");
  await expect(minutos).toHaveAttribute("aria-valuetext", "30");

  // Antes de guardar, la frase dice lo que va a pasar. Girar no guarda nada.
  await expect(hoja).toContainText("Te llega todos los días a las 4:30 p. m.");
  expect(await horaEnLaBase()).toBe("19:00");

  await hoja.getByRole("button", { name: "Guardar" }).click();
  await expect(hoja).toBeHidden();
  await expect(page.getByText("Listo: el resumen te llega a las 4:30 p. m.")).toBeVisible();
  await expect(renglon).toContainText("a las 4:30 p. m.");
  expect(await horaEnLaBase()).toBe("16:30");

  // Al volver a entrar sigue ahí, y el reloj abre en la hora guardada.
  await page.reload();
  await page.getByRole("button", { name: /Hora de cierre/ }).click();
  await expect(page.getByRole("spinbutton", { name: "Hora" })).toHaveAttribute("aria-valuetext", "4");
  await expect(page.getByRole("spinbutton", { name: "Minutos" })).toHaveAttribute("aria-valuetext", "30");
});

test("tocar un número de la rueda lo lleva al centro; sin cambios, Guardar solo cierra", async ({ page }) => {
  const { hoja, hora } = await abrirElReloj(page);
  await hoja.getByRole("button", { name: "Guardar" }).click();
  await expect(hoja).toBeHidden();
  expect(await horaEnLaBase()).toBe("19:00");

  await page.getByRole("button", { name: /Hora de cierre/ }).click();
  await hora.getByText("8", { exact: true }).last().click(); // el 8 de la noche, debajo del 7
  await expect(hora).toHaveAttribute("aria-valuetext", "8");
  await expect(hoja).toContainText("Te llega todos los días a las 8 p. m.");
});

test("si no se guarda (sin señal), se dice dentro de la hoja y la hora queda como estaba", async ({ page }) => {
  const { hoja, hora } = await abrirElReloj(page);
  await hora.focus();
  await page.keyboard.press("ArrowUp");
  // Se corta la señal justo al guardar: la acción del servidor no llega.
  await page.route("**/ajustes", (ruta) => (ruta.request().method() === "POST" ? ruta.abort("internetdisconnected") : ruta.continue()));
  await hoja.getByRole("button", { name: "Guardar" }).click();
  await expect(hoja.getByRole("alert")).toContainText("No se cambió la hora");
  await expect(hoja).toBeVisible();
  expect(await horaEnLaBase()).toBe("19:00");
});

test("el ayudante no ve Ajustes, así que no puede cambiar la hora", async ({ page }) => {
  await entrarComo(page, "ayudante");
  await page.goto("/ajustes");
  await expect(page.getByText("Ajustes es solo para el dueño o el administrador")).toBeVisible();
  await expect(page.getByRole("button", { name: /Hora de cierre/ })).toHaveCount(0);
  expect(await horaEnLaBase()).toBe("19:00");
});
