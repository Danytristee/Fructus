import { expect, test, type CDPSession, type Locator, type Page } from "@playwright/test";

import { baseLocal } from "./base";
import { cuentas } from "./cuentas";
import { crearComando, dictar, fiar } from "./dictar";
import { quieto } from "./medir";
import { microfonoControlado, sintetizadorDePrueba, terminarFrase } from "./manos-libres";

// La ficha de venta con manos libres (/formidable 2026-11-18): una venta común se lee entera sin deslizar, y deslizar para leer una
// larga ya no calla al asistente; tocarla, sí (ADR-0020). Los toques son reales (CDP Input.dispatchTouchEvent), no eventos armados.

const base = baseLocal();

/** Un cliente propio con deuda de cuatro cifras, como don Lucho: así ninguna otra prueba le cambia el saldo ni el largo de la cifra. */
async function clienteConDeuda() {
  const nombre = `Lucho ${Math.floor(10_000 + Math.random() * 90_000)}`;
  const { data, error } = await base.from("clientes").insert({ nombre }).select("id, nombre").single();
  if (error || !data) throw new Error(`No se pudo crear el cliente de prueba: ${error?.message}`);
  await fiar(data.id, 2390);
  return data;
}

/** Un cliente propio con saldo a favor: debía S/ 100 y abonó `abono` (como cuando paga de más o se anula una venta ya abonada). */
async function clienteConSaldoAFavor(abono: number) {
  const cliente = await clienteConDeuda();
  const duenio = (await base.auth.admin.listUsers()).data.users.find((u) => u.email === cuentas.duenio)!.id;
  const { error } = await base.from("abonos").insert({ cliente_id: cliente.id, monto: 2390 + abono, medio_pago: "efectivo", registrado_por: duenio });
  if (error) throw new Error(`No se pudo dejar el saldo a favor: ${error.message}`);
  return cliente;
}

const item = (id: number, nombre: string, cantidad: number, precio: number) => ({
  producto: { dicho: nombre.toLowerCase(), elegido: { id, nombre }, opciones: [] },
  cantidad,
  precio: { valor: precio, sugerido: false },
  subtotal: precio * cantidad,
});

const venta = (cliente: { id: number; nombre: string }, cambios: Record<string, unknown> = {}) => ({
  tipo: "venta",
  cliente: { dicho: "don lucho", elegido: cliente, opciones: [] },
  items: [item(3, "Plátano de seda", 10, 45)],
  descuento: 0,
  total: 450,
  condicion: "credito",
  medio: null,
  comprobante: "ninguno",
  dudas: [],
  falta: [],
  ...cambios,
});

/** Cuánto hay que deslizar la hoja para verla entera (0: entra). */
const porDeslizar = (hoja: Locator) => hoja.evaluate((h) => h.scrollHeight - h.clientHeight);

async function deslizar(page: Page, cdp: CDPSession, desde: { x: number; y: number }, dy: number) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [desde] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: desde.x, y: desde.y + (dy * i) / 12 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function tocar(cdp: CDPSession, en: { x: number; y: number }) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [en] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

const centro = async (l: Locator) => {
  const c = (await l.boundingBox())!;
  return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
};

test.beforeEach(async ({ page }) => {
  await microfonoControlado(page);
  await sintetizadorDePrueba(page, { manosLibres: true });
});

test("una venta de una fruta al crédito, con lo que ya debía, se lee entera sin deslizar", async ({ page }) => {
  const cliente = await clienteConDeuda();
  const hoja = await dictar(page, await crearComando(), venta(cliente), "¿Así fue la venta?");
  // La deuda en dos renglones: lo que debe con esta venta, y de dónde sale.
  await expect(hoja.getByText("Con esta venta te debe")).toBeVisible();
  await expect(hoja.getByText("Debía S/ 2,390.00")).toBeVisible();
  await expect(hoja.getByText("+ S/ 450.00", { exact: true })).toBeVisible();
  await quieto(page);
  expect(await porDeslizar(hoja)).toBeLessThanOrEqual(0);
});

test("una venta de dos frutas al contado, con lo que debía de antes, se lee entera sin deslizar", async ({ page }) => {
  const cliente = await clienteConDeuda();
  const tarjeta = venta(cliente, { items: [item(3, "Plátano de seda", 10, 45), item(5, "Papaya", 4, 30)], total: 570, condicion: "contado", medio: "efectivo" });
  const hoja = await dictar(page, await crearComando(), tarjeta, "¿Así fue la venta?");
  await expect(hoja.getByText("Te sigue debiendo")).toBeVisible();
  await quieto(page);
  expect(await porDeslizar(hoja)).toBeLessThanOrEqual(0);
});

test("deslizar una venta larga para leerla no calla la voz; tocarla, sí", async ({ page }) => {
  test.slow();
  const cdp = await page.context().newCDPSession(page);
  const cliente = await clienteConDeuda();
  const larga = venta(cliente, {
    items: [item(3, "Plátano de seda", 10, 45), item(5, "Papaya", 4, 30), item(6, "Piña golden", 6, 25), item(1, "Mango Kent", 5, 40)],
    total: 920,
    comprobante: "boleta",
  });
  const hoja = await dictar(page, await crearComando(), larga, "¿Así fue la venta?");
  const leyendo = hoja.getByRole("status").filter({ hasText: "Te la estoy leyendo" });
  await expect(leyendo).toBeVisible();
  await quieto(page);
  expect(await porDeslizar(hoja)).toBeGreaterThan(0);

  // Mientras lee: se desliza hasta abajo para ver el comprobante y la deuda, y sigue leyendo.
  await deslizar(page, cdp, await centro(hoja.getByText("Total", { exact: true })), -250);
  await expect.poll(() => hoja.evaluate((h) => h.scrollTop)).toBeGreaterThan(30);
  await page.waitForTimeout(300);
  await expect(leyendo).toBeVisible();

  // Termina de leer y escucha: deslizar de vuelta arriba tampoco lo calla.
  await terminarFrase(page);
  const escuchando = hoja.getByRole("status").filter({ hasText: "Te escucho" });
  await expect(escuchando).toBeVisible();
  await deslizar(page, cdp, await centro(hoja.getByText("Comprobante", { exact: true })), 200);
  await page.waitForTimeout(300);
  await expect(escuchando).toBeVisible();

  // Un toque en la tarjeta (aunque no sea un botón) es tomar el control: la voz se calla.
  await tocar(cdp, await centro(hoja.getByText("Total", { exact: true })));
  await expect(escuchando).toHaveCount(0);
  await expect(leyendo).toHaveCount(0);
});

test("con tres frutas, la que no alcanza lo dice en su fila, a la vista sin deslizar", async ({ page }) => {
  const cliente = await clienteConDeuda();
  // El stock va en la tarjeta, como lo manda el servidor: del plátano quedan 4 y se venden 10.
  const tarjeta = venta(cliente, {
    items: [item(3, "Plátano de seda", 10, 45), item(5, "Papaya", 4, 30), item(6, "Piña golden", 6, 25)],
    total: 720,
    stock: { 3: 4, 5: 50, 6: 50 },
  });
  const hoja = await dictar(page, await crearComando(), tarjeta, "¿Así fue la venta?");
  const marca = hoja.getByRole("button", { name: /cajas de Plátano de seda.*Solo hay 4$/ }).getByText("Solo hay 4");
  await expect(marca).toBeVisible();
  await quieto(page);
  await expect(marca).toBeInViewport({ ratio: 1 });
  // Ya no hay un recuadro aparte que empuje la deuda debajo del pie.
  await expect(hoja.getByText(/^Según la app/)).toHaveCount(0);
});

test("con saldo a favor, la deuda cuadra: «Tenía … a favor», y al contado «Tiene … a favor» (/chaos 2026-11-18)", async ({ page }) => {
  // Tiene S/ 200 a favor y se le fía una venta de S/ 450: queda debiendo S/ 250.
  const cliente = await clienteConSaldoAFavor(200);
  const hoja = await dictar(page, await crearComando(), venta(cliente), "¿Así fue la venta?");
  // El saldo llega del servidor después de abrir la hoja.
  await expect(hoja.getByText("Con esta venta te debe")).toBeVisible({ timeout: 15_000 });
  await expect(hoja.getByText("S/ 250.00", { exact: true })).toBeVisible();
  await expect(hoja.getByText("Tenía S/ 200.00 a favor")).toBeVisible();
  await expect(hoja.getByText("+ S/ 450.00", { exact: true })).toBeVisible();
  await expect(hoja.getByText("No debía nada")).toHaveCount(0);

  // Al contado la venta no suma: se dice lo que tiene a favor.
  await hoja.getByRole("button", { name: "Pagó", exact: true }).click();
  await expect(hoja.getByText("Tiene S/ 200.00 a favor")).toBeVisible();
});

test("si el saldo a favor alcanza para la venta al crédito, le queda a favor, sin barra de deuda, y el sello lo dice", async ({ page }) => {
  // Tiene S/ 500 a favor y se le fía una venta de S/ 450: le quedan S/ 50 a favor.
  const cliente = await clienteConSaldoAFavor(500);
  const hoja = await dictar(page, await crearComando(), venta(cliente), "¿Así fue la venta?");
  await expect(hoja.getByText("Le queda a favor")).toBeVisible({ timeout: 15_000 });
  await expect(hoja.getByText("S/ 50.00", { exact: true })).toBeVisible();
  await expect(hoja.getByText("Tenía S/ 500.00 a favor")).toBeVisible();
  await expect(hoja.getByText("Con esta venta te debe")).toHaveCount(0);

  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText("Venta guardada")).toBeVisible();
  await expect(page.getByText(`${cliente.nombre} tiene S/ 50.00 a favor`)).toBeVisible();
});
