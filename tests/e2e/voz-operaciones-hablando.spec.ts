import { expect, test, type Page } from "@playwright/test";

import { baseLocal } from "./base";
import { crearComando, dictar } from "./dictar";
import { dichas, distintas, microfonoControlado, responder, sintetizadorDePrueba, terminarFrase } from "./manos-libres";

// Abono, merma, gasto y compra con manos libres (ADR-0020): la misma lectura y los mismos candados que la venta. La voz y las respuestas
// se simulan; el comando y lo que se guarda son reales, y se revisa en la base cómo quedó confirmado. Cada ancho usa su cliente.

const base = baseLocal();
const clientePorAncho = { "s25-412": { id: 1, nombre: "Luis Paredes" }, "gama-media-360": { id: 4, nombre: "Bodega Santa Ana" } } as const;
type Ancho = keyof typeof clientePorAncho;
const mango = { dicho: "mango", elegido: { id: 1, nombre: "Mango Kent" }, opciones: [] };

const confirmadoPor = async (comandoId: number) => (await base.from("comandos_voz").select("resultado, confirmado_por").eq("id", comandoId).single()).data;

/** Responde /api/voz/respuesta: si se pregunta si se pagó, `pago`; si «¿Confirmo?», confirma. */
async function simularRespuestas(page: Page, pago: unknown = null) {
  await page.route("/api/voz/respuesta", (r) => {
    const pregunta = r.request().postDataBuffer()?.toString("latin1").match(/name="pregunta"\r\n\r\n(\w+)/)?.[1];
    return r.fulfill({ json: pregunta === "pago" ? { pago } : { respuesta: "confirmar" } });
  });
}

/** Termina la lectura, espera «Te escucho» y responde. */
async function contestar(page: Page, hoja: ReturnType<Page["getByRole"]>, texto: string) {
  await expect.poll(() => dichas(page)).toContain(texto);
  await terminarFrase(page);
  await expect(hoja.getByRole("status").filter({ hasText: "Te escucho" })).toBeVisible();
  await responder(page);
}

test.beforeEach(async ({ page }) => {
  await microfonoControlado(page);
  await sintetizadorDePrueba(page, { manosLibres: true });
});

test("un abono se lee y se confirma hablando", async ({ page }, info) => {
  test.slow(); // la primera vez compila la hoja
  const cliente = clientePorAncho[info.project.name as Ancho];
  await simularRespuestas(page);
  const comandoId = await crearComando("registrar_abono");
  const abono = { tipo: "abono", cliente: { dicho: cliente.nombre.toLowerCase(), elegido: cliente, opciones: [] }, monto: 50, medio: "yape", dudas: [], falta: [] };
  const hoja = await dictar(page, comandoId, abono, "¿Así fue el abono?");

  await expect.poll(() => distintas(page)).toEqual([`Abono de ${cliente.nombre}: 50 soles con Yape. ¿Confirmo?`]);
  await contestar(page, hoja, `Abono de ${cliente.nombre}: 50 soles con Yape. ¿Confirmo?`);
  await expect(page.getByText("Abono guardado")).toBeVisible();
  await expect.poll(() => dichas(page)).toContain("Guardado.");
  expect((await base.from("abonos").select("monto, medio_pago").eq("comando_voz_id", comandoId)).data).toEqual([{ monto: 50, medio_pago: "yape" }]);
  expect(await confirmadoPor(comandoId)).toEqual({ resultado: "confirmado", confirmado_por: "voz" });
});

test("una compra sin decir si se pagó: lo pregunta, lo anota y se confirma hablando", async ({ page }) => {
  test.slow();
  await simularRespuestas(page, { condicion: "credito", medio: null });
  const comandoId = await crearComando("registrar_compra");
  const compra = {
    tipo: "compra",
    proveedor: { dicho: "agricola chao", elegido: { id: 2, nombre: "Agrícola Chao" }, opciones: [] },
    items: [{ producto: mango, cantidad: 5, costo: { valor: 20, sugerido: false } }],
    condicion: null,
    dudas: [],
    falta: ["condicion"],
  };
  const hoja = await dictar(page, comandoId, compra, "¿Así fue la compra?");

  await contestar(page, hoja, "Compra a Agrícola Chao: 5 cajas de Mango Kent, a 20 la caja. Total, 100 soles. ¿La pagaste o la debes?");
  await contestar(page, hoja, "Compra a Agrícola Chao: 5 cajas de Mango Kent, a 20 la caja. Total, 100 soles. La debes. ¿Confirmo?");
  await expect(page.getByText("Compra guardada")).toBeVisible();
  expect((await base.from("compras").select("condicion, total").eq("comando_voz_id", comandoId)).data).toEqual([{ condicion: "credito", total: 100 }]);
  expect(await confirmadoPor(comandoId)).toEqual({ resultado: "confirmado", confirmado_por: "voz" });
});

test("una merma se lee y se confirma hablando", async ({ page }) => {
  test.slow();
  await simularRespuestas(page);
  const comandoId = await crearComando("registrar_merma");
  const hoja = await dictar(page, comandoId, { tipo: "merma", producto: mango, cantidad: 2, motivo: "se malograron", falta: [] }, "¿Así fue la merma?");
  await contestar(page, hoja, "Merma: 2 cajas de Mango Kent, se malograron. ¿Confirmo?");
  await expect(page.getByText("Merma guardada")).toBeVisible();
  expect(await confirmadoPor(comandoId)).toEqual({ resultado: "confirmado", confirmado_por: "voz" });
});

test("un gasto se lee y se confirma hablando", async ({ page }) => {
  test.slow();
  await simularRespuestas(page);
  const comandoId = await crearComando("registrar_gasto");
  const gasto = { tipo: "gasto", categoria: "flete", monto: 30, descripcion: "al cargador", medio: "efectivo" };
  const hoja = await dictar(page, comandoId, gasto, "¿Así fue el gasto?");
  await contestar(page, hoja, "Gasto de flete, al cargador: 30 soles en efectivo. ¿Confirmo?");
  await expect(page.getByText("Gasto guardado")).toBeVisible();
  expect(await confirmadoPor(comandoId)).toEqual({ resultado: "confirmado", confirmado_por: "voz" });
});
