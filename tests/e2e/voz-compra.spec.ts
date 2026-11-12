import { expect, test } from "@playwright/test";

import { baseLocal, enSoles } from "./base";
import { comando, crearComando, dictar, stockDe } from "./dictar";

// Dictar una compra → tarjeta → Confirmar, contra la base local (A6). Cada prueba crea su propia fruta: así las corridas en
// paralelo no se pisan el stock y la prueba no depende del catálogo que tenga la base (el catálogo real de ADR-0016 deja
// inactivas las frutas del seed, y v_stock solo muestra las activas). Al terminar se desactivan (nunca se borran datos).

const base = baseLocal();
const PREFIJO = "Fruta de compra por voz";

// Solo las de este worker: con dos en paralelo, desactivar todas las del prefijo le quitaba la fruta a la prueba que el otro
// todavía estaba corriendo (v_stock deja de mostrarla y su stock sale nulo).
const creadas: number[] = [];
test.afterAll(async () => {
  if (creadas.length) await base.from("productos").update({ activo: false }).in("id", creadas);
});

async function nuevaFruta() {
  const nombre = `${PREFIJO} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const { data, error } = await base.from("productos").insert({ nombre, unidad: "caja" }).select("id, nombre").single();
  if (error || !data) throw new Error(`No se pudo crear la fruta de prueba: ${error?.message}`);
  creadas.push(data.id);
  return data;
}
const chao = { id: 2, nombre: "Agrícola Chao" };

const comprasDe = async (comandoId: number) =>
  (await base.from("compras").select("proveedor_id, condicion, medio_pago, total, compra_items(producto_id, cantidad, costo_unitario)").eq("comando_voz_id", comandoId)).data ?? [];

function tarjeta(fruta: { id: number; nombre: string }, cambios: Record<string, unknown> = {}) {
  return {
    tipo: "compra",
    proveedor: { dicho: "el de chao", elegido: chao, opciones: [] },
    items: [{ producto: { dicho: fruta.nombre.toLowerCase(), elegido: fruta, opciones: [] }, cantidad: 50, costo: { valor: 25, sugerido: false } }],
    condicion: null,
    dudas: [],
    falta: ["condicion"],
    ...cambios,
  };
}

const dictarCompra = (page: Parameters<typeof dictar>[0], comandoId: number, t: ReturnType<typeof tarjeta>) => dictar(page, comandoId, t, "¿Así fue la compra?");

test("compra sin decir si se pagó: lo pregunta, y al crédito con dos toques se guarda una vez", async ({ page }) => {
  test.slow();
  const fruta = await nuevaFruta();
  const antes = await stockDe(fruta.id);
  const comandoId = await crearComando("registrar_compra");
  const hoja = await dictarCompra(page, comandoId, tarjeta(fruta));

  // Nunca asume contado: falta decir si se pagó, y Confirmar no guarda.
  await expect(hoja.getByRole("button", { name: "Primero: ¿pagaste o debes?" })).toBeDisabled();
  await expect(hoja.getByText(enSoles(1250))).toBeVisible();
  await hoja.getByRole("button", { name: "La debo", exact: true }).click();

  const confirmar = hoja.getByRole("button", { name: "Confirmar compra" });
  await confirmar.evaluate((b: HTMLButtonElement) => {
    b.click();
    b.click();
  });
  await expect(page.getByText("Compra guardada")).toBeVisible();
  await expect(page.getByText(`Entraron 50 cajas al stock. Le debes ${enSoles(1250)} a Agrícola Chao`)).toBeVisible();

  // Lo que quedó en la base: una sola compra al crédito, 50 cajas más (no 100) y el comando enlazado. Elegir lo que se
  // preguntó no es corregir.
  expect(await comprasDe(comandoId)).toEqual([
    { proveedor_id: 2, condicion: "credito", medio_pago: null, total: 1250, compra_items: [{ producto_id: fruta.id, cantidad: 50, costo_unitario: 25 }] },
  ]);
  expect(await stockDe(fruta.id)).toBe(antes + 50);
  expect(await comando(comandoId)).toEqual({ resultado: "confirmado", latencia_ms: expect.any(Number) });
});

test("costo sugerido corregido a mano, al contado con Yape y sin proveedor; el comando queda corregido", async ({ page }) => {
  test.slow();
  const fruta = await nuevaFruta();
  const comandoId = await crearComando("registrar_compra");
  const hoja = await dictarCompra(
    page,
    comandoId,
    tarjeta(fruta, {
      proveedor: { dicho: null, elegido: null, opciones: [] },
      items: [{ producto: { dicho: "fruta", elegido: fruta, opciones: [] }, cantidad: 10, costo: { valor: 22, sugerido: true } }],
      condicion: "contado",
      falta: [],
    }),
  );

  await expect(hoja.getByText("La compraste en el mercado")).toBeVisible();
  await expect(hoja.getByText("sugerido")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Efectivo" })).toHaveAttribute("aria-pressed", "true");

  await hoja.getByRole("button", { name: new RegExp(`10 cajas de ${fruta.nombre}`) }).click();
  await hoja.getByRole("button", { name: "Una caja más" }).click();
  await hoja.getByLabel("Costo de la caja").fill("23,50");
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(hoja.getByText("sugerido")).toHaveCount(0);
  await hoja.getByRole("button", { name: "Yape" }).click();

  await hoja.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(page.getByText("Entraron 11 cajas al stock")).toBeVisible();

  expect(await comprasDe(comandoId)).toEqual([
    { proveedor_id: null, condicion: "contado", medio_pago: "yape", total: 258.5, compra_items: [{ producto_id: fruta.id, cantidad: 11, costo_unitario: 23.5 }] },
  ]);
  expect((await comando(comandoId)).resultado).toBe("corregido");
});

test("al crédito sin proveedor no se guarda: se elige de la lista, y descartar avisa qué no guardó", async ({ page }) => {
  test.slow();
  const fruta = await nuevaFruta();
  const comandoId = await crearComando("registrar_compra");
  const hoja = await dictarCompra(
    page,
    comandoId,
    tarjeta(fruta, {
      proveedor: { dicho: "el de piura", elegido: null, opciones: [{ id: 1, nombre: "Transportes Piura Norte" }] },
      condicion: "credito",
      falta: ["proveedor"],
    }),
  );

  await expect(hoja.getByText("Falta elegir a quién le debes.")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Confirmar compra" })).toBeDisabled();

  await hoja.getByRole("button", { name: /¿el de piura\?/ }).click();
  await hoja.getByRole("button", { name: /Transportes Piura Norte/ }).click();
  await expect(hoja.getByRole("button", { name: "Confirmar compra" })).toBeEnabled();

  await hoja.getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByText("No guardé esa compra.")).toBeVisible();
  expect(await comprasDe(comandoId)).toEqual([]);
});
