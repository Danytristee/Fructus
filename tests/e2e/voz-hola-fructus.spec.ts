import { expect, test, type Page } from "@playwright/test";

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

type Envio = { archivo: string; despertar: string | null; duracionMs: number };

/** /api/voz simulado con esa tarjeta; devuelve lo que llegó en cada pedido. */
async function simularVoz(page: Page, comandoId = 41, t: object = tarjeta): Promise<Envio[]> {
  const envios: Envio[] = [];
  await page.route("/api/voz", (r) => {
    const cuerpo = r.request().postDataBuffer()!.toString("latin1");
    envios.push({
      archivo: cuerpo.match(/name="audio"; filename="([^"]+)"/)?.[1] ?? "",
      despertar: cuerpo.match(/name="despertar"\r\n\r\n([^\r]*)/)?.[1] ?? null,
      duracionMs: Number(cuerpo.match(/name="duracion_ms"\r\n\r\n(\d+)/)?.[1]),
    });
    return r.fulfill({ json: { comandoId, tarjeta: t, latenciaMs: 900 } });
  });
  return envios;
}

test("«Hola Fructus, vendí…» dicho de corrido: sin tocar nada, envía lo dicho con la frase y abre la tarjeta", async ({ page }) => {
  test.slow();
  await escuchando(page);
  const envios = await simularVoz(page);
  const dicho = decir(page, VENTA);
  // Despierta a mitad del audio: el orbe queda escuchando sin el dedo (dice «Enviar»), sin un solo toque.
  await expect(orbe(page)).toHaveAttribute("data-estado", "escuchando", { timeout: 10_000 });
  await expect(orbe(page)).toHaveAttribute("data-bloqueado", "true");
  await dicho;
  // Al callarse se envía: un WAV con la frase (los 2 s de antes de despertar) y todo lo que siguió, marcado para que el servidor
  // confirme que se dijo «Hola Fructus» (5d). El audio dura 6.2 s: si faltara el principio o el final, sería más corto.
  await expect(hojaVenta(page)).toBeVisible({ timeout: 15_000 });
  expect(envios).toHaveLength(1);
  expect(envios[0]).toMatchObject({ archivo: "voz.wav", despertar: "1" });
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
