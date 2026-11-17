import { expect, test } from "@playwright/test";

import { baseLocal } from "./base";
import { abastecer, crearComando, dictar, stockDe } from "./dictar";
import { distintas, microfonoControlado, sintetizadorDePrueba } from "./manos-libres";

// El aviso de stock en la tarjeta de venta (Informe T3): si la venta pide más cajas de las que hay, lo dice, pero no bloquea. La voz se
// simula (/api/voz); el stock es el de la base local. Cada ancho usa su propia fruta para que las dos corridas no se pisen el stock.

const base = baseLocal();
type Fruta = { id: number; nombre: string };

/** La fruta activa de este ancho (la 1.ª o la 2.ª de v_stock), con al menos `minimo` cajas: si no las tiene, se compran. */
async function frutaConStock(ancho: string, minimo: number): Promise<Fruta & { stock: number }> {
  const { data } = await base.from("v_stock").select("producto_id, nombre").order("producto_id").limit(2);
  const fila = data![ancho === "s25-412" ? 0 : 1]!;
  const fruta = { id: fila.producto_id!, nombre: fila.nombre! };
  const antes = await stockDe(fruta.id);
  if (antes < minimo) await abastecer(fruta.id, minimo - antes + 5);
  return { ...fruta, stock: await stockDe(fruta.id) };
}

const tarjeta = (fruta: Fruta | null, cajas: number, cambios: Record<string, unknown> = {}) => ({
  tipo: "venta",
  cliente: { dicho: null, elegido: null, opciones: [] },
  items: [{ producto: { dicho: "fruta", elegido: fruta, opciones: [] }, cantidad: cajas, precio: { valor: 45, sugerido: false }, subtotal: 45 * cajas }],
  descuento: 0,
  total: 45 * cajas,
  condicion: "contado",
  medio: "efectivo",
  comprobante: "ninguno",
  dudas: [],
  falta: [],
  ...cambios,
});

const aviso = (stock: number, nombre: string, vendes: number) => `Según la app te quedan ${stock} cajas de ${nombre} y vas a vender ${vendes}.`;

test("si la venta pide más cajas de las que hay, lo avisa y la venta se guarda igual", async ({ page }, info) => {
  const fruta = await frutaConStock(info.project.name, 2);
  const comandoId = await crearComando();
  // Sin stock en la tarjeta: la tarjeta lo pide a la base.
  const hoja = await dictar(page, comandoId, tarjeta(fruta, fruta.stock + 4), "¿Así fue la venta?");

  await expect(hoja.getByRole("status").filter({ hasText: aviso(fruta.stock, fruta.nombre, fruta.stock + 4) })).toBeVisible();
  await expect(hoja.getByText("¿Falta anotar una compra?")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Confirmar venta" })).toBeEnabled();

  await expect(hoja.getByText("Igual puedes confirmarla. ¿Falta anotar una compra?")).toBeVisible();
  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText("Venta guardada")).toBeVisible();
  // El aviso se va con la tarjeta: el sello recuerda la compra que falta anotar.
  await expect(page.getByText(`Falta anotar la compra de ${fruta.nombre}: díctala o anótala en Stock.`)).toBeVisible();
  // Avisar no frena: la venta entró y el stock quedó en 4 bajo cero, como en el puesto cuando la compra aún no se anotó.
  expect(await stockDe(fruta.id)).toBe(-4);
});

test("si alcanza no avisa, y una caja de más hace aparecer el aviso", async ({ page }, info) => {
  const fruta = await frutaConStock(info.project.name, 3);
  // El stock viene con la tarjeta, como lo manda el servidor al dictar.
  const hoja = await dictar(page, await crearComando(), tarjeta(fruta, fruta.stock, { stock: { [fruta.id]: fruta.stock } }), "¿Así fue la venta?");
  await expect(hoja.getByText(`${fruta.stock} cajas de ${fruta.nombre}`)).toBeVisible();
  await expect(hoja.getByText(/^Según la app/)).toHaveCount(0);

  await hoja.getByRole("button", { name: new RegExp(`cajas de ${fruta.nombre}`) }).click();
  await hoja.getByRole("button", { name: "Una caja más" }).click();
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(hoja.getByRole("status").filter({ hasText: aviso(fruta.stock, fruta.nombre, fruta.stock + 1) })).toBeVisible();
});

test("una fruta elegida tocando trae su stock y su aviso", async ({ page }, info) => {
  const fruta = await frutaConStock(info.project.name, 2);
  const dudosa = { producto: { dicho: "fruta", elegido: null, opciones: [fruta] }, cantidad: fruta.stock + 2, precio: { valor: 45, sugerido: false }, subtotal: null };
  const hoja = await dictar(page, await crearComando(), tarjeta(null, 0, { items: [dudosa], total: null, falta: ["producto"] }), "¿Así fue la venta?");
  await expect(hoja.getByText(/^Según la app/)).toHaveCount(0);

  await hoja.getByRole("button", { name: /¿fruta\?/ }).click();
  await hoja.getByRole("button", { name: fruta.nombre }).first().click();
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(hoja.getByRole("status").filter({ hasText: aviso(fruta.stock, fruta.nombre, fruta.stock + 2) })).toBeVisible();
});

test("con manos libres, el aviso también se dice al leer la venta", async ({ page }, info) => {
  await microfonoControlado(page);
  await sintetizadorDePrueba(page, { manosLibres: true });
  const fruta = await frutaConStock(info.project.name, 2);
  const venta = tarjeta(fruta, fruta.stock + 4, { condicion: "credito", medio: null, cliente: { dicho: "luis", elegido: { id: 1, nombre: "Luis Paredes" }, opciones: [] }, stock: { [fruta.id]: fruta.stock } });
  await dictar(page, await crearComando(), venta, "¿Así fue la venta?");
  // Con las manos llenas no se mira: se oye antes de «¿Confirmo?». Nombre y cajas como se dicen (lectura-reglas.ts).
  await expect.poll(async () => (await distintas(page)).join(" ")).toMatch(new RegExp(`Lo debe\\. Ojo: según la app te quedan ${fruta.stock} cajas de .+\\. ¿Confirmo\\?$`));
});

test("con dos frutas que no alcanzan, un solo aviso, y el total y el pago siguen a la vista", async ({ page }) => {
  const { data } = await base.from("v_stock").select("producto_id, nombre").order("producto_id").limit(2);
  const [a, b] = data!.map((x) => ({ id: x.producto_id!, nombre: x.nombre! }));
  const item = (f: Fruta, cajas: number) => ({ producto: { dicho: "fruta", elegido: f, opciones: [] }, cantidad: cajas, precio: { valor: 45, sugerido: false }, subtotal: 45 * cajas });
  // El stock va en la tarjeta (no se guarda nada): 6 de la primera y ninguna de la segunda.
  const venta = tarjeta(a!, 10, { items: [item(a!, 10), item(b!, 3)], total: 585, condicion: null, medio: null, falta: ["condicion"], stock: { [a!.id]: 6, [b!.id]: -2 } });
  const hoja = await dictar(page, await crearComando(), venta, "¿Así fue la venta?");

  await expect(hoja.getByRole("status").filter({ hasText: `Según la app no alcanza: de ${a!.nombre} te quedan 6\u00a0cajas y vas a vender 10; de ${b!.nombre} no te queda.` })).toBeVisible();
  await expect(hoja.getByText(/^Según la app/)).toHaveCount(1);
  // Lo que se confirma manda: el total y «Pagó / Lo debe», sin deslizar (antes, a 360 px, quedaban bajo el pie).
  await expect(hoja.getByText("S/ 585.00", { exact: true })).toBeInViewport({ ratio: 1 });
  await expect(hoja.getByRole("button", { name: "Lo debe", exact: true })).toBeInViewport({ ratio: 1 });
});
