import { expect, test } from "@playwright/test";

import { baseLocal, enSoles } from "./base";
import { crearComando, dictar } from "./dictar";
import { dichas, distintas, microfonoControlado, responder, sintetizadorDePrueba, terminarFrase } from "./manos-libres";

// Con manos libres, a «¿Pagó o lo debe?» se puede responder con un monto: «pagó doscientos» (ADR-0025). Antes los números se borraban
// y quedaba «pagó»: la venta se guardaba como pagada entera. La respuesta se simula (/api/voz/respuesta devuelve la venta rehecha por
// el intérprete), pero el comando y la base son reales. Cada ancho usa su cliente.

const base = baseLocal();
const clientePorAncho = { "s25-412": { id: 1, nombre: "Luis Paredes" }, "gama-media-360": { id: 4, nombre: "Bodega Santa Ana" } } as const;
type Ancho = keyof typeof clientePorAncho;

const tarjeta = (cliente: { id: number; nombre: string }, cambios: Record<string, unknown> = {}) => ({
  tipo: "venta",
  cliente: { dicho: cliente.nombre.toLowerCase(), elegido: cliente, opciones: [] },
  items: [{ producto: { dicho: "mango", elegido: { id: 1, nombre: "Mango Kent" }, opciones: [] }, cantidad: 10, precio: { valor: 45, sugerido: false }, subtotal: 450 }],
  descuento: 0,
  total: 450,
  condicion: null,
  medio: null,
  pagoParcial: null,
  comprobante: "ninguno",
  dudas: [],
  falta: ["condicion"],
  ...cambios,
});

const saldoDe = async (id: number) => Number((await base.from("v_saldo_clientes").select("saldo").eq("cliente_id", id).single()).data!.saldo);

test.beforeEach(async ({ page }) => {
  await microfonoControlado(page);
  await sintetizadorDePrueba(page, { manosLibres: true });
});

test("«pagó doscientos» a «¿Pagó o lo debe?»: la venta queda al crédito con ese pago, se dice cuánto debe y se confirma hablando", async ({ page }, info) => {
  test.slow();
  const cliente = clientePorAncho[info.project.name as Ancho];
  const antes = await saldoDe(cliente.id);
  const conPago = tarjeta(cliente, { condicion: "credito", medio: "efectivo", pagoParcial: 200, falta: [] });
  const pedidos: { pregunta: string | null; venta: { condicion: string | null } | null }[] = [];
  let n = 0;
  await page.route("/api/voz/respuesta", (r) => {
    const cuerpo = r.request().postDataBuffer()?.toString("utf8") ?? "";
    const campo = (nombre: string) => cuerpo.match(new RegExp(`name="${nombre}"\\r\\n\\r\\n([^\\r]*)`))?.[1] ?? null;
    pedidos.push({ pregunta: campo("pregunta"), venta: JSON.parse(campo("venta") ?? "null") });
    const respuestas = [{ respuesta: "corregir", tarjeta: conPago }, { respuesta: "confirmar" }];
    return r.fulfill({ json: respuestas[Math.min(n++, respuestas.length - 1)] });
  });
  const comandoId = await crearComando();
  const hoja = await dictar(page, comandoId, tarjeta(cliente), "¿Así fue la venta?");

  // Lee la venta y pregunta si pagó.
  await expect.poll(() => distintas(page)).toEqual([`10 cajas de Mango Kent, a 45 la caja, para ${cliente.nombre}. Total, 450 soles. ¿Pagó o lo debe?`]);
  await terminarFrase(page);
  await responder(page); // «Pagó doscientos»

  // La tarjeta queda con lo que pagó, y se dice solo eso: lo que pagó y lo que debe.
  await expect(hoja.getByRole("button", { name: /Pagó ahora/ })).toContainText(enSoles(200));
  await expect(hoja.getByText(`+ ${enSoles(250)} hoy`)).toBeVisible();
  await expect.poll(() => dichas(page)).toContain("Corregido. Pagó 200 soles en efectivo y debe 250 soles. ¿Confirmo?");
  await terminarFrase(page);
  await responder(page); // «Confirmo»

  await expect(page.getByText("Venta guardada")).toBeVisible();
  // La respuesta a «¿Pagó o lo debe?» viajó con la venta, para que el intérprete pudiera rehacerla.
  expect(pedidos[0]).toEqual({ pregunta: "pago", venta: expect.objectContaining({ condicion: null }) });
  const venta = (await base.from("ventas").select("condicion, total, abonos(monto, medio_pago)").eq("comando_voz_id", comandoId).single()).data;
  expect(venta).toEqual({ condicion: "credito", total: 450, abonos: [{ monto: 200, medio_pago: "efectivo" }] });
  expect(await saldoDe(cliente.id)).toBe(antes + 250);
  // Responder la pregunta no es corregir lo que se entendió.
  expect((await base.from("comandos_voz").select("resultado, confirmado_por").eq("id", comandoId).single()).data).toEqual({ resultado: "confirmado", confirmado_por: "voz" });
});
