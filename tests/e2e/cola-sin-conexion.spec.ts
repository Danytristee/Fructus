import { expect, test, type Page } from "@playwright/test";

import { baseLocal, enSoles } from "./base";
import { entrarComo } from "./cuentas";
import { comando, crearComando, dictar, saldoDe } from "./dictar";

// La cola sin conexión (ADR-0019): se corta la red de verdad (el navegador queda offline), se confirma y se dicta, y al
// volver la señal todo entra solo y en orden. Se revisa lo que quedó en la base, no solo la pantalla. Cada prueba crea su
// propio cliente, así las dos corridas en paralelo no se pisan.

test.setTimeout(120_000);
const base = baseLocal();

async function clienteNuevo() {
  const nombre = `Cliente cola ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const { data, error } = await base.from("clientes").insert({ nombre }).select("id, nombre").single();
  if (error || !data) throw new Error(`No se pudo crear el cliente de prueba: ${error?.message}`);
  return data;
}

const ventaAlCredito = (cliente: { id: number; nombre: string }) => ({
  tipo: "venta",
  cliente: { dicho: cliente.nombre.toLowerCase(), elegido: cliente, opciones: [] },
  items: [{ producto: { dicho: "mango", elegido: { id: 1, nombre: "Mango Kent" }, opciones: [] }, cantidad: 2, precio: { valor: 50, sugerido: false }, subtotal: 100 }],
  descuento: 0,
  total: 100,
  condicion: "credito",
  medio: null,
  comprobante: "ninguno",
  dudas: [],
  falta: [],
});

const abono = (cliente: { id: number; nombre: string }, monto: number) => ({
  tipo: "abono",
  cliente: { dicho: cliente.nombre.toLowerCase(), elegido: cliente, opciones: [] },
  monto,
  medio: "efectivo",
  dudas: [],
  falta: [],
});

const franja = (page: Page) => page.locator("main [role=status], main [role=alert]").first();

async function mantenerVoz(page: Page) {
  const caja = (await page.getByRole("button", { name: "Botón de voz" }).boundingBox())!;
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  await expect(page.locator("button[data-estado]")).toHaveAttribute("data-estado", "escuchando", { timeout: 10_000 });
  await page.waitForTimeout(900);
  await page.mouse.up();
}

test("sin señal: la venta confirmada y lo dictado quedan en el celular, y al volver entran solos y en orden", async ({ page, context }, info) => {
  const cliente = await clienteNuevo();
  const ventaCmd = await crearComando();
  const hoja = await dictar(page, ventaCmd, ventaAlCredito(cliente), "¿Así fue la venta?");

  // Se corta la señal con la tarjeta abierta: la franja lo dice enseguida.
  await context.setOffline(true);
  await expect(page.getByText("Sin señal", { exact: true })).toBeVisible();
  await expect(page.getByText("Lo que confirmes se guarda en el celular y se envía cuando vuelva.")).toBeVisible();

  // Confirmar no guarda en la base todavía: lo dice sin el sello verde (nada optimista).
  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText("Quedó en el celular")).toBeVisible();
  await expect(page.getByText("Venta guardada")).toHaveCount(0);
  await expect(hoja).toBeHidden({ timeout: 5_000 });
  await expect(page.getByText("Por enviar: 1 venta.", { exact: false })).toBeVisible();
  expect((await base.from("ventas").select("id").eq("comando_voz_id", ventaCmd)).data).toHaveLength(0);

  // Se dicta sin señal: el audio también va a la cola.
  await mantenerVoz(page);
  await expect(page.getByText(/Sin señal: guardé lo que dijiste/)).toBeVisible();
  await expect(page.getByText(/Por enviar: 2 operaciones/)).toBeVisible();
  await page.screenshot({ path: info.outputPath("sin-senal.png") });

  // Vuelve la señal: la venta entra sola, y el audio vuelve como tarjeta que espera a la persona.
  const abonoCmd = await crearComando("registrar_abono");
  await page.unroute("/api/voz");
  await page.route("/api/voz", (r) => r.fulfill({ json: { comandoId: abonoCmd, tarjeta: abono(cliente, 60), latenciaMs: 900 } }));
  await context.setOffline(false);
  await expect(page.getByText("Listo: se envió lo guardado")).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => (await base.from("ventas").select("total").eq("comando_voz_id", ventaCmd)).data).toEqual([{ total: 100 }]);
  expect(await saldoDe(cliente.id)).toBe(100);
  // Lo dictado nunca se guarda solo (principio 1): queda la tarjeta para confirmar.
  expect((await base.from("abonos").select("id").eq("cliente_id", cliente.id)).data).toHaveLength(0);

  // Dice qué es lo que hay que confirmar, no solo «1 dictado» (/formidable 2026-11-12).
  await expect(page.getByText(`Volvió la señal. Confirma tu abono de ${cliente.nombre} · ${enSoles(60)}.`)).toBeVisible();
  await page.screenshot({ path: info.outputPath("volvio.png") });
  await page.getByRole("button", { name: "Verlo", exact: true }).click();
  const hojaAbono = page.getByRole("dialog", { name: "¿Así fue el abono?" });
  await expect(hojaAbono).toBeVisible({ timeout: 15_000 });
  await hojaAbono.getByRole("button", { name: "Confirmar abono" }).click();
  await expect(page.getByText("Abono guardado")).toBeVisible();
  await expect.poll(() => saldoDe(cliente.id)).toBe(40);
  expect(await comando(ventaCmd)).toMatchObject({ resultado: "confirmado" });
  // Ya no queda nada en la cola: el aviso se fue.
  await expect(page.getByText(/Volvió la señal\. Confirma/)).toHaveCount(0);
  await expect(franja(page)).toHaveCount(0, { timeout: 8_000 });
});

test("a mano sin señal: la hoja abre igual, el abono va a la cola y al volver se abre su comando y se guarda una vez", async ({ page, context }) => {
  const cliente = await clienteNuevo();
  await entrarComo(page, "duenio");
  await page.goto(`/clientes/${cliente.id}`);
  await page.waitForLoadState("networkidle"); // la hoja se precarga por detrás

  await context.setOffline(true);
  await expect(page.getByText("Sin señal", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Registrar abono" }).click();
  const hoja = page.getByRole("dialog", { name: "Registrar abono" });
  await expect(hoja).toBeVisible();
  await hoja.getByRole("button", { name: /¿Cuánto te dio\?/ }).click();
  await hoja.getByLabel("¿Cuánto te dio?").fill("35");
  await hoja.getByRole("button", { name: "Listo" }).click();
  // Dos toques seguidos: se guarda una sola vez en la cola.
  await hoja.getByRole("button", { name: "Confirmar abono" }).dblclick();
  await expect(page.getByText("Quedó en el celular")).toBeVisible();
  await expect(page.getByText(/Por enviar: 1 abono\./)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText("Listo: se envió lo guardado")).toBeVisible({ timeout: 20_000 });
  const abonos = async () => (await base.from("abonos").select("monto, comando_voz_id").eq("cliente_id", cliente.id)).data ?? [];
  await expect.poll(abonos).toHaveLength(1);
  const [guardado] = await abonos();
  expect(Number(guardado!.monto)).toBe(35);
  expect(guardado!.comando_voz_id).toBeGreaterThan(0);
  // A mano, el monto lo pone la persona: el comando queda «corregido», como cualquier abono a mano (nunca «pendiente»).
  expect(await comando(guardado!.comando_voz_id!)).toMatchObject({ resultado: "corregido" });
});

// ---- Lo que arregló /chaos el 2026-11-12 (falló antes del arreglo) ----

test("regresión /chaos: una venta en cola cuyo cliente se borró no culpa a la señal ni se reintenta para siempre", async ({ page, context }) => {
  const cliente = await clienteNuevo();
  const ventaCmd = await crearComando();
  const hoja = await dictar(page, ventaCmd, ventaAlCredito(cliente), "¿Así fue la venta?");
  await context.setOffline(true);
  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(hoja).toBeHidden({ timeout: 5_000 });
  await base.from("clientes").delete().eq("id", cliente.id);

  await context.setOffline(false);
  // Es un rechazo con su motivo, no «la señal está débil».
  await expect(page.getByText(/No entró: Venta a/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/ya no está en tu cuaderno/)).toBeVisible();
  await expect(page.getByText("La señal está débil")).toHaveCount(0);
  expect((await base.from("ventas").select("id").eq("comando_voz_id", ventaCmd)).data).toHaveLength(0);

  // Quitarla de la lista deja la cola limpia.
  await page.getByRole("button", { name: "Quitar de la lista" }).click();
  await expect(page.getByText(/No entró/)).toHaveCount(0);
});
