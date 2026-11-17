import { expect, test } from "@playwright/test";

import { baseLocal, enSoles } from "./base";
import { comando, crearComando, dictar } from "./dictar";

// «Vendí 10 cajas de mango a don Lucho a 500 y pagó solo 1000» (ADR-0023): la tarjeta dice cuánto pagó y cuánto queda debiendo,
// y al confirmar la venta queda al crédito por S/ 5,000 con un abono de S/ 1,000 atado a ella. La voz se simula (/api/voz); la base
// es la local. Cada ancho usa su propio cliente para que las dos corridas en paralelo no se pisen las deudas.

const base = baseLocal();
const clientePorAncho = { "s25-412": { id: 1, nombre: "Luis Paredes" }, "gama-media-360": { id: 4, nombre: "Bodega Santa Ana" } } as const;
type Ancho = keyof typeof clientePorAncho;

const saldoDe = async (clienteId: number) => Number((await base.from("v_saldo_clientes").select("saldo").eq("cliente_id", clienteId).single()).data!.saldo);
const ventaDe = async (comandoId: number) => (await base.from("ventas").select("id, condicion, medio_pago, total, abonos(monto, medio_pago, nota)").eq("comando_voz_id", comandoId).single()).data!;

function tarjeta(cliente: { id: number; nombre: string }, cambios: Record<string, unknown> = {}) {
  return {
    tipo: "venta",
    cliente: { dicho: "don lucho", elegido: cliente, opciones: [] },
    items: [{ producto: { dicho: "mango", elegido: { id: 1, nombre: "Mango Kent" }, opciones: [] }, cantidad: 10, precio: { valor: 500, sugerido: false }, subtotal: 5000 }],
    descuento: 0,
    total: 5000,
    condicion: "credito",
    medio: "efectivo",
    pagoParcial: 1000,
    comprobante: "ninguno",
    dudas: [],
    falta: [],
    ...cambios,
  };
}

test("dictado con pago parcial: dice cuánto pagó y cuánto debe, y guarda la venta al crédito con su abono", async ({ page }, info) => {
  test.slow();
  const cliente = clientePorAncho[info.project.name as Ancho];
  const comandoId = await crearComando();
  const antes = await saldoDe(cliente.id);
  const hoja = await dictar(page, comandoId, tarjeta(cliente), "¿Así fue la venta?");

  await expect(hoja.getByRole("button", { name: "Debe el resto" })).toHaveAttribute("aria-pressed", "true");
  await expect(hoja.getByRole("button", { name: /Pagó ahora/ })).toContainText(enSoles(1000));
  await expect(hoja.getByText("Queda debiendo")).toBeVisible();
  await expect(hoja.getByText(enSoles(4000), { exact: true })).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Efectivo" })).toHaveAttribute("aria-pressed", "true");
  await hoja.getByRole("button", { name: "Yape" }).click();
  await expect(hoja.getByRole("button", { name: "Yape" })).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(400); // que termine la transición de color antes de la captura
  await page.screenshot({ path: info.outputPath(`pago-parcial-${info.project.name}.png`), fullPage: false });

  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText("Venta guardada")).toBeVisible();
  await expect(page.getByText(`${cliente.nombre} te debe ${enSoles(antes + 4000)}`)).toBeVisible();

  // Lo que quedó en la base: la venta al crédito por el total y lo que pagó como abono de esa venta, con Yape.
  const venta = await ventaDe(comandoId);
  expect(venta).toMatchObject({ condicion: "credito", medio_pago: null, total: 5000, abonos: [{ monto: 1000, medio_pago: "yape", nota: "al llevar" }] });
  expect(await saldoDe(cliente.id)).toBe(antes + 4000);
  // Cambiar el medio es corregir lo que se entendió.
  expect((await comando(comandoId)).resultado).toBe("corregido");
});

test("«Lo debe» sin pago dicho: se anota a mano lo que dejó, y pagar todo pide tocar «Pagó»", async ({ page }, info) => {
  test.slow();
  const cliente = clientePorAncho[info.project.name as Ancho];
  const comandoId = await crearComando();
  const antes = await saldoDe(cliente.id);
  const hoja = await dictar(page, comandoId, tarjeta(cliente, { pagoParcial: null, medio: null }), "¿Así fue la venta?");

  await expect(hoja.getByRole("button", { name: "Lo debe", exact: true })).toHaveAttribute("aria-pressed", "true");
  await hoja.getByRole("button", { name: "Pagó una parte" }).click();
  const campo = hoja.getByLabel("¿Cuánto te pagó ahora?");
  await campo.fill("5000");
  await expect(hoja.getByText("toca «Pagó»: no debe nada")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Listo" })).toBeDisabled();
  await campo.fill("1500");
  await hoja.getByRole("button", { name: "Listo" }).click();

  await expect(hoja.getByText(enSoles(3500), { exact: true })).toBeVisible();
  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText("Venta guardada")).toBeVisible();

  const venta = await ventaDe(comandoId);
  expect(venta).toMatchObject({ condicion: "credito", total: 5000, abonos: [{ monto: 1500, medio_pago: "efectivo" }] });
  expect(await saldoDe(cliente.id)).toBe(antes + 3500);
});

test("con algo anotado, «No pagó nada» lo quita y la venta queda debiendo todo", async ({ page }, info) => {
  test.slow();
  const cliente = clientePorAncho[info.project.name as Ancho];
  const comandoId = await crearComando();
  const antes = await saldoDe(cliente.id);
  const hoja = await dictar(page, comandoId, tarjeta(cliente), "¿Así fue la venta?");

  await hoja.getByRole("button", { name: "No pagó nada" }).click();
  await expect(hoja.getByRole("button", { name: "Pagó una parte" })).toBeVisible();
  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText("Venta guardada")).toBeVisible();

  expect((await ventaDe(comandoId)).abonos).toEqual([]);
  expect(await saldoDe(cliente.id)).toBe(antes + 5000);
});
