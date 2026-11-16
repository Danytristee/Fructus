import { expect, test } from "@playwright/test";

import { baseLocal } from "./base";
import { crearComando, dictar } from "./dictar";
import { dichas, distintas, microfonoControlado, responder, sintetizadorDePrueba, terminarFrase } from "./manos-libres";

// Confirmar la venta hablando (ADR-0020): con manos libres, Fructus lee la venta, escucha la respuesta y, si es «confirmo», la
// guarda por la misma acción que el toque. La voz y la respuesta se simulan (/api/voz y /api/voz/respuesta), pero el comando es
// real: la venta pasa por registrar_venta y se revisa en la base cómo quedó confirmada. Cada ancho usa su cliente.

const base = baseLocal();
const clientePorAncho = { "s25-412": { id: 1, nombre: "Luis Paredes" }, "gama-media-360": { id: 4, nombre: "Bodega Santa Ana" } } as const;
type Ancho = keyof typeof clientePorAncho;

const tarjeta = (cliente: { id: number; nombre: string }) => ({
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
});
const lectura = (nombre: string) => `10 cajas de Mango Kent, a 45 la caja, para ${nombre}. Total, 450 soles. Lo debe. ¿Confirmo?`;

const confirmacion = async (comandoId: number) => (await base.from("comandos_voz").select("resultado, confirmado_por").eq("id", comandoId).single()).data;
const ventasDe = async (comandoId: number) => (await base.from("ventas").select("id").eq("comando_voz_id", comandoId)).data ?? [];

test.beforeEach(async ({ page }) => {
  await microfonoControlado(page);
  await sintetizadorDePrueba(page, { manosLibres: true });
});

async function hastaEscuchar(page: import("@playwright/test").Page, comandoId: number, nombre: string, cliente: { id: number; nombre: string }) {
  const hoja = await dictar(page, comandoId, tarjeta(cliente), "¿Así fue la venta?");
  await expect.poll(() => distintas(page)).toEqual([lectura(nombre)]);
  await terminarFrase(page);
  await expect(hoja.getByRole("status").filter({ hasText: "di «confirmo»" })).toBeVisible();
  return hoja;
}

test("decir «confirmo» después de la lectura guarda la venta, dice «Guardado» y queda que fue por voz", async ({ page }, info) => {
  test.slow();
  const cliente = clientePorAncho[info.project.name as Ancho];
  await page.route("/api/voz/respuesta", (r) => r.fulfill({ json: { respuesta: "confirmar" } }));
  const comandoId = await crearComando();
  await hastaEscuchar(page, comandoId, cliente.nombre, cliente);

  const pedido = page.waitForRequest((r) => r.url().endsWith("/api/voz/respuesta"));
  await responder(page);
  await pedido;
  await expect(page.getByText("Venta guardada")).toBeVisible();
  await expect.poll(() => dichas(page)).toContain("Guardado.");

  expect(await ventasDe(comandoId)).toHaveLength(1);
  expect(await confirmacion(comandoId)).toEqual({ resultado: "confirmado", confirmado_por: "voz" });
});

test("tocar Confirmar mientras escucha guarda por toque, y la respuesta ya no se envía", async ({ page }, info) => {
  const cliente = clientePorAncho[info.project.name as Ancho];
  let respuestas = 0;
  await page.route("/api/voz/respuesta", (r) => {
    respuestas++;
    return r.fulfill({ json: { respuesta: "confirmar" } });
  });
  const comandoId = await crearComando();
  const hoja = await hastaEscuchar(page, comandoId, cliente.nombre, cliente);

  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText("Venta guardada")).toBeVisible();
  await responder(page); // lo que se diga después ya no va a ningún lado: el micrófono se apagó al tocar
  await page.waitForTimeout(500);
  expect(respuestas).toBe(0);
  expect(await ventasDe(comandoId)).toHaveLength(1);
  expect(await confirmacion(comandoId)).toEqual({ resultado: "confirmado", confirmado_por: "toque" });
});

test("si oye otra cosa, lo pide una vez más; si tampoco confirma, no guarda y deja la tarjeta para tocar", async ({ page }, info) => {
  const cliente = clientePorAncho[info.project.name as Ancho];
  let respuestas = 0;
  await page.route("/api/voz/respuesta", (r) => {
    respuestas++;
    return r.fulfill({ json: { respuesta: "otra" } });
  });
  const comandoId = await crearComando();
  const hoja = await hastaEscuchar(page, comandoId, cliente.nombre, cliente);

  await responder(page);
  await expect.poll(() => dichas(page)).toContain("Para guardar, di confirmo.");
  await terminarFrase(page);
  await expect(hoja.getByRole("status").filter({ hasText: "di «confirmo»" })).toBeVisible();
  await responder(page);
  await expect(hoja.getByText("No guardé. Si está bien, toca Confirmar.")).toBeVisible();
  expect(respuestas).toBe(2);
  expect(await ventasDe(comandoId)).toHaveLength(0);
  expect(await confirmacion(comandoId)).toEqual({ resultado: "pendiente", confirmado_por: null });
  await expect(hoja.getByRole("button", { name: "Confirmar venta" })).toBeEnabled();
});

test("si no responde, deja de escuchar a los 5 s y la tarjeta queda para tocar", async ({ page }, info) => {
  const cliente = clientePorAncho[info.project.name as Ancho];
  let respuestas = 0;
  await page.route("/api/voz/respuesta", (r) => {
    respuestas++;
    return r.fulfill({ json: { respuesta: "confirmar" } });
  });
  const comandoId = await crearComando();
  const hoja = await hastaEscuchar(page, comandoId, cliente.nombre, cliente);

  await expect(hoja.getByText("No te oí. Si está bien, toca Confirmar.")).toBeVisible({ timeout: 8_000 });
  expect(respuestas).toBe(0);
  expect(await ventasDe(comandoId)).toHaveLength(0);
});

test("si el servidor no entiende la respuesta, no guarda por las dudas", async ({ page }, info) => {
  const cliente = clientePorAncho[info.project.name as Ancho];
  await page.route("/api/voz/respuesta", (r) => r.fulfill({ status: 502, json: { error: "No te entendí." } }));
  const comandoId = await crearComando();
  const hoja = await hastaEscuchar(page, comandoId, cliente.nombre, cliente);

  await responder(page);
  await expect(hoja.getByText("No te entendí. Si está bien, toca Confirmar.")).toBeVisible();
  expect(await ventasDe(comandoId)).toHaveLength(0);
});
