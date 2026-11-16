import { expect, test, type Page } from "@playwright/test";

import { baseLocal } from "./base";
import { crearComando, dictar } from "./dictar";
import { dichas, distintas, microfonoControlado, responder, sintetizadorDePrueba, terminarFrase } from "./manos-libres";

// Los candados de confirmar hablando (ADR-0020, candado 4): si falta saber si pagó, se pregunta por voz antes de leer; con dudas del
// intérprete no se escucha; sin señal no se abre el micrófono. La voz y las respuestas se simulan; el comando y la venta son reales.

const base = baseLocal();
const clientePorAncho = { "s25-412": { id: 1, nombre: "Luis Paredes" }, "gama-media-360": { id: 4, nombre: "Bodega Santa Ana" } } as const;
type Ancho = keyof typeof clientePorAncho;

const tarjeta = (cliente: { id: number; nombre: string }, cambios: Record<string, unknown> = {}) => ({
  tipo: "venta",
  cliente: { dicho: cliente.nombre.toLowerCase(), elegido: cliente, opciones: [] },
  items: [{ producto: { dicho: "mango", elegido: { id: 1, nombre: "Mango Kent" }, opciones: [] }, cantidad: 10, precio: { valor: 45, sugerido: false }, subtotal: 450 }],
  descuento: 0,
  total: 450,
  condicion: "credito",
  medio: null,
  comprobante: "ninguno",
  dudas: [],
  falta: [],
  ...cambios,
});

const ventaDe = async (comandoId: number) =>
  (await base.from("ventas").select("condicion, medio_pago, comandos_voz(confirmado_por)").eq("comando_voz_id", comandoId)).data ?? [];

/** Responde /api/voz/respuesta según la pregunta: «¿Pagó o lo debe?» o «¿Confirmo?». Cuenta las llamadas. */
async function simularRespuestas(page: Page, porPregunta: { pago?: unknown; confirmar?: unknown }) {
  const llamadas: string[] = [];
  await page.route("/api/voz/respuesta", (r) => {
    const pregunta = r.request().postDataBuffer()?.toString("latin1").match(/name="pregunta"\r\n\r\n(\w+)/)?.[1] ?? "confirmar";
    llamadas.push(pregunta);
    return r.fulfill({ json: pregunta === "pago" ? { pago: porPregunta.pago ?? null } : { respuesta: porPregunta.confirmar ?? "otra" } });
  });
  return llamadas;
}

test.beforeEach(async ({ page }) => {
  await microfonoControlado(page);
  await sintetizadorDePrueba(page, { manosLibres: true });
});

test("si falta saber si pagó, lo pregunta por voz, lo anota en la tarjeta, lee la venta y se confirma hablando", async ({ page }, info) => {
  test.slow();
  const cliente = clientePorAncho[info.project.name as Ancho];
  const llamadas = await simularRespuestas(page, { pago: { condicion: "credito", medio: null }, confirmar: "confirmar" });
  const comandoId = await crearComando();
  const hoja = await dictar(page, comandoId, tarjeta(cliente, { condicion: null, falta: ["condicion"] }), "¿Así fue la venta?");

  await expect.poll(() => distintas(page)).toEqual([`10 cajas de Mango Kent, a 45 la caja, para ${cliente.nombre}. Total, 450 soles. ¿Pagó o lo debe?`]);
  await terminarFrase(page);
  await expect(hoja.getByRole("status").filter({ hasText: "di «pagó» o «lo debe»" })).toBeVisible();
  await responder(page);

  // Se anota en la píldora, a la vista, y se lee la venta completa para confirmarla.
  await expect(hoja.getByRole("button", { name: "Lo debe", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => dichas(page)).toContain(`10 cajas de Mango Kent, a 45 la caja, para ${cliente.nombre}. Total, 450 soles. Lo debe. ¿Confirmo?`);
  await terminarFrase(page);
  await expect(hoja.getByRole("status").filter({ hasText: "di «confirmo»" })).toBeVisible();
  await responder(page);

  await expect(page.getByText("Venta guardada")).toBeVisible();
  expect(llamadas).toEqual(["pago", "confirmar"]);
  expect(await ventaDe(comandoId)).toEqual([{ condicion: "credito", medio_pago: null, comandos_voz: { confirmado_por: "voz" } }]);
});

test("decir si pagó no guarda: si después no confirma, la venta no entra", async ({ page }, info) => {
  const cliente = clientePorAncho[info.project.name as Ancho];
  await simularRespuestas(page, { pago: { condicion: "contado", medio: "yape" }, confirmar: "otra" });
  const comandoId = await crearComando();
  const hoja = await dictar(page, comandoId, tarjeta(cliente, { condicion: null, falta: ["condicion"] }), "¿Así fue la venta?");
  await expect.poll(() => dichas(page)).not.toEqual([]);
  await terminarFrase(page);
  await expect(hoja.getByRole("status").filter({ hasText: "di «pagó» o «lo debe»" })).toBeVisible();
  await responder(page);
  await expect.poll(() => dichas(page)).toContain(`10 cajas de Mango Kent, a 45 la caja, para ${cliente.nombre}. Total, 450 soles. Pagó con Yape. ¿Confirmo?`);
  await terminarFrase(page);
  await expect(hoja.getByRole("status").filter({ hasText: "di «confirmo»" })).toBeVisible();
  await responder(page);
  await expect.poll(() => dichas(page)).toContain("Para guardar, di confirmo.");
  await terminarFrase(page);
  await expect(hoja.getByRole("status").filter({ hasText: "di «confirmo»" })).toBeVisible();
  await responder(page);
  await expect(hoja.getByText("No guardé. Si está bien, toca Confirmar.")).toBeVisible();
  expect(await ventaDe(comandoId)).toEqual([]);
});

test("con dudas del intérprete no se escucha: lo dice y la venta se confirma con el dedo", async ({ page }, info) => {
  const cliente = clientePorAncho[info.project.name as Ancho];
  const llamadas = await simularRespuestas(page, { confirmar: "confirmar" });
  const comandoId = await crearComando();
  const hoja = await dictar(page, comandoId, tarjeta(cliente, { dudas: ["No sé si dijo 10 o 12 cajas"] }), "¿Así fue la venta?");

  // La duda se dice: no hay que soltar las cajas para saber cuál es (/formidable 2026-11-16).
  await expect.poll(() => distintas(page)).toEqual(["Tengo una duda: no sé si dijo 10 o 12 cajas. Revisa la tarjeta y toca Confirmar."]);
  await terminarFrase(page);
  await responder(page);
  await page.waitForTimeout(1500);
  expect(llamadas).toEqual([]); // ni se abrió el micrófono
  await expect(hoja.getByRole("status").filter({ hasText: "Te escucho" })).toHaveCount(0);

  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText("Venta guardada")).toBeVisible();
  expect(await ventaDe(comandoId)).toEqual([{ condicion: "credito", medio_pago: null, comandos_voz: { confirmado_por: "toque" } }]);
});

test("sin señal no se abre el micrófono: lo dice y se confirma tocando", async ({ page, context }, info) => {
  const cliente = clientePorAncho[info.project.name as Ancho];
  const llamadas = await simularRespuestas(page, { confirmar: "confirmar" });
  const hoja = await dictar(page, await crearComando(), tarjeta(cliente), "¿Así fue la venta?");
  await expect.poll(() => dichas(page)).not.toEqual([]);
  await context.setOffline(true);
  await terminarFrase(page);
  await expect(hoja.getByText("Sin señal no te entiendo. Si está bien, toca Confirmar.")).toBeVisible();
  await responder(page);
  await page.waitForTimeout(1000);
  expect(llamadas).toEqual([]);
  await context.setOffline(false);
});
