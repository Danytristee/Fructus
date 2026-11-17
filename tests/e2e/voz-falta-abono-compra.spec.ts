import { expect, test, type Page } from "@playwright/test";

import { baseLocal } from "./base";
import { crearComando, dictar } from "./dictar";
import { dichas, distintas, microfonoControlado, responder, sintetizadorDePrueba, terminarFrase } from "./manos-libres";

// El abono y la compra con manos libres, como la venta (ADR-0027): si falta quién, cuánto, la fruta o el costo, Fructus lo dice, lo
// pregunta y la respuesta completa la tarjeta; también se corrigen hablando («no, fueron 300»). La respuesta se simula
// (/api/voz/respuesta devuelve la operación rehecha por el intérprete); el comando y lo que se guarda son reales.

const base = baseLocal();
const clientePorAncho = { "s25-412": { id: 1, nombre: "Luis Paredes" }, "gama-media-360": { id: 4, nombre: "Bodega Santa Ana" } } as const;
type Ancho = keyof typeof clientePorAncho;
const kent = { id: 1, nombre: "Mango Kent" };
const chao = { id: 2, nombre: "Agrícola Chao" };
const piura = { id: 1, nombre: "Transportes Piura Norte" };

type Pedido = { pregunta: string | null; falta: unknown; abono: unknown; compra: unknown };

/** Responde /api/voz/respuesta con `respuestas`, en orden (la última se repite), y anota qué pidió el celular. */
async function simular(page: Page, respuestas: unknown[]) {
  const pedidos: Pedido[] = [];
  await page.route("/api/voz/respuesta", (r) => {
    const cuerpo = r.request().postDataBuffer()?.toString("utf8") ?? "";
    const campo = (nombre: string) => cuerpo.match(new RegExp(`name="${nombre}"\\r\\n\\r\\n([^\\r]*)`))?.[1] ?? null;
    const json = (nombre: string) => JSON.parse(campo(nombre) ?? "null");
    pedidos.push({ pregunta: campo("pregunta"), falta: json("falta"), abono: json("abono"), compra: json("compra") });
    return r.fulfill({ json: respuestas[Math.min(pedidos.length - 1, respuestas.length - 1)] });
  });
  return pedidos;
}

/** Termina la frase que se espera, espera «Te escucho» y responde. */
async function contestar(page: Page, hoja: ReturnType<Page["getByRole"]>, texto: string) {
  await expect.poll(() => dichas(page)).toContain(texto);
  await terminarFrase(page);
  await expect(hoja.getByRole("status").filter({ hasText: "Te escucho" })).toBeVisible();
  await responder(page);
}

const confirmadoPor = async (comandoId: number) => (await base.from("comandos_voz").select("confirmado_por").eq("id", comandoId).single()).data?.confirmado_por;

const abono = (cliente: { dicho: string | null; elegido: { id: number; nombre: string } | null; opciones: { id: number; nombre: string }[] }, monto = 200) => ({
  tipo: "abono",
  cliente,
  monto,
  medio: "yape",
  dudas: [],
  falta: cliente.elegido ? [] : ["cliente"],
});

const compra = (cambios: Record<string, unknown> = {}) => ({
  tipo: "compra",
  proveedor: { dicho: "chao", elegido: chao, opciones: [] },
  items: [{ producto: { dicho: "mango", elegido: kent, opciones: [] }, cantidad: 5, costo: { valor: 20, sugerido: false } }],
  condicion: "credito",
  dudas: [],
  falta: [],
  ...cambios,
});

test.beforeEach(async ({ page }) => {
  await microfonoControlado(page);
  await sintetizadorDePrueba(page, { manosLibres: true });
});

test("abono sin cliente claro: lee las opciones, la respuesta lo elige, lo lee entero y se confirma hablando", async ({ page }, info) => {
  test.slow();
  const cliente = clientePorAncho[info.project.name as Ancho];
  const otro = cliente.id === 1 ? { id: 4, nombre: "Bodega Santa Ana" } : { id: 1, nombre: "Luis Paredes" };
  const pedidos = await simular(page, [{ respuesta: "corregir", tarjeta: abono({ dicho: "el de siempre", elegido: cliente, opciones: [] }) }, { respuesta: "confirmar" }]);
  const comandoId = await crearComando("registrar_abono");
  const hoja = await dictar(page, comandoId, abono({ dicho: "el de siempre", elegido: null, opciones: [cliente, otro] }), "¿Así fue el abono?");

  await expect.poll(() => distintas(page)).toEqual([`Falta el cliente. ¿Quién te pagó? ¿${cliente.nombre} o ${otro.nombre}?`]);
  await terminarFrase(page);
  await expect(hoja.getByRole("status").filter({ hasText: "dime lo que falta" })).toBeVisible();
  await expect(hoja.getByRole("button", { name: /^Confirmar/ })).toBeInViewport();
  await page.screenshot({ path: info.outputPath(`abono-pregunta-${info.project.name}.png`) });
  await responder(page);
  await contestar(page, hoja, `Anotado. Abono de ${cliente.nombre}: 200 soles con Yape. ¿Confirmo?`);

  await expect(page.getByText("Abono guardado")).toBeVisible();
  expect(pedidos[0]).toMatchObject({ pregunta: "falta", falta: { dato: "cliente", item: null, opciones: [cliente.nombre, otro.nombre] }, abono: { cliente_texto: "el de siempre", monto: 200 } });
  expect((await base.from("abonos").select("cliente_id, monto, medio_pago").eq("comando_voz_id", comandoId)).data).toEqual([{ cliente_id: cliente.id, monto: 200, medio_pago: "yape" }]);
  expect(await confirmadoPor(comandoId)).toBe("voz");
});

test("abono corregido hablando: «no, fueron trescientos» lo rehace, lo lee entero y se confirma", async ({ page }, info) => {
  test.slow();
  const cliente = clientePorAncho[info.project.name as Ancho];
  const elegido = { dicho: cliente.nombre.toLowerCase(), elegido: cliente, opciones: [] };
  const pedidos = await simular(page, [{ respuesta: "corregir", tarjeta: abono(elegido, 300) }, { respuesta: "confirmar" }]);
  const comandoId = await crearComando("registrar_abono");
  const hoja = await dictar(page, comandoId, abono(elegido), "¿Así fue el abono?");

  await contestar(page, hoja, `Abono de ${cliente.nombre}: 200 soles con Yape. ¿Confirmo?`);
  await contestar(page, hoja, `Corregido. Abono de ${cliente.nombre}: 300 soles con Yape. ¿Confirmo?`);
  await expect(page.getByText("Abono guardado")).toBeVisible();
  expect(pedidos[0]).toMatchObject({ pregunta: "confirmar", abono: { monto: 200 } });
  expect((await base.from("abonos").select("monto").eq("comando_voz_id", comandoId)).data).toEqual([{ monto: 300 }]);
});

test("compra sin costo: lo pregunta, lo completa, la lee entera, pregunta si la pagaste y se confirma hablando", async ({ page }, info) => {
  test.slow();
  const sinCosto = compra({ items: [{ producto: { dicho: "mango", elegido: kent, opciones: [] }, cantidad: 5, costo: { valor: null, sugerido: false } }], condicion: null, falta: ["costo", "condicion"] });
  const pedidos = await simular(page, [{ respuesta: "corregir", tarjeta: compra({ condicion: null, falta: ["condicion"] }) }, { pago: { condicion: "contado", medio: "plin" } }, { respuesta: "confirmar" }]);
  const comandoId = await crearComando("registrar_compra");
  const hoja = await dictar(page, comandoId, sinCosto, "¿Así fue la compra?");

  await expect.poll(() => distintas(page)).toEqual(["Falta el costo y si la pagaste. ¿A cuánto te costó la caja de Mango Kent?"]);
  await terminarFrase(page);
  await expect(hoja.getByRole("status").filter({ hasText: "dime lo que falta" })).toBeVisible();
  await expect(hoja.getByRole("button", { name: /^Confirmar/ })).toBeInViewport();
  await page.screenshot({ path: info.outputPath(`compra-pregunta-${info.project.name}.png`) });
  await responder(page); // «Veinte»
  await contestar(page, hoja, "Anotado. Compra a Agrícola Chao: 5 cajas de Mango Kent, a 20 la caja. Total, 100 soles. ¿La pagaste o la debes?");
  await contestar(page, hoja, "La pagaste con Plin. ¿Confirmo?");

  await expect(page.getByText("Compra guardada")).toBeVisible();
  expect(pedidos.map((p) => p.pregunta)).toEqual(["falta", "pago", "confirmar"]);
  expect(pedidos[0]).toMatchObject({ falta: { dato: "costo", item: 0, opciones: [] }, compra: { items: [{ producto_texto: "Mango Kent", costo_unitario: null }] } });
  expect((await base.from("compras").select("condicion, medio_pago, total").eq("comando_voz_id", comandoId)).data).toEqual([{ condicion: "contado", medio_pago: "plin", total: 100 }]);
  expect(await confirmadoPor(comandoId)).toBe("voz");
});

test("compra «la debo» sin proveedor: pregunta a quién, con las opciones, y se guarda con el elegido", async ({ page }) => {
  test.slow();
  const sinProveedor = compra({ proveedor: { dicho: "el de siempre", elegido: null, opciones: [chao, piura] }, condicion: null, falta: ["condicion"] });
  const conProveedor = compra({ proveedor: { dicho: "el de siempre", elegido: piura, opciones: [] } });
  const pedidos = await simular(page, [{ pago: { condicion: "credito", medio: null } }, { respuesta: "corregir", tarjeta: conProveedor }, { respuesta: "confirmar" }]);
  const comandoId = await crearComando("registrar_compra");
  const hoja = await dictar(page, comandoId, sinProveedor, "¿Así fue la compra?");

  await contestar(page, hoja, "Compra: 5 cajas de Mango Kent, a 20 la caja. Total, 100 soles. ¿La pagaste o la debes?");
  await contestar(page, hoja, "La debes. ¿A quién se la compraste? ¿Agrícola Chao o Transportes Piura Norte?");
  await contestar(page, hoja, "Anotado. Compra a Transportes Piura Norte: 5 cajas de Mango Kent, a 20 la caja. Total, 100 soles. La debes. ¿Confirmo?");

  await expect(page.getByText("Compra guardada")).toBeVisible();
  expect(pedidos[1]).toMatchObject({ pregunta: "falta", falta: { dato: "proveedor", opciones: ["Agrícola Chao", "Transportes Piura Norte"] } });
  expect((await base.from("compras").select("proveedor_id, condicion").eq("comando_voz_id", comandoId)).data).toEqual([{ proveedor_id: piura.id, condicion: "credito" }]);
});
