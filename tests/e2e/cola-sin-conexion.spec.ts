import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { baseLocal, enSoles, entornoLocal } from "./base";
import { CLAVE_PRUEBA, cuentas, entrarComo } from "./cuentas";
import { comando, crearComando, dictar, fiar, saldoDe } from "./dictar";

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

/** Una sesión de dueño contra la base local, como la de otro celular. */
async function sesionDuenio() {
  const e = entornoLocal();
  const duenio = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await duenio.auth.signInWithPassword({ email: cuentas.duenio, password: CLAVE_PRUEBA });
  return duenio;
}

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
  await expect(page.getByText("Si lo cierras, lo verás aquí otra vez.")).toBeVisible();
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

// ---- La segunda parte (2026-11-12): la hora del toque, el saldo a favor y lo que pidió /formidable ----

/** Corre el reloj de lo guardado en el celular hacia atrás, como si se hubiera confirmado hace `ms`. */
async function retrocederCola(page: Page, ms: number) {
  await page.evaluate(
    (atras) =>
      new Promise<void>((ok) => {
        const r = indexedDB.open("fructus-cola");
        r.onsuccess = () => {
          const tx = r.result.transaction("entradas", "readwrite");
          const almacen = tx.objectStore("entradas");
          almacen.getAll().onsuccess = (e) => {
            for (const entrada of (e.target as IDBRequest).result) almacen.put({ ...entrada, creadoEn: entrada.creadoEn - atras });
          };
          tx.oncomplete = () => ok();
        };
      }),
    ms,
  );
}

test("la venta confirmada sin señal queda con la hora del toque, y mientras tanto se dice aparte de «Vendiste hoy»", async ({ page, context }) => {
  const cliente = await clienteNuevo();
  const ventaCmd = await crearComando();
  const hoja = await dictar(page, ventaCmd, ventaAlCredito(cliente), "¿Así fue la venta?");
  await context.setOffline(true);
  // Con la hoja abierta el velo tapa la franja: la tarjeta lo dice antes de tocar Confirmar.
  await expect(hoja.getByText("Sin señal: se guarda en el celular y se envía cuando vuelva.")).toBeVisible();
  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(hoja).toBeHidden({ timeout: 5_000 });
  await expect(page.getByTestId("ventas-por-enviar")).toHaveText(`+ 1 venta por enviar (${enSoles(100)}): todavía no está sumada.`);

  // Se confirmó hace 3 horas (la señal se fue un buen rato).
  const tresHoras = 3 * 3_600_000;
  await retrocederCola(page, tresHoras);
  await context.setOffline(false);
  await expect.poll(async () => (await base.from("ventas").select("fecha, creado_en").eq("comando_voz_id", ventaCmd)).data?.length, { timeout: 30_000 }).toBe(1);
  const { data } = await base.from("ventas").select("fecha, creado_en").eq("comando_voz_id", ventaCmd).single();
  const atras = Date.parse(data!.creado_en) - Date.parse(data!.fecha);
  // La fecha es la del toque (unos 3 h antes de que llegara); creado_en, la del servidor.
  expect(Math.abs(atras - tresHoras)).toBeLessThan(60_000);
  await expect(page.getByTestId("ventas-por-enviar")).toHaveCount(0);
});

test("un abono en cola de una venta que se anuló mientras tanto avisa que el cliente quedó a favor", async ({ page, context }) => {
  const cliente = await clienteNuevo();
  await fiar(cliente.id, 60);
  await entrarComo(page, "duenio");
  await page.goto(`/clientes/${cliente.id}`);
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Registrar abono" }).click();
  const hoja = page.getByRole("dialog", { name: "Registrar abono" });
  await hoja.getByRole("button", { name: /¿Cuánto te dio\?/ }).click();
  await hoja.getByLabel("¿Cuánto te dio?").fill("60");
  await hoja.getByRole("button", { name: "Listo" }).click();
  await hoja.getByRole("button", { name: "Confirmar abono" }).click();
  await expect(page.getByText("Quedó en el celular")).toBeVisible();

  // Mientras el abono espera, el dueño anula la venta en otro celular.
  const { data: venta } = await base.from("ventas").select("id").eq("cliente_id", cliente.id).single();
  const { error } = await (await sesionDuenio()).rpc("anular_venta", { p_venta_id: venta!.id, p_motivo: "se equivocó de cliente" });
  expect(error).toBeNull();

  await context.setOffline(false);
  await expect(page.getByText(`${cliente.nombre} quedó con ${enSoles(60)} a favor.`)).toBeVisible({ timeout: 20_000 });
  expect(await saldoDe(cliente.id)).toBe(-60);
  // No se va sola: espera a que la persona la lea.
  await page.getByRole("button", { name: "Entendido" }).click();
  await expect(page.getByText(/quedó con .* a favor/)).toHaveCount(0);
});

test("lo que la base rechazó se anota otra vez desde la franja, ya llenado, eligiendo otro cliente", async ({ page, context }) => {
  const borrado = await clienteNuevo();
  const otro = await clienteNuevo();
  await entrarComo(page, "duenio");
  await page.goto(`/clientes/${borrado.id}`);
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Registrar abono" }).click();
  const hoja = page.getByRole("dialog", { name: "Registrar abono" });
  await hoja.getByRole("button", { name: /¿Cuánto te dio\?/ }).click();
  await hoja.getByLabel("¿Cuánto te dio?").fill("25");
  await hoja.getByRole("button", { name: "Listo" }).click();
  await hoja.getByRole("button", { name: "Confirmar abono" }).click();
  await expect(hoja).toBeHidden({ timeout: 5_000 });
  await base.from("clientes").delete().eq("id", borrado.id);
  await context.setOffline(false);
  await page.goto("/");

  await expect(page.getByText(/No entró: Abono de/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Anotarlo otra vez" }).click();
  const anotar = page.getByRole("dialog", { name: "Anotar otra vez" });
  await expect(anotar).toBeVisible({ timeout: 15_000 });
  // El monto ya está; falta elegir a quién, porque ese cliente ya no está.
  await expect(anotar.getByText(enSoles(25))).toBeVisible();
  await anotar.getByRole("button", { name: new RegExp(borrado.nombre) }).click();
  await anotar.getByPlaceholder("¿Quién te pagó?").fill(otro.nombre);
  await anotar.getByRole("button", { name: new RegExp(otro.nombre) }).click();
  await anotar.getByRole("button", { name: "Confirmar abono" }).click();
  await expect(page.getByText("Abono guardado")).toBeVisible();

  expect((await base.from("abonos").select("monto").eq("cliente_id", otro.id)).data).toEqual([{ monto: 25 }]);
  // Lo nuevo quedó guardado: el rechazo sale de la lista solo.
  await expect(page.getByText(/No entró/)).toHaveCount(0, { timeout: 8_000 });
});
