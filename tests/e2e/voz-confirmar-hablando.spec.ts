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

test("«no, son ocho cajas»: la tarjeta se corrige, se dice solo lo que cambió y se confirma; queda corregida y por voz", async ({ page }, info) => {
  test.slow();
  const cliente = clientePorAncho[info.project.name as Ancho];
  const ocho = { ...tarjeta(cliente), items: [{ ...tarjeta(cliente).items[0]!, cantidad: 8, subtotal: 360 }], total: 360 };
  const enviadas: { cliente_texto: string | null; items: { cantidad: number }[] }[] = [];
  let n = 0;
  await page.route("/api/voz/respuesta", (r) => {
    enviadas.push(JSON.parse(r.request().postDataBuffer()?.toString("utf8").match(/name="venta"\r\n\r\n([^\r]*)/)?.[1] ?? "null"));
    const respuestas = [{ respuesta: "corregir", tarjeta: ocho }, { repetir: true }, { respuesta: "confirmar" }];
    return r.fulfill({ json: respuestas[Math.min(n++, respuestas.length - 1)] });
  });
  const comandoId = await crearComando();
  const hoja = await hastaEscuchar(page, comandoId, cliente.nombre, cliente);

  await responder(page); // «No, son ocho cajas»
  await expect(hoja.getByText("8 cajas de Mango Kent")).toBeVisible();
  await expect(hoja.getByText("S/ 360.00", { exact: true })).toBeVisible();
  // La tarjeta marca lo mismo que dice la voz: la fruta y el total. El cliente no cambió, así que no se marca.
  await expect(hoja.getByText("corregido", { exact: true })).toHaveCount(2);
  // Junto a las cajas, que fue lo que cambió, y no pegada al precio, que sigue igual (2.ª prueba ciega).
  await expect(hoja.getByRole("button", { name: /^8 cajas de Mango Kent\s*corregido\s*S\/\s45\.00 la caja$/ })).toBeVisible();
  // Lo que ya debía es del cliente: sigue a la vista, con el total nuevo (antes desaparecía al corregir; /formidable 2026-11-17).
  await expect(hoja.getByText(`Con esta venta, ${cliente.nombre} te debe`)).toBeVisible();
  await expect(hoja.getByText("+ S/ 360.00 de hoy")).toBeVisible();
  // Solo lo que cambió: la venta entera se acaba de oír.
  await expect.poll(() => dichas(page)).toContain("Corregido. 8 cajas de Mango Kent, a 45 la caja. Total, 360 soles. ¿Confirmo?");
  await terminarFrase(page);
  await expect(hoja.getByRole("status").filter({ hasText: "di «confirmo»" })).toBeVisible();
  await responder(page); // «¿Qué?»

  // «Repite»: la venta corregida, entera.
  await expect.poll(() => dichas(page)).toContain(`8 cajas de Mango Kent, a 45 la caja, para ${cliente.nombre}. Total, 360 soles. Lo debe. ¿Confirmo?`);
  await terminarFrase(page);
  await expect(hoja.getByRole("status").filter({ hasText: "di «confirmo»" })).toBeVisible();
  await responder(page);

  await expect(page.getByText("Venta guardada")).toBeVisible();
  // Al servidor viaja la venta de la tarjeta, en datos, para que el intérprete la corrija; la segunda vez, ya la corregida.
  expect(enviadas.map((v) => [v.cliente_texto, v.items[0]!.cantidad])).toEqual([[cliente.nombre, 10], [cliente.nombre, 8], [cliente.nombre, 8]]);
  const ventas = (await base.from("ventas").select("total, venta_items(cantidad)").eq("comando_voz_id", comandoId)).data ?? [];
  expect(ventas).toEqual([{ total: 360, venta_items: [{ cantidad: 8 }] }]);
  expect(await confirmacion(comandoId)).toEqual({ resultado: "corregido", confirmado_por: "voz" });
});

test("«repite»: la vuelve a leer entera y escucha otra vez; después «confirmo» la guarda", async ({ page }, info) => {
  const cliente = clientePorAncho[info.project.name as Ancho];
  let n = 0;
  await page.route("/api/voz/respuesta", (r) => r.fulfill({ json: n++ === 0 ? { repetir: true } : { respuesta: "confirmar" } }));
  const comandoId = await crearComando();
  const hoja = await hastaEscuchar(page, comandoId, cliente.nombre, cliente);
  // La línea enseña que se puede corregir hablando (/formidable 2026-11-16).
  // La línea de la voz, por su texto: el aviso de stock también es un «status» y sale si la base local tiene menos de 10 cajas.
  await expect(hoja.getByRole("status").filter({ hasText: "Te escucho" })).toHaveText("Te escucho: di «confirmo», «repite» o lo que hay que cambiar.");

  const leidas = (await dichas(page)).filter((d) => d === lectura(cliente.nombre)).length;
  await responder(page); // «¿Qué?»
  await expect.poll(async () => (await dichas(page)).filter((d) => d === lectura(cliente.nombre)).length).toBe(leidas + 1);
  await terminarFrase(page);
  await expect(hoja.getByRole("status").filter({ hasText: "di «confirmo»" })).toBeVisible();
  await responder(page);
  await expect(page.getByText("Venta guardada")).toBeVisible();
  expect(await confirmacion(comandoId)).toEqual({ resultado: "confirmado", confirmado_por: "voz" });
});
