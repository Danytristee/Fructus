import { expect, test, type Page } from "@playwright/test";

import { baseLocal } from "./base";
import { crearComando, dictar } from "./dictar";
import { dichas, distintas, microfonoControlado, responder, sintetizadorDePrueba, terminarFrase } from "./manos-libres";

// Con manos libres, si a la venta le falta un dato (la fruta, el precio, a quién se le fía), Fructus dice qué falta, lo pregunta y la
// respuesta completa la tarjeta (ADR-0027). Antes decía «Míralo en la tarjeta» y se callaba. La respuesta se simula
// (/api/voz/respuesta devuelve la venta rehecha por el intérprete), pero el comando y la base son reales. Cada ancho usa su cliente.

const base = baseLocal();
const clientePorAncho = { "s25-412": { id: 1, nombre: "Luis Paredes" }, "gama-media-360": { id: 4, nombre: "Bodega Santa Ana" } } as const;
type Ancho = keyof typeof clientePorAncho;
const kent = { id: 1, nombre: "Mango Kent" };
const edward = { id: 2, nombre: "Mango Edward" };

const tarjeta = (cliente: { id: number; nombre: string } | null, cambios: Record<string, unknown> = {}) => ({
  tipo: "venta",
  cliente: { dicho: cliente?.nombre.toLowerCase() ?? null, elegido: cliente, opciones: [] },
  items: [{ producto: { dicho: "mango", elegido: kent, opciones: [] }, cantidad: 10, precio: { valor: 45, sugerido: false }, subtotal: 450 }],
  descuento: 0,
  total: 450,
  condicion: "credito",
  medio: null,
  pagoParcial: null,
  comprobante: "ninguno",
  dudas: [],
  falta: [],
  ...cambios,
});

type Pedido = { pregunta: string | null; falta: unknown; venta: unknown };

/** Responde /api/voz/respuesta con `respuestas`, en orden (la última se repite), y anota qué pidió el celular. */
async function simular(page: Page, respuestas: unknown[]) {
  const pedidos: Pedido[] = [];
  await page.route("/api/voz/respuesta", (r) => {
    const cuerpo = r.request().postDataBuffer()?.toString("utf8") ?? "";
    const campo = (nombre: string) => cuerpo.match(new RegExp(`name="${nombre}"\\r\\n\\r\\n([^\\r]*)`))?.[1] ?? null;
    pedidos.push({ pregunta: campo("pregunta"), falta: JSON.parse(campo("falta") ?? "null"), venta: JSON.parse(campo("venta") ?? "null") });
    return r.fulfill({ json: respuestas[Math.min(pedidos.length - 1, respuestas.length - 1)] });
  });
  return pedidos;
}

const ventaDe = async (comandoId: number) =>
  (await base.from("ventas").select("condicion, cliente_id, total, venta_items(producto_id, precio_unitario), comandos_voz(confirmado_por)").eq("comando_voz_id", comandoId)).data ?? [];

test.beforeEach(async ({ page }) => {
  await microfonoControlado(page);
  await sintetizadorDePrueba(page, { manosLibres: true });
});

test("falta el precio: lo dice, lo pregunta, «cuarenta y cinco» lo completa, lee la venta entera y se confirma hablando", async ({ page }, info) => {
  test.slow();
  const cliente = clientePorAncho[info.project.name as Ancho];
  const sinPrecio = tarjeta(cliente, {
    items: [{ producto: { dicho: "mango", elegido: kent, opciones: [] }, cantidad: 10, precio: { valor: null, sugerido: false }, subtotal: null }],
    total: null,
    condicion: null,
    falta: ["precio", "condicion"],
  });
  const conPrecio = tarjeta(cliente, { condicion: null, falta: ["condicion"] });
  const pedidos = await simular(page, [{ respuesta: "corregir", tarjeta: conPrecio }, { pago: { condicion: "credito", medio: null } }, { respuesta: "confirmar" }]);
  const comandoId = await crearComando();
  const hoja = await dictar(page, comandoId, sinPrecio, "¿Así fue la venta?");

  // Dice todo lo que falta y pregunta lo primero.
  await expect.poll(() => distintas(page)).toEqual(["Falta el precio y si pagó. ¿A cuánto la caja de Mango Kent?"]);
  await terminarFrase(page);
  await expect(hoja.getByRole("status").filter({ hasText: "dime lo que falta" })).toBeVisible();
  await page.screenshot({ path: info.outputPath(`pregunta-precio-${info.project.name}.png`) });
  await responder(page); // «Cuarenta y cinco»

  // La tarjeta se completa a la vista y, como nunca se leyó entera, ahora se lee entera antes de preguntar si pagó.
  await expect(hoja.getByText("Falta elegir a cuánto la caja")).toHaveCount(0);
  await expect.poll(() => dichas(page)).toContain(`Anotado. 10 cajas de Mango Kent, a 45 la caja, para ${cliente.nombre}. Total, 450 soles. ¿Pagó o lo debe?`);
  await terminarFrase(page);
  await responder(page); // «Lo debe»
  await expect.poll(() => dichas(page)).toContain("Lo debe. ¿Confirmo?");
  await terminarFrase(page);
  await responder(page); // «Confirmo»

  await expect(page.getByText("Venta guardada")).toBeVisible();
  // La respuesta viajó con lo que se preguntó: así el intérprete sabe que «cuarenta y cinco» es el precio, no las cajas.
  expect(pedidos.map((p) => p.pregunta)).toEqual(["falta", "pago", "confirmar"]);
  expect(pedidos[0]!.falta).toEqual({ dato: "precio", item: 0, opciones: [] });
  expect(pedidos[0]!.venta).toMatchObject({ items: [{ producto_texto: "Mango Kent", cantidad: 10, precio_unitario: null }] });
  expect(await ventaDe(comandoId)).toEqual([
    { condicion: "credito", cliente_id: cliente.id, total: 450, venta_items: [{ producto_id: 1, precio_unitario: 45 }], comandos_voz: { confirmado_por: "voz" } },
  ]);
});

test("la fruta y el cliente con opciones: los lee para elegir, uno tras otro, y la venta se guarda con lo elegido", async ({ page }, info) => {
  test.slow();
  const cliente = clientePorAncho[info.project.name as Ancho];
  const otro = cliente.id === 1 ? { id: 4, nombre: "Bodega Santa Ana" } : { id: 1, nombre: "Luis Paredes" };
  const opcionesCliente = [cliente, otro];
  const dudosa = tarjeta(null, {
    cliente: { dicho: "el de siempre", elegido: null, opciones: opcionesCliente },
    items: [{ producto: { dicho: "mango", elegido: null, opciones: [kent, edward] }, cantidad: 10, precio: { valor: 45, sugerido: false }, subtotal: 450 }],
    falta: ["cliente", "producto"],
  });
  const conFruta = tarjeta(null, { cliente: { dicho: "el de siempre", elegido: null, opciones: opcionesCliente }, falta: ["cliente"] });
  const lista = tarjeta(cliente);
  const pedidos = await simular(page, [{ respuesta: "corregir", tarjeta: conFruta }, { respuesta: "corregir", tarjeta: lista }, { respuesta: "confirmar" }]);
  const comandoId = await crearComando();
  const hoja = await dictar(page, comandoId, dudosa, "¿Así fue la venta?");

  await expect.poll(() => distintas(page)).toEqual(["Falta el cliente y la fruta. Las 10 cajas de mango, ¿cuál es? ¿Mango Kent o Mango Edward?"]);
  await terminarFrase(page);
  await expect(hoja.getByRole("status").filter({ hasText: "dime lo que falta" })).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Confirmar venta" })).toBeInViewport();
  await page.screenshot({ path: info.outputPath(`pregunta-fruta-${info.project.name}.png`) });
  await responder(page); // «El Kent»
  await expect.poll(() => dichas(page)).toContain(`Anotado. ¿Para quién es? ¿${cliente.nombre} o ${otro.nombre}?`);
  await terminarFrase(page);
  await responder(page); // el cliente
  await expect.poll(() => dichas(page)).toContain(`Anotado. 10 cajas de Mango Kent, a 45 la caja, para ${cliente.nombre}. Total, 450 soles. Lo debe. ¿Confirmo?`);
  await terminarFrase(page);
  await responder(page); // «Confirmo»

  await expect(page.getByText("Venta guardada")).toBeVisible();
  expect(pedidos.map((p) => p.falta)).toEqual([
    { dato: "producto", item: 0, opciones: ["Mango Kent", "Mango Edward"] },
    { dato: "cliente", item: null, opciones: opcionesCliente.map((c) => c.nombre) },
    null,
  ]);
  expect(await ventaDe(comandoId)).toEqual([
    { condicion: "credito", cliente_id: cliente.id, total: 450, venta_items: [{ producto_id: 1, precio_unitario: 45 }], comandos_voz: { confirmado_por: "voz" } },
  ]);
  await expect(hoja).toBeHidden();
});

test("si no entiende lo que falta, lo pregunta una vez más; después se elige en la tarjeta y nada se guarda solo", async ({ page }, info) => {
  const cliente = clientePorAncho[info.project.name as Ancho];
  const sinPrecio = tarjeta(cliente, {
    items: [{ producto: { dicho: "mango", elegido: kent, opciones: [] }, cantidad: 10, precio: { valor: null, sugerido: false }, subtotal: null }],
    total: null,
    falta: ["precio"],
  });
  const pedidos = await simular(page, [{ respuesta: "otra" }]);
  const comandoId = await crearComando();
  const hoja = await dictar(page, comandoId, sinPrecio, "¿Así fue la venta?");

  await expect.poll(() => distintas(page)).toEqual(["Falta el precio. ¿A cuánto la caja de Mango Kent?"]);
  await terminarFrase(page);
  await responder(page);
  await expect.poll(() => dichas(page)).toContain("No te entendí. ¿A cuánto la caja de Mango Kent?");
  await terminarFrase(page);
  await responder(page);
  await expect(hoja.getByText("No te entendí. Elígelo en la tarjeta.")).toBeVisible();
  expect(pedidos).toHaveLength(2);
  expect(await ventaDe(comandoId)).toEqual([]);
});
