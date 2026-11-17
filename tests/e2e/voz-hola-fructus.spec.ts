import { expect, test, type Page, type Route } from "@playwright/test";

import { baseLocal } from "./base";
import { entrarComo } from "./cuentas";
import { abastecer, crearComando } from "./dictar";
import { decir, dichas, microfonoQueDice, responder, sintetizadorDePrueba, terminarFrase } from "./manos-libres";

// «Hola Fructus» en «Hoy» (actividad 5c), de punta a punta en Chrome. El micrófono falso dice audios de verdad (tests/palabra/, con la
// voz que el modelo nunca oyó) y la escucha corre de verdad: el worker, onnxruntime-web y los tres modelos. /api/voz se simula: se
// prueba la pantalla y lo que se envía, no a Groq.

/** «Hola Fructus, vendí diez cajas de mango kent a don Lucho, lo debe.», de corrido. */
const VENTA = "tests/palabra/hola-fructus-venta.wav";
/** «Hola Fructus.» y nada más. */
const SOLO_LA_FRASE = "tests/palabra/hola-fructus.wav";
/** «Hola, ¿hay frutas?»: lo que más se le parece en un puesto de frutas. */
const PARECIDA = "tests/palabra/hola-frutas.wav";

const base = baseLocal();
const clientePorAncho = { "s25-412": { id: 1, nombre: "Luis Paredes" }, "gama-media-360": { id: 4, nombre: "Bodega Santa Ana" } } as const;
type Ancho = keyof typeof clientePorAncho;

const tarjetaDe = (cliente: { id: number; nombre: string }, fruta: { id: number; nombre: string }) => ({
  tipo: "venta",
  cliente: { dicho: "don lucho", elegido: cliente, opciones: [] },
  items: [{ producto: { dicho: "mango kent", elegido: fruta, opciones: [] }, cantidad: 10, precio: { valor: 45, sugerido: false }, subtotal: 450 }],
  descuento: 0,
  total: 450,
  condicion: "credito",
  medio: null,
  comprobante: "ninguno",
  dudas: [],
  falta: [],
});
const tarjeta = tarjetaDe({ id: 1, nombre: "Luis Paredes" }, { id: 1, nombre: "Mango Kent" });

const orbe = (page: Page) => page.locator("button[data-estado]");
const hojaVenta = (page: Page) => page.getByRole("dialog", { name: "¿Así fue la venta?" });

/** Entra como dueño y espera a que «Hoy» esté escuchando la frase de verdad: la oreja en el orbe. */
async function escuchando(page: Page, { prendido = true } = {}) {
  if (prendido) await page.addInitScript(() => localStorage.setItem("fructus:hola-fructus", "si"));
  await microfonoQueDice(page);
  await entrarComo(page, "duenio");
  // En desarrollo, la primera vez se compila el worker y se cargan los modelos: unos segundos.
  if (prendido) await expect(orbe(page)).toHaveAttribute("data-palabra", "true", { timeout: 30_000 });
}

type Envio = { archivo: string; despertar: string | null; celular: string | null; duracionMs: number };

/** Lo que llegó a /api/voz: el nombre del audio, la marca de «Hola Fructus» y la duración. */
function leerEnvio(r: Route): Envio {
  const cuerpo = r.request().postDataBuffer()!.toString("latin1");
  return {
    archivo: cuerpo.match(/name="audio"; filename="([^"]+)"/)?.[1] ?? "",
    despertar: cuerpo.match(/name="despertar"\r\n\r\n([^\r]*)/)?.[1] ?? null,
    celular: cuerpo.match(/name="celular"\r\n\r\n([^\r]*)/)?.[1] ?? null,
    duracionMs: Number(cuerpo.match(/name="duracion_ms"\r\n\r\n(\d+)/)?.[1]),
  };
}

/** /api/voz simulado con esa tarjeta; devuelve lo que llegó en cada pedido. */
async function simularVoz(page: Page, comandoId = 41, t: object = tarjeta): Promise<Envio[]> {
  const envios: Envio[] = [];
  await page.route("/api/voz", (r) => {
    envios.push(leerEnvio(r));
    return r.fulfill({ json: { comandoId, tarjeta: t, latenciaMs: 900 } });
  });
  return envios;
}

test("«Hola Fructus, vendí…» dicho de corrido: sin tocar nada, envía lo dicho con la frase y abre la tarjeta", async ({ page }) => {
  test.slow();
  await escuchando(page);
  // Se ve que escucha y qué hay que decir, con palabras (/formidable 2026-11-16, cambio 2).
  await expect(page.locator("[data-oreja]")).toHaveText("Escucho «Hola Fructus»");
  const envios = await simularVoz(page);
  const dicho = decir(page, VENTA);
  // Despierta a mitad del audio: el orbe queda escuchando sin el dedo (dice «Enviar»), sin un solo toque.
  await expect(orbe(page)).toHaveAttribute("data-estado", "escuchando", { timeout: 10_000 });
  await expect(orbe(page)).toHaveAttribute("data-bloqueado", "true");
  // Con las manos ocupadas no se toca «Enviar»: se dice que se envía solo (cambio 1).
  await expect(page.locator("#voz-texto")).toHaveText("Te escucho. Lo envío cuando te calles");
  await dicho;
  // Al callarse se envía: un WAV con la frase (los 2 s de antes de despertar) y todo lo que siguió, marcado para que el servidor
  // confirme que se dijo «Hola Fructus» (5d). El audio dura 6.2 s: si faltara el principio o el final, sería más corto.
  await expect(hojaVenta(page)).toBeVisible({ timeout: 15_000 });
  expect(envios).toHaveLength(1);
  expect(envios[0]).toMatchObject({ archivo: "voz.wav", despertar: "1" });
  // Con el número de este celular: si otro celular oyó lo mismo, el servidor abre una sola tarjeta (ADR-0022).
  expect(envios[0]!.celular?.length).toBeGreaterThanOrEqual(8);
  expect(envios[0]!.duracionMs).toBeGreaterThan(6200);
  expect(envios[0]!.duracionMs).toBeLessThan(9000);
});

test("«Hola, ¿hay frutas?» no lo despierta", async ({ page }) => {
  await escuchando(page);
  const envios = await simularVoz(page);
  await decir(page, PARECIDA);
  await page.waitForTimeout(1500);
  await expect(orbe(page)).toHaveAttribute("data-estado", "listo");
  expect(envios).toHaveLength(0);
});

test("si después de «Hola Fructus» no dice nada, no envía, lo dice y vuelve a escuchar", async ({ page }) => {
  test.slow();
  await escuchando(page);
  const envios = await simularVoz(page);
  await decir(page, SOLO_LA_FRASE);
  await expect(orbe(page)).toHaveAttribute("data-estado", "escuchando", { timeout: 10_000 });
  await expect(page.locator("#voz-texto")).toHaveText("No te oí después de «Hola Fructus».", { timeout: 10_000 });
  await expect(orbe(page)).toHaveAttribute("data-estado", "listo");
  expect(envios).toHaveLength(0);
  // Sigue escuchando: la venta dicha ahora sí llega.
  await expect(orbe(page)).toHaveAttribute("data-palabra", "true");
  await decir(page, VENTA);
  await expect(hojaVenta(page)).toBeVisible({ timeout: 15_000 });
  expect(envios).toHaveLength(1);
});

test("si el servidor oyó «frutas» y no la frase (5d), vuelve a escuchar sin aviso ni tarjeta", async ({ page }) => {
  test.slow();
  await escuchando(page);
  let envios = 0;
  await page.route("/api/voz", (r) => {
    envios++;
    return r.fulfill({ json: { ignorado: "parecida" } });
  });
  await decir(page, VENTA);
  await expect.poll(() => envios, { timeout: 15_000 }).toBe(1);
  await expect(orbe(page)).toHaveAttribute("data-estado", "listo");
  await expect(orbe(page)).toHaveAttribute("data-palabra", "true"); // sigue escuchando
  await expect(hojaVenta(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Cerrar el aviso" })).toBeHidden(); // no es un error: no hay aviso que cerrar
});

test("si otro celular ya anotó lo mismo, lo dice y no abre otra tarjeta", async ({ page }) => {
  test.slow();
  await escuchando(page);
  await page.route("/api/voz", (r) => r.fulfill({ json: { ignorado: "otro_celular" } }));
  await decir(page, VENTA);
  await expect(page.locator("#voz-texto")).toHaveText("Eso ya lo anotó otro celular.", { timeout: 15_000 });
  await expect(hojaVenta(page)).toBeHidden();
});

test("si el servidor oyó solo la frase, dice que no oyó lo que seguía", async ({ page }) => {
  test.slow();
  await escuchando(page);
  await page.route("/api/voz", (r) => r.fulfill({ json: { ignorado: "sin_orden" } }));
  await decir(page, VENTA);
  await expect(page.locator("#voz-texto")).toHaveText("No te oí después de «Hola Fructus».", { timeout: 15_000 });
  await expect(hojaVenta(page)).toBeHidden();
});

test("si el servidor falla, lo dicho después de «Hola Fructus» se guarda y «Reintentar» lo envía con su marca", async ({ page }) => {
  test.slow();
  await escuchando(page);
  const envios: Envio[] = [];
  await page.route("/api/voz", (r) => {
    envios.push(leerEnvio(r));
    if (envios.length === 1) return r.fulfill({ status: 503, json: { error: "No pudimos guardar lo que dijiste. Revisa tu señal e inténtalo otra vez.", conservarAudio: true } });
    return r.fulfill({ json: { comandoId: 41, tarjeta, latenciaMs: 900 } });
  });
  await decir(page, VENTA);
  await page.getByRole("button", { name: "Reintentar" }).click({ timeout: 15_000 });
  await expect(hojaVenta(page)).toBeVisible({ timeout: 15_000 });
  expect(envios).toHaveLength(2);
  // El servidor vuelve a revisar la frase: la marca no se pierde en el celular.
  expect(envios[1]).toMatchObject({ archivo: "voz.wav", despertar: "1" });
});

test("sin señal, lo dicho después de «Hola Fructus» va a la cola y al volver la señal se envía con su marca", async ({ page, context }) => {
  test.slow();
  await escuchando(page);
  const envios = await simularVoz(page);
  await context.setOffline(true);
  await expect(page.getByText("Sin señal", { exact: true })).toBeVisible();
  // El detector corre en el celular: escucha igual sin señal.
  await decir(page, VENTA);
  await expect(page.getByText(/Sin señal: guardé lo que dijiste/)).toBeVisible({ timeout: 15_000 });
  expect(envios).toHaveLength(0);
  await context.setOffline(false);
  await expect.poll(() => envios.length, { timeout: 20_000 }).toBe(1);
  expect(envios[0]).toMatchObject({ archivo: "voz.wav", despertar: "1" });
});

/** Simula que la pantalla se oculta (otra app, el celular bloqueado) o vuelve a verse. */
const visibilidad = (page: Page, estado: "hidden" | "visible") =>
  page.evaluate((e) => {
    Object.defineProperty(document, "visibilityState", { value: e, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, estado);

const microfonosAbiertos = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __abiertos: { destino: MediaStreamAudioDestinationNode }[] }).__abiertos.filter((m) =>
        m.destino.stream.getAudioTracks().some((t) => t.readyState === "live"),
      ).length,
  );

test("regresión /chaos 2: si la pantalla se oculta a mitad de lo dictado, se descarta y al volver escucha de nuevo", async ({ page }) => {
  test.slow();
  await escuchando(page);
  const envios = await simularVoz(page);
  void decir(page, SOLO_LA_FRASE);
  await expect(orbe(page)).toHaveAttribute("data-estado", "escuchando", { timeout: 10_000 });
  await visibilidad(page, "hidden");
  // Como al salir de «Hoy»: no se queda «Te escucho…» sin grabar nada.
  await expect(orbe(page)).toHaveAttribute("data-estado", "listo", { timeout: 3_000 });
  await visibilidad(page, "visible");
  await expect(orbe(page)).toHaveAttribute("data-palabra", "true", { timeout: 10_000 });
  expect(envios).toHaveLength(0);
  await decir(page, VENTA);
  await expect(hojaVenta(page)).toBeVisible({ timeout: 15_000 });
  expect(envios).toHaveLength(1);
});

test("regresión /chaos 3: si los modelos no bajan, avisa y suelta el micrófono", async ({ page }) => {
  await page.route("**/voz/*.onnx", (r) => r.abort("internetdisconnected"));
  await page.addInitScript(() => localStorage.setItem("fructus:hola-fructus", "si"));
  await microfonoQueDice(page);
  await entrarComo(page, "duenio");
  await expect(page.getByText("No pude escuchar «Hola Fructus». Toca el orbe para hablar.")).toBeVisible({ timeout: 15_000 });
  await expect(orbe(page)).not.toHaveAttribute("data-palabra");
  // Nada escucha: el punto verde de micrófono del celular no puede quedar prendido.
  await expect.poll(() => microfonosAbiertos(page)).toBe(0);
});

test("«Borrar» tira lo que siguió a «Hola Fructus» sin enviarlo", async ({ page }) => {
  await escuchando(page);
  const envios = await simularVoz(page);
  await decir(page, SOLO_LA_FRASE);
  await expect(orbe(page)).toHaveAttribute("data-estado", "escuchando", { timeout: 10_000 });
  await page.getByRole("button", { name: "Borrar" }).click();
  await expect(page.locator("#voz-texto")).toHaveText("Cancelado. No se envió nada.");
  await expect(orbe(page)).toHaveAttribute("data-estado", "listo");
  await page.waitForTimeout(1500);
  expect(envios).toHaveLength(0);
});

test("con la tarjeta abierta no escucha la frase: un «Hola Fructus» del cliente no abre otra encima", async ({ page }) => {
  test.slow();
  await escuchando(page);
  const envios = await simularVoz(page);
  await decir(page, VENTA);
  await expect(hojaVenta(page)).toBeVisible({ timeout: 15_000 });
  await decir(page, VENTA);
  await page.waitForTimeout(2500);
  expect(envios).toHaveLength(1);
  await expect(hojaVenta(page)).toBeVisible();
});

test("el interruptor del menú prende la escucha y, al apagarlo, suelta el micrófono", async ({ page }) => {
  test.slow();
  await escuchando(page, { prendido: false });
  await expect(orbe(page)).not.toHaveAttribute("data-palabra");
  const menu = async () => {
    await page.getByRole("button", { name: /^Menú/ }).click();
    const interruptor = page.getByRole("switch", { name: /Hola Fructus/ });
    await interruptor.click();
    await page.keyboard.press("Escape");
    return interruptor;
  };
  await menu();
  await expect(orbe(page)).toHaveAttribute("data-palabra", "true", { timeout: 30_000 });
  // Con «Hola Fructus» prendido y «Manos libres» apagado, el menú dice qué falta para no tocar nada (cambio 3); al prenderlo, deja de decirlo.
  await page.getByRole("button", { name: /^Menú/ }).click();
  await expect(page.getByText("Para no tocar nada")).toBeVisible();
  await page.getByRole("switch", { name: /Manos libres/ }).click();
  await expect(page.getByText("Para no tocar nada")).toBeHidden();
  await page.keyboard.press("Escape");
  await menu();
  await expect(orbe(page)).not.toHaveAttribute("data-palabra");
  // Ningún micrófono queda abierto: la luz de «micrófono en uso» del celular se apaga.
  const abiertos = () =>
    page.evaluate(() =>
      (window as unknown as { __abiertos: { destino: MediaStreamAudioDestinationNode }[] }).__abiertos.filter((m) =>
        m.destino.stream.getAudioTracks().some((t) => t.readyState === "live"),
      ).length,
    );
  await expect.poll(abiertos).toBe(0);
});

test("con manos libres, una venta sin un solo toque: «Hola Fructus, vendí…», la lectura, «confirmo» y «Guardado»", async ({ page }, info) => {
  test.slow();
  const cliente = clientePorAncho[info.project.name as Ancho];
  // La base local puede tener el catálogo real (los productos de la semilla, inactivos): se vende una fruta activa, con su stock.
  const { data: fruta } = await base.from("productos").select("id, nombre").eq("activo", true).order("id").limit(1).single();
  await abastecer(fruta!.id, 10);
  const comandoId = await crearComando();
  await sintetizadorDePrueba(page, { manosLibres: true });
  await escuchando(page);
  await simularVoz(page, comandoId, tarjetaDe(cliente, fruta!));
  await page.route("/api/voz/respuesta", (r) => r.fulfill({ json: { respuesta: "confirmar" } }));

  await decir(page, VENTA);
  await expect(hojaVenta(page)).toBeVisible({ timeout: 15_000 });
  // Lee la venta («… ¿Confirmo?») y, al terminar, escucha la respuesta.
  await expect.poll(async () => (await dichas(page)).some((d) => d.endsWith("¿Confirmo?"))).toBe(true);
  await terminarFrase(page);
  await expect(hojaVenta(page).getByRole("status").filter({ hasText: "di «confirmo»" })).toBeVisible();
  const respuesta = page.waitForRequest((r) => r.url().endsWith("/api/voz/respuesta"));
  await responder(page);
  await respuesta;
  await expect(page.getByText("Venta guardada")).toBeVisible();
  await expect.poll(() => dichas(page)).toContain("Guardado.");

  const { data: ventas } = await base.from("ventas").select("id").eq("comando_voz_id", comandoId);
  expect(ventas).toHaveLength(1);
  const { data: comando } = await base.from("comandos_voz").select("resultado, confirmado_por").eq("id", comandoId).single();
  expect(comando).toEqual({ resultado: "confirmado", confirmado_por: "voz" });
});
