import { expect, test, type Page } from "@playwright/test";

import { baseLocal, enSoles } from "./base";
import { entrarComo, type Rol } from "./cuentas";
import { fiar, saldoDe } from "./dictar";
import { medir, quieto } from "./medir";

// Registrar un abono a mano (A8): la misma tarjeta que el abono por voz, llenada con lo que se toca. Cada prueba crea su
// propio cliente con deuda, así las corridas en paralelo no se pisan y ninguno es el de otra prueba.

test.setTimeout(90_000);
const base = baseLocal();

async function clienteConDeuda(deuda: number | null) {
  const nombre = `Cliente de prueba ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const { data, error } = await base.from("clientes").insert({ nombre }).select("id, nombre").single();
  if (error || !data) throw new Error(`No se pudo crear el cliente de prueba: ${error?.message}`);
  if (deuda !== null) await fiar(data.id, deuda);
  return data;
}

const abonosDe = async (clienteId: number) =>
  (await base.from("abonos").select("monto, medio_pago, comando_voz_id").eq("cliente_id", clienteId)).data ?? [];

/** Entra, abre la ficha del cliente y toca «Registrar abono». Devuelve la hoja ya abierta. */
async function abrirDesdeLaFicha(page: Page, clienteId: number, rol: Rol = "duenio") {
  await entrarComo(page, rol);
  await page.goto(`/clientes/${clienteId}`);
  await page.getByRole("button", { name: "Registrar abono" }).click();
  const hoja = page.getByRole("dialog", { name: "Registrar abono" });
  // En desarrollo, la primera vez se compila la hoja (se carga en diferido).
  await expect(hoja).toBeVisible({ timeout: 15_000 });
  return hoja;
}

async function escribirMonto(hoja: ReturnType<Page["getByRole"]>, monto: string) {
  await hoja.getByRole("button", { name: /¿Cuánto te dio\?/ }).click();
  await hoja.getByLabel("¿Cuánto te dio?").fill(monto);
  await hoja.getByRole("button", { name: "Listo" }).click();
}

test("desde la ficha: el abono baja la deuda, se guarda una sola vez con dos toques y queda como «a mano»", async ({ page }) => {
  const c = await clienteConDeuda(100);
  const hoja = await abrirDesdeLaFicha(page, c.id);

  // El cliente ya está elegido; sin monto no se confirma y dice qué falta (nunca se inventa).
  await expect(hoja.getByRole("button", { name: new RegExp(c.nombre) })).toBeVisible();
  await expect(hoja.getByText("Falta elegir cuánto te dio.")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Confirmar abono" })).toBeDisabled();

  await escribirMonto(hoja, "40");
  await expect(hoja.getByText(`Con este abono, ${c.nombre} te debe`)).toBeVisible();
  await expect(hoja.getByText(enSoles(60))).toBeVisible();
  await hoja.getByRole("button", { name: "Yape" }).click();

  const confirmar = hoja.getByRole("button", { name: "Confirmar abono" });
  await confirmar.evaluate((b: HTMLButtonElement) => {
    b.click();
    b.click();
  });
  await expect(page.getByText("Abono guardado")).toBeVisible();
  await expect(page.getByText(`${c.nombre} te debe ${enSoles(60)}`)).toBeVisible();
  await expect(hoja).toBeHidden({ timeout: 5_000 });

  // La ficha se rearmó sola: la deuda nueva y el abono en su historial.
  await expect(page.getByTestId("deuda-cliente")).toContainText(enSoles(60));
  await expect(page.getByTestId("movimientos")).toContainText("Abonó con Yape");

  // Lo que quedó en la base: un solo abono (no dos), la deuda baja 40 y el comando es «a mano».
  const abonos = await abonosDe(c.id);
  expect(abonos).toEqual([{ monto: 40, medio_pago: "yape", comando_voz_id: expect.any(Number) }]);
  expect(await saldoDe(c.id)).toBe(60);
  const { data: comando } = await base
    .from("comandos_voz")
    .select("intencion, modelo_stt, transcripcion, resultado")
    .eq("id", abonos[0]!.comando_voz_id!)
    .single();
  expect(comando).toMatchObject({ intencion: "registrar_abono", modelo_stt: "manual", transcripcion: "(a mano)" });
  expect(["confirmado", "corregido"]).toContain(comando!.resultado);
});

test("desde el cuaderno: se elige a quién pagó y, pagando todo, queda al día", async ({ page }) => {
  const c = await clienteConDeuda(100);
  await entrarComo(page, "duenio");
  await page.goto("/clientes");
  await page.getByRole("button", { name: "Registrar abono" }).click();
  const hoja = page.getByRole("dialog", { name: "Registrar abono" });
  await expect(hoja).toBeVisible({ timeout: 15_000 });

  await expect(hoja.getByText("Falta elegir quién te pagó y cuánto te dio.")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Confirmar abono" })).toBeDisabled();

  // Se ofrece primero a los que más deben; para uno de poca deuda, se busca por nombre.
  await hoja.getByRole("button", { name: /¿Quién te pagó\?/ }).click();
  await hoja.getByRole("searchbox", { name: "¿Quién te pagó?" }).fill(c.nombre);
  await hoja.getByRole("button", { name: new RegExp(c.nombre) }).click();
  await escribirMonto(hoja, "100");
  await expect(hoja.getByText("queda al día")).toBeVisible();

  await hoja.getByRole("button", { name: "Confirmar abono" }).click();
  await expect(page.getByText("Abono guardado")).toBeVisible();
  await expect(page.getByText(`${c.nombre} no te debe nada`)).toBeVisible();

  expect(await abonosDe(c.id)).toEqual([{ monto: 100, medio_pago: "efectivo", comando_voz_id: expect.any(Number) }]);
  expect(await saldoDe(c.id)).toBe(0);
});

test("respuesta perdida al confirmar: queda en el celular, se reintenta solo y el abono no se repite (ADR-0017)", async ({ page }) => {
  const c = await clienteConDeuda(100);
  const hoja = await abrirDesdeLaFicha(page, c.id);
  await escribirMonto(hoja, "25");

  // El pedido llega al servidor y se guarda, pero la respuesta se pierde en el camino.
  await page.route("**/*", async (r) => (r.request().method() === "POST" && r.request().headers()["next-action"] ? (await r.fetch(), r.abort()) : r.fallback()));
  await hoja.getByRole("button", { name: "Confirmar abono" }).click();
  // No dice «no se pudo guardar» de lo que pudo guardarse: lo deja en el celular y lo reintenta solo.
  await expect(page.getByText("Quedó en el celular")).toBeVisible({ timeout: 20_000 });
  expect(await abonosDe(c.id)).toHaveLength(1);

  // Vuelve la señal: el reintento devuelve el mismo abono (idempotente por comando), no otro.
  // La cola puede estar reintentando justo ahora: ese pedido en vuelo se deja terminar.
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await expect(page.getByText("Listo: se envió lo guardado")).toBeVisible({ timeout: 30_000 });
  expect(await abonosDe(c.id)).toHaveLength(1);
  expect(await saldoDe(c.id)).toBe(75);
});

test("la señal no responde al abrir: la hoja abre igual, el abono va a la cola y entra una vez (ADR-0017)", async ({ page }) => {
  const c = await clienteConDeuda(100);
  await entrarComo(page, "duenio");
  await page.goto(`/clientes/${c.id}`);
  await page.waitForLoadState("networkidle");

  await page.route("**/*", (r) => (r.request().method() === "POST" && r.request().headers()["next-action"] ? r.abort() : r.fallback()));
  await page.getByRole("button", { name: "Registrar abono" }).click();
  // No se queda girando ni pide reintentar: abre la hoja con un comando solo del celular.
  const hoja = page.getByRole("dialog", { name: "Registrar abono" });
  await expect(hoja).toBeVisible({ timeout: 15_000 });
  await escribirMonto(hoja, "20");
  await hoja.getByRole("button", { name: "Confirmar abono" }).click();
  await expect(page.getByText("Quedó en el celular")).toBeVisible();
  expect(await abonosDe(c.id)).toHaveLength(0);

  // Con señal, la cola abre el comando de verdad y guarda el abono una vez.
  await page.unrouteAll();
  await expect.poll(() => abonosDe(c.id), { timeout: 30_000 }).toHaveLength(1);
  expect(await saldoDe(c.id)).toBe(80);
});

test("descartar cierra la hoja sin guardar nada y deja el comando descartado", async ({ page }) => {
  const c = await clienteConDeuda(100);
  const desde = new Date().toISOString();
  const hoja = await abrirDesdeLaFicha(page, c.id);
  await escribirMonto(hoja, "30");

  await hoja.getByRole("button", { name: "Descartar" }).click();
  await expect(hoja).toBeHidden({ timeout: 5_000 });
  expect(await abonosDe(c.id)).toEqual([]);
  expect(await saldoDe(c.id)).toBe(100);
  await expect
    .poll(async () => (await base.from("comandos_voz").select("id").eq("modelo_stt", "manual").eq("resultado", "descartado").gte("creado_en", desde)).data?.length ?? 0)
    .toBeGreaterThanOrEqual(1);
});

test("el botón flotante no tapa el último movimiento ni se sale de la pantalla", async ({ page }) => {
  const c = await clienteConDeuda(100);
  await entrarComo(page, "duenio");
  await page.goto(`/clientes/${c.id}`);
  const boton = page.getByRole("button", { name: "Registrar abono" });
  await expect(boton).toBeVisible();

  const { desborde, chicos } = await medir(page);
  expect(desborde).toBeLessThanOrEqual(0);
  expect(chicos, "controles de menos de 48 px").toEqual([]);

  // Hasta abajo del todo, lo último que dice la ficha queda encima del botón, no debajo.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const fila = await page.getByTestId("movimientos").getByRole("listitem").last().boundingBox();
  const flotante = await boton.boundingBox();
  expect(fila!.y + fila!.height).toBeLessThanOrEqual(flotante!.y);
  // Está en el tercio de abajo, al alcance del pulgar.
  const { width: ancho, height: alto } = page.viewportSize()!;
  expect(flotante!.y).toBeGreaterThan((alto * 2) / 3);
  // Es una píldora compacta y centrada, no una franja de lado a lado que tape las filas (/formidable 2026-11-05).
  expect(flotante!.height).toBeLessThanOrEqual(56);
  expect(flotante!.width).toBeLessThan(ancho * 0.75);
  expect(Math.abs(flotante!.x + flotante!.width / 2 - ancho / 2)).toBeLessThan(2);
});

test("el ayudante registra un abono a mano", async ({ page }) => {
  const c = await clienteConDeuda(100);
  const hoja = await abrirDesdeLaFicha(page, c.id, "ayudante");
  await escribirMonto(hoja, "30");
  await hoja.getByRole("button", { name: "Confirmar abono" }).click();
  await expect(page.getByText("Abono guardado")).toBeVisible();
  expect(await abonosDe(c.id)).toEqual([{ monto: 30, medio_pago: "efectivo", comando_voz_id: expect.any(Number) }]);
  expect(await saldoDe(c.id)).toBe(70);
});

test("el contador no ve el botón de abono, ni en la ficha ni en el cuaderno", async ({ page }) => {
  const c = await clienteConDeuda(100);
  await entrarComo(page, "contador");
  await page.goto(`/clientes/${c.id}`);
  await expect(page.getByTestId("deuda-cliente")).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar abono" })).toHaveCount(0);
  await page.goto("/clientes");
  await expect(page.getByRole("heading", { level: 1, name: "Clientes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar abono" })).toHaveCount(0);
});

// ---- Lo que arregló /chaos y /formidable el 2026-11-05 (cada prueba falló antes del arreglo) ----

test("regresión /chaos: si el cliente ya no existe, lo dice, y no manda a revisar la señal", async ({ page }) => {
  const c = await clienteConDeuda(null); // sin ventas, para que la base deje borrarlo
  const hoja = await abrirDesdeLaFicha(page, c.id);
  await escribirMonto(hoja, "25");
  await base.from("clientes").delete().eq("id", c.id);
  await hoja.getByRole("button", { name: "Confirmar abono" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("Ese cliente ya no está en tu cuaderno. Elige a otro.");
  expect(await abonosDe(c.id)).toEqual([]);
});

test("regresión /chaos: con la sesión vencida, a mano no promete que el abono espera en «Hoy»", async ({ page, context }) => {
  const c = await clienteConDeuda(100);
  const hoja = await abrirDesdeLaFicha(page, c.id);
  await escribirMonto(hoja, "30");
  await context.clearCookies();
  await hoja.getByRole("button", { name: "Confirmar abono" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("Tu sesión terminó. Vuelve a entrar y registra el abono otra vez.");
  await expect(hoja.getByRole("button", { name: "Entrar otra vez" })).toBeVisible();
  expect(await abonosDe(c.id)).toEqual([]);
});

test("/formidable: la hoja vacía no marca nada en rojo, dice qué hacer y separa Confirmar de Descartar", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/clientes");
  await page.getByRole("button", { name: "Registrar abono" }).click();
  const hoja = page.getByRole("dialog", { name: "Registrar abono" });
  await expect(hoja).toBeVisible({ timeout: 15_000 });

  // Lo que falta se pide, no se regaña: el cliente y el monto se piden como preguntas.
  await expect(hoja.getByRole("button", { name: /¿Quién te pagó\?/ })).toBeVisible();
  await expect(hoja.getByText("Sin cliente")).toHaveCount(0);
  await expect(hoja.getByText("Toca para poner el monto")).toBeVisible();
  await expect(hoja.getByText("Falta elegir quién te pagó y cuánto te dio.")).toBeVisible();
  expect(await hoja.locator(".ring-deuda, .text-deuda").count(), "nada en rojo antes de empezar").toBe(0);

  // Con el monto puesto, «cambiar» vuelve a tener sentido.
  await escribirMonto(hoja, "10");
  await expect(hoja.getByText("Toca para cambiar el monto")).toBeVisible();

  // «Confirmar» y «Descartar» a 8 px o más (CLAUDE.md, regla 2). Se mide con la hoja quieta: la pieza entra a escala 0.985.
  await quieto(page);
  const confirmar = await hoja.getByRole("button", { name: "Confirmar abono" }).boundingBox();
  const descartar = await hoja.getByRole("button", { name: "Descartar" }).boundingBox();
  expect(descartar!.y - (confirmar!.y + confirmar!.height)).toBeGreaterThanOrEqual(8);
});

test("con la pantalla de lado, «Confirmar abono» queda a la vista y no hay que deslizar la hoja", async ({ page }) => {
  const c = await clienteConDeuda(100);
  const hoja = await abrirDesdeLaFicha(page, c.id);
  await page.setViewportSize({ width: 915, height: 412 }); // el celular girado (/chaos 2026-11-05)
  await page.waitForTimeout(700);
  const confirmar = await hoja.getByRole("button", { name: "Confirmar abono" }).boundingBox();
  expect(confirmar!.y).toBeGreaterThanOrEqual(0);
  expect(confirmar!.y + confirmar!.height).toBeLessThanOrEqual(412);
});
