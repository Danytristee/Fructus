import { expect, test, type Locator, type Page } from "@playwright/test";

import { baseLocal } from "./base";
import { entrarComo, type Rol } from "./cuentas";
import { abastecer, stockDe } from "./dictar";
import { medir } from "./medir";

// Registrar una compra a mano (A8): la misma tarjeta que la compra por voz, llenada con lo que se toca. Nunca se asume que se
// pagó, al crédito exige proveedor, y un doble toque o una respuesta perdida no duplican la compra ni las cajas. Cada prueba crea
// sus propias frutas; al terminar se desactivan (nunca se borran datos).

test.setTimeout(90_000);
const base = baseLocal();
const PREFIJO = "Fruta de compra";

test.afterAll(async () => {
  await base.from("productos").update({ activo: false }).like("nombre", `${PREFIJO}%`);
});

/** Una fruta de prueba. Con `cajas`, ya tiene una compra anterior a S/ 20 la caja (de ahí sale el costo «sugerido»). */
async function fruta(cajas: number | null = null) {
  const nombre = `${PREFIJO} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const { data, error } = await base.from("productos").insert({ nombre, unidad: "caja" }).select("id, nombre").single();
  if (error || !data) throw new Error(`No se pudo crear la fruta de prueba: ${error?.message}`);
  if (cajas !== null) await abastecer(data.id, cajas);
  return data;
}

type CompraDe = {
  cantidad: number;
  costo_unitario: number;
  compra: { id: number; condicion: string; medio_pago: string | null; total: number; proveedor_id: number | null; comando_voz_id: number | null };
};

const comprasDe = async (productoId: number) =>
  ((
    await base
      .from("compra_items")
      .select("cantidad, costo_unitario, compra:compras(id, condicion, medio_pago, total, proveedor_id, comando_voz_id)")
      .eq("producto_id", productoId)
      .order("id")
  ).data ?? []) as unknown as CompraDe[];

async function abrirCompra(page: Page, rol: Rol = "duenio") {
  await entrarComo(page, rol);
  await page.goto("/stock");
  await page.getByRole("button", { name: "Compra", exact: true }).click();
  const hoja = page.getByRole("dialog", { name: "Registrar compra" });
  await expect(hoja).toBeVisible({ timeout: 20_000 });
  return hoja;
}

/** Elige la fruta por su nombre, pone las cajas y el costo (si se pasa), y vuelve a la tarjeta. */
async function llenarFruta(hoja: Locator, nombre: string, cajas: number, costo: string | null, fila: RegExp = /¿Qué fruta\?/) {
  await hoja.getByRole("button", { name: fila }).click();
  await hoja.getByRole("searchbox", { name: "¿Qué fruta fue?" }).fill(nombre);
  await hoja.getByRole("button", { name: new RegExp(nombre) }).click();
  for (let i = 0; i < cajas; i++) await hoja.getByRole("button", { name: "Una caja más" }).click();
  if (costo !== null) await hoja.getByLabel(/Costo de la caja/).fill(costo);
  await hoja.getByRole("button", { name: "Listo" }).click();
}

async function elegirProveedor(hoja: Locator, busqueda: string, nombre: string) {
  await hoja.getByRole("button", { name: /¿Quién te la trajo\?/ }).click();
  await hoja.getByRole("searchbox", { name: "¿Quién te la trajo?" }).fill(busqueda);
  await hoja.getByRole("button", { name: new RegExp(nombre) }).click();
}

async function idDe(tabla: "proveedores", nombre: string) {
  const { data } = await base.from(tabla).select("id").eq("nombre", nombre).single();
  return data!.id;
}

test("compra al contado con proveedor: entran las cajas, se guarda una sola vez con dos toques y queda «a mano»", async ({ page }) => {
  const f = await fruta();
  const chao = await idDe("proveedores", "Agrícola Chao");
  const hoja = await abrirCompra(page);

  // Vacía, pide en vez de regañar: ni un recuadro rojo, y nada se asume (ni la fruta, ni el costo, ni que se pagó).
  await expect(hoja.getByRole("button", { name: /¿Quién te la trajo\?/ })).toBeVisible();
  await expect(hoja.getByRole("button", { name: /¿Qué fruta\?/ })).toBeVisible();
  await expect(hoja.getByText("Falta el costo")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Confirmar compra" })).toBeDisabled();
  // «La debo» lleva su color a propósito (cada opción tiene el suyo); los cuadros y los avisos no marcan nada en rojo.
  expect(await hoja.locator(".ring-deuda").count(), "ningún recuadro en rojo antes de empezar").toBe(0);
  await expect(hoja.getByText("Falta el costo")).not.toHaveClass(/text-deuda/);
  await expect(hoja.getByText(/^Falta elegir/)).not.toHaveClass(/text-deuda/);

  await elegirProveedor(hoja, "chao", "Agrícola Chao");
  await llenarFruta(hoja, f.nombre, 5, "20");
  await expect(hoja.getByText(`5 cajas de ${f.nombre}`)).toBeVisible();
  await expect(hoja.getByText("S/ 100.00").first()).toBeVisible();

  // Con todo puesto menos si se pagó, no se deja confirmar: nunca se asume contado.
  const confirmar = hoja.getByRole("button", { name: /Primero: ¿pagaste o debes\?/ });
  await expect(confirmar).toBeDisabled();
  await hoja.getByRole("button", { name: "Pagué" }).click();
  await expect(hoja.getByRole("button", { name: "Efectivo" })).toHaveAttribute("aria-pressed", "true");

  await hoja.getByRole("button", { name: "Confirmar compra" }).evaluate((b: HTMLButtonElement) => {
    b.click();
    b.click();
  });
  await expect(page.getByText("Compra guardada")).toBeVisible();
  await expect(page.getByText("Entraron 5 cajas al stock")).toBeVisible();
  await expect(hoja).toBeHidden({ timeout: 5_000 });

  // Lo que quedó en la base: una sola compra de 5 cajas a 20 (no 10), contado en efectivo, con su proveedor, y el stock subió 5.
  const compras = await comprasDe(f.id);
  expect(compras).toEqual([
    {
      cantidad: 5,
      costo_unitario: 20,
      compra: { id: expect.any(Number), condicion: "contado", medio_pago: "efectivo", total: 100, proveedor_id: chao, comando_voz_id: expect.any(Number) },
    },
  ]);
  expect(await stockDe(f.id)).toBe(5);
  const { data: comando } = await base.from("comandos_voz").select("intencion, modelo_stt, transcripcion").eq("id", compras[0]!.compra.comando_voz_id!).single();
  expect(comando).toMatchObject({ intencion: "registrar_compra", modelo_stt: "manual", transcripcion: "(a mano)" });
});

test("al crédito pide a quién le debes: sin proveedor no se guarda, con proveedor queda la deuda y sin medio de pago", async ({ page }) => {
  const f = await fruta();
  const chao = await idDe("proveedores", "Agrícola Chao");
  const hoja = await abrirCompra(page);
  await llenarFruta(hoja, f.nombre, 2, "30");

  await hoja.getByRole("button", { name: "La debo" }).click();
  await expect(hoja.getByText("Falta elegir a quién le debes.")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Confirmar compra" })).toBeDisabled();

  await elegirProveedor(hoja, "chao", "Agrícola Chao");
  await expect(hoja.getByRole("button", { name: "Confirmar compra" })).toBeEnabled();
  await hoja.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(page.getByText("Compra guardada")).toBeVisible();
  await expect(page.getByText(/Le debes/)).toContainText("S/ 60.00");

  const compras = await comprasDe(f.id);
  expect(compras).toHaveLength(1);
  expect(compras[0]!.compra).toMatchObject({ condicion: "credito", medio_pago: null, total: 60, proveedor_id: chao });
});

test("el costo se sugiere con lo último que pagaste, se marca «sugerido» y se puede guardar así", async ({ page }) => {
  const f = await fruta(10); // ya se compró a S/ 20 la caja
  const hoja = await abrirCompra(page);
  await hoja.getByRole("button", { name: /¿Qué fruta\?/ }).click();
  await hoja.getByRole("searchbox", { name: "¿Qué fruta fue?" }).fill(f.nombre);
  await hoja.getByRole("button", { name: new RegExp(f.nombre) }).click();
  for (let i = 0; i < 2; i++) await hoja.getByRole("button", { name: "Una caja más" }).click();
  // El servidor trae el último costo; la persona lo ve en el campo antes de tocar «Listo».
  await expect(hoja.getByLabel(/Costo de la caja/)).toHaveValue("20");
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(hoja.getByText(/S\/\s20\.00 la caja/)).toBeVisible();
  await expect(hoja.getByText("sugerido")).toBeVisible();
  await hoja.getByRole("button", { name: "Pagué" }).click();
  await hoja.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(page.getByText("Compra guardada")).toBeVisible();
  const compras = await comprasDe(f.id);
  expect(compras.at(-1)).toMatchObject({ cantidad: 2, costo_unitario: 20 });
  expect(await stockDe(f.id)).toBe(12);
});

test("dos frutas en la misma compra: el total suma, se puede quitar la última y queda una sola compra", async ({ page }) => {
  const a = await fruta();
  const b = await fruta();
  const hoja = await abrirCompra(page);
  await llenarFruta(hoja, a.nombre, 5, "20");

  // «Otra fruta» abre el editor de una fila nueva, ya buscando la fruta.
  await hoja.getByRole("button", { name: "Otra fruta" }).click();
  await hoja.getByRole("searchbox", { name: "¿Qué fruta fue?" }).fill(b.nombre);
  await hoja.getByRole("button", { name: new RegExp(b.nombre) }).click();
  for (let i = 0; i < 3; i++) await hoja.getByRole("button", { name: "Una caja más" }).click();
  await hoja.getByLabel(/Costo de la caja/).fill("10");
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(hoja.getByText("S/ 130.00").first()).toBeVisible();

  // Quitar la última deja solo la primera; se vuelve a agregar.
  await hoja.getByRole("button", { name: "Quitar la última fruta" }).click();
  await expect(hoja.getByText("S/ 100.00").first()).toBeVisible();
  await hoja.getByRole("button", { name: "Otra fruta" }).click();
  await hoja.getByRole("searchbox", { name: "¿Qué fruta fue?" }).fill(b.nombre);
  await hoja.getByRole("button", { name: new RegExp(b.nombre) }).click();
  for (let i = 0; i < 3; i++) await hoja.getByRole("button", { name: "Una caja más" }).click();
  await hoja.getByLabel(/Costo de la caja/).fill("10");
  await hoja.getByRole("button", { name: "Listo" }).click();

  await hoja.getByRole("button", { name: "Pagué" }).click();
  await hoja.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(page.getByText("Compra guardada")).toBeVisible();
  await expect(page.getByText("Entraron 8 cajas al stock")).toBeVisible();

  const [ca, cb] = [await comprasDe(a.id), await comprasDe(b.id)];
  expect(ca).toHaveLength(1);
  expect(cb).toHaveLength(1);
  expect(ca[0]!.compra.id).toBe(cb[0]!.compra.id); // una sola compra con las dos frutas
  expect(ca[0]!.compra.total).toBe(130);
  expect([await stockDe(a.id), await stockDe(b.id)]).toEqual([5, 3]);
});

test("respuesta perdida al confirmar: no dice que no se guardó, y al reintentar no se repite la compra", async ({ page }) => {
  const f = await fruta();
  const hoja = await abrirCompra(page);
  await llenarFruta(hoja, f.nombre, 4, "25");
  await hoja.getByRole("button", { name: "Pagué" }).click();

  await page.route("**/*", async (r) => (r.request().method() === "POST" && r.request().headers()["next-action"] ? (await r.fetch(), r.abort()) : r.fallback()));
  await hoja.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("La señal no respondió y no sé si se guardó. Toca Confirmar otra vez: no se va a repetir.");
  expect(await comprasDe(f.id)).toHaveLength(1);

  await page.unrouteAll();
  await hoja.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(page.getByText("Compra guardada")).toBeVisible();
  expect(await comprasDe(f.id)).toHaveLength(1);
  expect(await stockDe(f.id)).toBe(4);
});

test("regresión /chaos: con la sesión vencida, a mano no promete que la compra espera en «Hoy»", async ({ page, context }) => {
  const f = await fruta();
  const hoja = await abrirCompra(page);
  await llenarFruta(hoja, f.nombre, 1, "20");
  await hoja.getByRole("button", { name: "Pagué" }).click();
  await context.clearCookies();
  await hoja.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("Tu sesión terminó. Vuelve a entrar y registra la compra otra vez.");
  await expect(hoja.getByRole("button", { name: "Entrar otra vez" })).toBeVisible();
  expect(await comprasDe(f.id)).toEqual([]);
});

test("regresión /chaos: si la fruta ya no existe, lo dice, y no manda a revisar la señal", async ({ page }) => {
  const f = await fruta();
  const hoja = await abrirCompra(page);
  await llenarFruta(hoja, f.nombre, 1, "20");
  await hoja.getByRole("button", { name: "Pagué" }).click();
  await base.from("productos").delete().eq("id", f.id);
  await hoja.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("Una fruta o el proveedor de la compra ya no está. Vuelve a elegirlos.");
});

test("el dueño y el ayudante compran la misma fruta a la vez: el stock sube la suma, sin perder ninguna", async ({ page, browser, baseURL }) => {
  const f = await fruta();
  const hojaA = await abrirCompra(page, "duenio");
  const ctx = await browser.newContext({ baseURL, viewport: page.viewportSize()!, locale: "es-PE", timezoneId: "America/Lima" });
  const paginaB = await ctx.newPage();
  const hojaB = await abrirCompra(paginaB, "ayudante");
  await llenarFruta(hojaA, f.nombre, 5, "20");
  await llenarFruta(hojaB, f.nombre, 3, "20");
  await hojaA.getByRole("button", { name: "Pagué" }).click();
  await hojaB.getByRole("button", { name: "Pagué" }).click();
  await Promise.all([hojaA.getByRole("button", { name: "Confirmar compra" }).click(), hojaB.getByRole("button", { name: "Confirmar compra" }).click()]);
  await expect(page.getByText("Compra guardada")).toBeVisible();
  await expect(paginaB.getByText("Compra guardada")).toBeVisible();
  const compras = await comprasDe(f.id);
  await ctx.close();
  expect(compras.map((c) => c.cantidad).sort((a, b) => a - b)).toEqual([3, 5]);
  expect(new Set(compras.map((c) => c.compra.comando_voz_id)).size).toBe(2);
  expect(await stockDe(f.id)).toBe(8);
});

test("la barra de Stock lleva «Compra» y «Merma» como píldoras compactas, juntas, centradas y sin tapar la última fruta", async ({ page }) => {
  await fruta(10);
  await entrarComo(page, "duenio");
  await page.goto("/stock");
  const compra = page.getByRole("button", { name: "Compra", exact: true });
  const merma = page.getByRole("button", { name: "Merma", exact: true });
  await expect(compra).toBeVisible();
  await expect(merma).toBeVisible();
  const { desborde } = await medir(page);
  expect(desborde).toBeLessThanOrEqual(0);

  const { width: ancho, height: alto } = page.viewportSize()!;
  const [a, b] = [(await compra.boundingBox())!, (await merma.boundingBox())!];
  for (const caja of [a, b]) {
    expect(caja.height).toBeLessThanOrEqual(56);
    expect(caja.height).toBeGreaterThanOrEqual(48);
    expect(caja.y).toBeGreaterThan((alto * 2) / 3);
  }
  expect(Math.abs(a.y - b.y), "en la misma fila").toBeLessThan(2);
  expect(b.x - (a.x + a.width), "separadas 8 px o más").toBeGreaterThanOrEqual(8);
  expect(Math.abs((a.x + b.x + b.width) / 2 - ancho / 2), "el par, centrado").toBeLessThan(2);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const ultima = await page.getByRole("heading", { name: "Tu stock" }).locator("xpath=following::ul[1]/li[last()]").boundingBox();
  expect(ultima!.y + ultima!.height).toBeLessThanOrEqual(Math.min(a.y, b.y));
});

test("el ayudante registra una compra a mano", async ({ page }) => {
  const f = await fruta();
  const hoja = await abrirCompra(page, "ayudante");
  await llenarFruta(hoja, f.nombre, 2, "20");
  await hoja.getByRole("button", { name: "Pagué" }).click();
  await hoja.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(page.getByText("Compra guardada")).toBeVisible();
  expect(await stockDe(f.id)).toBe(2);
});

test("el contador ve el stock pero no «Compra» ni «Merma»", async ({ page }) => {
  await entrarComo(page, "contador");
  await page.goto("/stock");
  await expect(page.getByRole("heading", { level: 1, name: "Stock" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Compra", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Merma", exact: true })).toHaveCount(0);
});
