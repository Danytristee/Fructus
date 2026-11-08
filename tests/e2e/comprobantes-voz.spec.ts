import { expect, test, type Page } from "@playwright/test";

import { baseLocal, invariantes } from "./base";
import { comando, crearComando, dictar } from "./dictar";
import { conEscenario, recibidosPorLucode, sinMarca, type Escenario } from "./lucode";

// Dictar una venta «con boleta» o «con factura» (A9.4): al confirmar, la venta se guarda y recién entonces se emite lo pedido. Si el
// comprobante no puede salir (falta el RUC, Lucode no contesta), la venta igual queda guardada y el sello dice qué pasó. La voz se
// simula (/api/voz), pero el comando, la venta y el comprobante son reales; el proveedor es el Lucode simulado.

test.setTimeout(90_000);
const base = baseLocal();

const rucAlAzar = () => `20${String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, "0")}`;

async function clienteNuevo(nombre: string, documento?: { tipo_documento: "RUC" | "DNI"; numero_documento: string }, escenario?: Escenario) {
  // La marca de escenario va al final del nombre (así la lee el simulador): primero el nombre único, después la marca.
  const unico = `${nombre} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const { data, error } = await base.from("clientes").insert({ nombre: escenario ? conEscenario(unico, escenario) : unico, ...documento }).select("id, nombre").single();
  if (error || !data) throw new Error(`No se pudo crear el cliente: ${error?.message}`);
  return data;
}

function tarjeta(cliente: { id: number; nombre: string } | null, comprobante: "ninguno" | "boleta" | "factura", cambios: Record<string, unknown> = {}) {
  return {
    tipo: "venta",
    cliente: { dicho: cliente ? sinMarca(cliente.nombre).toLowerCase() : null, elegido: cliente, opciones: [] },
    items: [{ producto: { dicho: "mango", elegido: { id: 1, nombre: "Mango Kent" }, opciones: [] }, cantidad: 4, precio: { valor: 50, sugerido: false }, subtotal: 200 }],
    descuento: 0,
    total: 200,
    condicion: "contado",
    medio: "efectivo",
    comprobante,
    dudas: [],
    falta: [],
    ...cambios,
  };
}

const dictarVenta = (page: Page, comandoId: number, t: ReturnType<typeof tarjeta>) => dictar(page, comandoId, t, "¿Así fue la venta?");
const ventaDe = async (comandoId: number) => (await base.from("ventas").select("id, total").eq("comando_voz_id", comandoId)).data ?? [];
const comprobantesDe = async (ventaId: number) => (await base.from("comprobantes").select("*").eq("venta_id", ventaId)).data ?? [];

test("«… boleta»: la tarjeta muestra el comprobante entendido; al confirmar se guarda la venta y sale la boleta", async ({ page }) => {
  const cliente = await clienteNuevo("Cliente de voz boleta");
  const comandoId = await crearComando();
  const hoja = await dictarVenta(page, comandoId, tarjeta(cliente, "boleta"));
  await expect(hoja.getByRole("group", { name: "¿Con comprobante?" }).getByRole("button", { name: "Boleta" })).toHaveAttribute("aria-pressed", "true");

  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText("Venta guardada")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Boleta B001-\d{8} aceptada/)).toBeVisible();

  const [venta] = await ventaDe(comandoId);
  expect(venta).toBeTruthy();
  const [c] = await comprobantesDe(venta!.id);
  expect(c).toMatchObject({ tipo: "03", serie: "B001", estado: "aceptado" });
  const recibidos = await recibidosPorLucode(cliente.nombre);
  expect(recibidos).toHaveLength(1);
  expect(recibidos[0]).toMatchObject({ tipo: "03", totales: { exonerado: 200, total: 200 } });
  expect(invariantes()).toBe("limpias");
});

test("«… factura» a un cliente con RUC: sale la factura con su RUC", async ({ page }) => {
  const ruc = rucAlAzar();
  const cliente = await clienteNuevo("Cliente de voz factura", { tipo_documento: "RUC", numero_documento: ruc });
  const comandoId = await crearComando();
  const hoja = await dictarVenta(page, comandoId, tarjeta(cliente, "factura"));
  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText(/Factura F001-\d{8} aceptada/)).toBeVisible({ timeout: 20_000 });

  const [venta] = await ventaDe(comandoId);
  expect((await comprobantesDe(venta!.id))[0]).toMatchObject({ tipo: "01", serie: "F001", estado: "aceptado" });
  expect((await recibidosPorLucode(cliente.nombre))[0]!.cliente).toMatchObject({ tipo_documento: "6", numero_documento: ruc });
  expect(invariantes()).toBe("limpias"); // INV-11
});

test("«… factura» a un cliente sin RUC: la venta se guarda, no se gasta un número, y el sello dice qué falta", async ({ page }) => {
  const cliente = await clienteNuevo("Cliente de voz sin RUC");
  const comandoId = await crearComando();
  const hoja = await dictarVenta(page, comandoId, tarjeta(cliente, "factura"));
  await hoja.getByRole("button", { name: "Confirmar venta" }).click();

  await expect(page.getByText("Venta guardada")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("La venta quedó guardada, pero la factura no salió: Una factura va a un cliente con RUC. Agrégale el RUC en su ficha.")).toBeVisible();
  const [venta] = await ventaDe(comandoId);
  expect(venta).toBeTruthy(); // lo dictado no se pierde
  expect(await comprobantesDe(venta!.id)).toHaveLength(0);
  expect(await recibidosPorLucode(cliente.nombre)).toHaveLength(0);
  expect(await comando(comandoId)).toMatchObject({ resultado: "confirmado" });
  expect(invariantes()).toBe("limpias");
});

test("«… factura» sin cliente: la tarjeta avisa antes de confirmar y la venta se guarda igual", async ({ page }) => {
  const comandoId = await crearComando();
  const hoja = await dictarVenta(page, comandoId, tarjeta(null, "factura"));
  await expect(hoja.getByText("Una factura va a un cliente con RUC: elige a quién.")).toBeVisible();
  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText("La venta quedó guardada, pero la factura no salió:", { exact: false })).toBeVisible({ timeout: 20_000 });
  const [venta] = await ventaDe(comandoId);
  expect(venta).toBeTruthy();
  expect(await comprobantesDe(venta!.id)).toHaveLength(0);
});

test("cambiar a «Sin comprobante» en la tarjeta: se guarda la venta sola, y el comando queda como corregido", async ({ page }) => {
  const ruc = rucAlAzar();
  const cliente = await clienteNuevo("Cliente de voz corregido", { tipo_documento: "RUC", numero_documento: ruc });
  const comandoId = await crearComando();
  const hoja = await dictarVenta(page, comandoId, tarjeta(cliente, "factura"));
  await hoja.getByRole("button", { name: "Sin comprobante" }).click();
  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText("Venta guardada")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/aceptada|no salió|en proceso/)).toHaveCount(0);

  const [venta] = await ventaDe(comandoId);
  expect(await comprobantesDe(venta!.id)).toHaveLength(0);
  expect(await recibidosPorLucode(cliente.nombre)).toHaveLength(0);
  expect(await comando(comandoId)).toMatchObject({ resultado: "corregido" });
});

test("sin comprobante pedido, la tarjeta no muestra la fila y la venta sale como siempre", async ({ page }) => {
  const cliente = await clienteNuevo("Cliente de voz sin pedido");
  const comandoId = await crearComando();
  const hoja = await dictarVenta(page, comandoId, tarjeta(cliente, "ninguno"));
  await expect(hoja.getByRole("group", { name: "¿Con comprobante?" })).toHaveCount(0);
  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText("Venta guardada")).toBeVisible({ timeout: 20_000 });
  expect(await comprobantesDe((await ventaDe(comandoId))[0]!.id)).toHaveLength(0);
});

test("dos toques seguidos en Confirmar: una sola venta y un solo comprobante", async ({ page }) => {
  const cliente = await clienteNuevo("Cliente de voz doble toque");
  const comandoId = await crearComando();
  const hoja = await dictarVenta(page, comandoId, tarjeta(cliente, "boleta"));
  await hoja.getByRole("button", { name: "Confirmar venta" }).evaluate((b: HTMLButtonElement) => {
    b.click();
    b.click();
  });
  await expect(page.getByText(/Boleta B001-\d{8} aceptada/)).toBeVisible({ timeout: 20_000 });
  const ventas = await ventaDe(comandoId);
  expect(ventas).toHaveLength(1);
  expect(await comprobantesDe(ventas[0]!.id)).toHaveLength(1);
  expect(await recibidosPorLucode(cliente.nombre)).toHaveLength(1);
  expect(invariantes()).toBe("limpias");
});

test("el proveedor no contesta: la venta se guarda, el comprobante queda en proceso y se termina desde la venta", async ({ page }) => {
  const cliente = await clienteNuevo("Cliente de voz proveedor caído", undefined, { modo: "caido" });
  const comandoId = await crearComando();
  const hoja = await dictarVenta(page, comandoId, tarjeta(cliente, "boleta"));
  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText("Venta guardada")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Boleta B001-\d{8} en proceso: termínala desde la venta/)).toBeVisible();

  const [venta] = await ventaDe(comandoId);
  const [pendiente] = await comprobantesDe(venta!.id);
  expect(pendiente).toMatchObject({ estado: "pendiente", respuesta: null });

  // Se arregla el proveedor y se termina desde el detalle de la venta (A9.3): el MISMO comprobante y el MISMO número.
  await base.from("clientes").update({ nombre: sinMarca(cliente.nombre) }).eq("id", cliente.id);
  await page.goto("/ventas");
  await page.getByRole("button", { name: new RegExp(sinMarca(cliente.nombre)) }).click();
  const detalle = page.getByRole("dialog", { name: "Detalle de la venta" });
  await expect(detalle).toBeVisible({ timeout: 15_000 });
  await detalle.getByRole("button", { name: "Reintentar" }).click();
  await expect(detalle.getByRole("group", { name: "Comprobante" })).toContainText("aceptada", { timeout: 20_000 });
  const [despues] = await comprobantesDe(venta!.id);
  expect(despues).toMatchObject({ id: pendiente!.id, numero: pendiente!.numero, estado: "aceptado" });
  expect(invariantes()).toBe("limpias");
});

test("la tarjeta con la fila de comprobante cabe en el celular: controles de 48 px, sin desborde y «Confirmar» a la vista", async ({ page }) => {
  const cliente = await clienteNuevo("Cliente de voz medidas", { tipo_documento: "RUC", numero_documento: rucAlAzar() });
  const comandoId = await crearComando();
  const hoja = await dictarVenta(page, comandoId, tarjeta(cliente, "factura"));
  await page.waitForTimeout(1_000); // que termine la cascada de entrada de las piezas
  const { height } = page.viewportSize()!;
  const confirmar = (await hoja.getByRole("button", { name: "Confirmar venta" }).boundingBox())!;
  expect(confirmar.y + confirmar.height, "«Confirmar venta» a la vista").toBeLessThanOrEqual(height);
  const medidas = await hoja.evaluate((raiz) => ({
    desborde: raiz.scrollWidth - raiz.clientWidth,
    chicos: [...raiz.querySelectorAll("button, a")].filter((e) => e.getBoundingClientRect().height < 48).map((e) => e.textContent?.trim()),
  }));
  expect(medidas.desborde).toBeLessThanOrEqual(0);
  expect(medidas.chicos, "controles de menos de 48 px").toEqual([]);
});
