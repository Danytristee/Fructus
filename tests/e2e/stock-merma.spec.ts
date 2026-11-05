import { expect, test, type Locator, type Page } from "@playwright/test";

import { baseLocal } from "./base";
import { entrarComo, type Rol } from "./cuentas";
import { abastecer, stockDe } from "./dictar";
import { medir } from "./medir";

// Registrar una merma a mano (A8): la misma tarjeta que la merma por voz, llenada con lo que se toca. Cada prueba crea su propia
// fruta con stock, así las corridas en paralelo no se pisan; al terminar, esas frutas se desactivan (nunca se borran datos).

test.setTimeout(90_000);
const base = baseLocal();
const PREFIJO = "Fruta de merma";

test.afterAll(async () => {
  await base.from("productos").update({ activo: false }).like("nombre", `${PREFIJO}%`);
});

async function fruta(cajas: number | null = 10) {
  const nombre = `${PREFIJO} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const { data, error } = await base.from("productos").insert({ nombre, unidad: "caja" }).select("id, nombre").single();
  if (error || !data) throw new Error(`No se pudo crear la fruta de prueba: ${error?.message}`);
  if (cajas !== null) await abastecer(data.id, cajas);
  return data;
}

const mermasDe = async (productoId: number) =>
  (await base.from("movimientos_stock").select("cantidad, motivo, comando_voz_id").eq("producto_id", productoId).eq("tipo", "merma")).data ?? [];

/** En Stock, abre la fila de la fruta y toca «Se malogró». Devuelve la hoja ya abierta. */
async function abrirDesdeLaFila(page: Page, nombre: string, rol: Rol = "duenio") {
  await entrarComo(page, rol);
  await page.goto("/stock");
  // Cada fruta tiene su «Se malogró» dentro de su fila: se acota a la fila de esta fruta.
  const fila = page.getByRole("listitem").filter({ hasText: nombre });
  await fila.getByRole("button", { name: new RegExp(nombre) }).click();
  await fila.getByRole("button", { name: "Se malogró" }).click();
  const hoja = page.getByRole("dialog", { name: "Registrar merma" });
  await expect(hoja).toBeVisible({ timeout: 20_000 });
  return hoja;
}

async function ponerCajas(hoja: Locator, cajas: number) {
  await hoja.getByRole("button", { name: /Toca para poner las cajas|Toca para cambiar la fruta|¿Cuántas cajas de/ }).first().click();
  for (let i = 0; i < cajas; i++) await hoja.getByRole("button", { name: "Una caja más" }).click();
  await hoja.getByRole("button", { name: "Listo" }).click();
}

test("desde la fila de una fruta: la merma resta, se guarda una sola vez con dos toques y queda «a mano»", async ({ page }) => {
  const f = await fruta(10);
  const antes = await stockDe(f.id);
  const hoja = await abrirDesdeLaFila(page, f.nombre);

  // La fruta ya está; faltan las cajas, y lo dice como instrucción (sin rojo), sin inventar un número.
  await expect(hoja.getByText(`¿Cuántas cajas de ${f.nombre}?`)).toBeVisible();
  await expect(hoja.getByText("Toca para poner las cajas")).toBeVisible();
  await expect(hoja.getByText("Falta elegir cuántas cajas.")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Confirmar merma" })).toBeDisabled();
  expect(await hoja.locator(".ring-deuda, .text-deuda").count(), "nada en rojo antes de empezar").toBe(0);

  await hoja.getByRole("button", { name: /¿Cuántas cajas de/ }).click();
  await expect(hoja.getByRole("button", { name: "Listo" })).toBeDisabled(); // con 0 cajas no se deja
  for (let i = 0; i < 3; i++) await hoja.getByRole("button", { name: "Una caja más" }).click();
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(hoja.getByText(`3 cajas de ${f.nombre}`)).toBeVisible();
  await expect(hoja.getByText(/Con esta merma te quedan/)).toBeVisible();

  await hoja.getByRole("button", { name: "Confirmar merma" }).evaluate((b: HTMLButtonElement) => {
    b.click();
    b.click();
  });
  await expect(page.getByText("Merma guardada")).toBeVisible();
  await expect(page.getByText(`Te quedan 7 cajas de ${f.nombre}`)).toBeVisible();
  await expect(hoja).toBeHidden({ timeout: 5_000 });

  // Lo que quedó en la base: una sola merma de 3 (no de 6), sin motivo inventado, y el stock bajó 3.
  const mermas = await mermasDe(f.id);
  expect(mermas).toEqual([{ cantidad: -3, motivo: null, comando_voz_id: expect.any(Number) }]);
  expect(await stockDe(f.id)).toBe(antes - 3);
  const { data: comando } = await base.from("comandos_voz").select("intencion, modelo_stt, transcripcion").eq("id", mermas[0]!.comando_voz_id!).single();
  expect(comando).toMatchObject({ intencion: "registrar_merma", modelo_stt: "manual", transcripcion: "(a mano)" });
});

test("desde el botón flotante de Stock: se elige la fruta por su nombre y se pone cuántas cajas", async ({ page }) => {
  const f = await fruta(10);
  const antes = await stockDe(f.id);
  await entrarComo(page, "duenio");
  await page.goto("/stock");
  await page.getByRole("button", { name: "Registrar merma" }).click();
  const hoja = page.getByRole("dialog", { name: "Registrar merma" });
  await expect(hoja).toBeVisible({ timeout: 20_000 });

  await expect(hoja.getByRole("button", { name: /¿Qué fruta se malogró\?/ })).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Confirmar merma" })).toBeDisabled();
  await hoja.getByRole("button", { name: /¿Qué fruta se malogró\?/ }).click();
  await hoja.getByRole("searchbox", { name: "¿Qué fruta fue?" }).fill(f.nombre);
  await hoja.getByRole("button", { name: new RegExp(f.nombre) }).click();
  for (let i = 0; i < 2; i++) await hoja.getByRole("button", { name: "Una caja más" }).click();
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(hoja.getByText(`2 cajas de ${f.nombre}`)).toBeVisible();

  await hoja.getByRole("button", { name: "Confirmar merma" }).click();
  await expect(page.getByText("Merma guardada")).toBeVisible();
  expect(await mermasDe(f.id)).toEqual([{ cantidad: -2, motivo: null, comando_voz_id: expect.any(Number) }]);
  expect(await stockDe(f.id)).toBe(antes - 2);
});

test("respuesta perdida al confirmar: no dice que no se guardó, y al reintentar no se repite la merma", async ({ page }) => {
  const f = await fruta(10);
  const hoja = await abrirDesdeLaFila(page, f.nombre);
  await ponerCajas(hoja, 2);

  await page.route("**/*", async (r) => (r.request().method() === "POST" && r.request().headers()["next-action"] ? (await r.fetch(), r.abort()) : r.fallback()));
  await hoja.getByRole("button", { name: "Confirmar merma" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("La señal no respondió y no sé si se guardó. Toca Confirmar otra vez: no se va a repetir.");
  expect(await mermasDe(f.id)).toHaveLength(1);

  await page.unrouteAll();
  await hoja.getByRole("button", { name: "Confirmar merma" }).click();
  await expect(page.getByText("Merma guardada")).toBeVisible();
  expect(await mermasDe(f.id)).toHaveLength(1);
  expect(await stockDe(f.id)).toBe(8);
});

test("regresión /chaos: con la sesión vencida, a mano no promete que la merma espera en «Hoy»", async ({ page, context }) => {
  const f = await fruta(10);
  const hoja = await abrirDesdeLaFila(page, f.nombre);
  await ponerCajas(hoja, 1);
  await context.clearCookies();
  await hoja.getByRole("button", { name: "Confirmar merma" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("Tu sesión terminó. Vuelve a entrar y registra la merma otra vez.");
  await expect(hoja.getByRole("button", { name: "Entrar otra vez" })).toBeVisible();
  expect(await mermasDe(f.id)).toEqual([]);
});

test("regresión /chaos: si la fruta ya no existe, lo dice, y no manda a revisar la señal", async ({ page }) => {
  const f = await fruta(null); // sin compras ni movimientos, para que la base deje borrarla
  await entrarComo(page, "duenio");
  await page.goto("/stock");
  await page.getByRole("button", { name: "Registrar merma" }).click();
  const hoja = page.getByRole("dialog", { name: "Registrar merma" });
  await expect(hoja).toBeVisible({ timeout: 20_000 });
  await hoja.getByRole("button", { name: /¿Qué fruta se malogró\?/ }).click();
  await hoja.getByRole("searchbox", { name: "¿Qué fruta fue?" }).fill(f.nombre);
  await hoja.getByRole("button", { name: new RegExp(f.nombre) }).click();
  await hoja.getByRole("button", { name: "Una caja más" }).click();
  await hoja.getByRole("button", { name: "Listo" }).click();
  await base.from("productos").delete().eq("id", f.id);
  await hoja.getByRole("button", { name: "Confirmar merma" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("Esa fruta ya no está en tu catálogo. Elige otra.");
  expect(await mermasDe(f.id)).toEqual([]);
});

test("descartar cierra la hoja sin guardar nada", async ({ page }) => {
  const f = await fruta(10);
  const hoja = await abrirDesdeLaFila(page, f.nombre);
  await ponerCajas(hoja, 2);
  await hoja.getByRole("button", { name: "Descartar" }).click();
  await expect(hoja).toBeHidden({ timeout: 5_000 });
  expect(await mermasDe(f.id)).toEqual([]);
  expect(await stockDe(f.id)).toBe(10);
});

test("el botón flotante es una píldora compacta que no tapa el último renglón ni se sale de la pantalla", async ({ page }) => {
  await fruta(10);
  await entrarComo(page, "duenio");
  await page.goto("/stock");
  const boton = page.getByRole("button", { name: "Registrar merma" });
  await expect(boton).toBeVisible();
  const { desborde } = await medir(page);
  expect(desborde).toBeLessThanOrEqual(0);

  const { width: ancho, height: alto } = page.viewportSize()!;
  const caja = await boton.boundingBox();
  expect(caja!.height).toBeLessThanOrEqual(56);
  expect(caja!.width).toBeLessThan(ancho * 0.75);
  expect(caja!.y).toBeGreaterThan((alto * 2) / 3);
  expect(Math.abs(caja!.x + caja!.width / 2 - ancho / 2)).toBeLessThan(2);

  // Hasta abajo del todo, la última fruta queda por encima del botón, no debajo.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const ultima = await page.getByRole("heading", { name: "Tu stock" }).locator("xpath=following::ul[1]/li[last()]").boundingBox();
  expect(ultima!.y + ultima!.height).toBeLessThanOrEqual(caja!.y);
});

test("el ayudante registra una merma a mano", async ({ page }) => {
  const f = await fruta(10);
  const hoja = await abrirDesdeLaFila(page, f.nombre, "ayudante");
  await ponerCajas(hoja, 1);
  await hoja.getByRole("button", { name: "Confirmar merma" }).click();
  await expect(page.getByText("Merma guardada")).toBeVisible();
  expect(await mermasDe(f.id)).toEqual([{ cantidad: -1, motivo: null, comando_voz_id: expect.any(Number) }]);
  expect(await stockDe(f.id)).toBe(9);
});

test("el contador ve el stock pero no «Registrar merma» ni «Se malogró»", async ({ page }) => {
  const f = await fruta(10);
  await entrarComo(page, "contador");
  await page.goto("/stock");
  const fila = page.getByRole("listitem").filter({ hasText: f.nombre });
  await fila.getByRole("button", { name: new RegExp(f.nombre) }).click();
  await expect(fila.getByText("Alcanza para")).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar merma" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Se malogró" })).toHaveCount(0);
});

test("el dueño y el ayudante merman la misma fruta a la vez: el stock baja la suma, sin perder ninguna", async ({ page, browser }) => {
  const f = await fruta(10);
  const hojaA = await abrirDesdeLaFila(page, f.nombre, "duenio");
  const ctx = await browser.newContext({ baseURL: "http://127.0.0.1:3000", viewport: page.viewportSize()!, locale: "es-PE", timezoneId: "America/Lima" });
  const paginaB = await ctx.newPage();
  const hojaB = await abrirDesdeLaFila(paginaB, f.nombre, "ayudante");
  await ponerCajas(hojaA, 3);
  await ponerCajas(hojaB, 4);
  await Promise.all([hojaA.getByRole("button", { name: "Confirmar merma" }).click(), hojaB.getByRole("button", { name: "Confirmar merma" }).click()]);
  await expect(page.getByText("Merma guardada")).toBeVisible();
  await expect(paginaB.getByText("Merma guardada")).toBeVisible();
  const mermas = await mermasDe(f.id);
  await ctx.close();
  expect(mermas.map((m) => m.cantidad).sort((a, b) => a - b)).toEqual([-4, -3]);
  expect(new Set(mermas.map((m) => m.comando_voz_id)).size).toBe(2);
  expect(await stockDe(f.id)).toBe(3);
});
