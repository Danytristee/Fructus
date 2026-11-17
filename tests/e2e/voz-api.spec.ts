import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { baseLocal } from "./base";
import { revisarFrase } from "../../lib/voz/palabra-reglas";
import { entrarComo } from "./cuentas";

// POST /api/voz de punta a punta contra la base local y Groq real (necesita GROQ_API_KEY en .env.local).
// El audio es sintético (la voz «Paulina» del Mac): «Vendí 10 cajas de mango kent a don Lucho a 45, lo debe».
const audio = readFileSync("tests/e2e/audios/venta-mango-credito.m4a");
const conAudio = (datos = audio, tipo = "audio/mp4") => ({ multipart: { audio: { name: "audio.m4a", mimeType: tipo, buffer: datos }, duracion_ms: "4200" } });

test.describe.configure({ mode: "serial" });

test("una venta dictada vuelve como tarjeta y deja su rastro en comandos_voz", async ({ page }, info) => {
  test.skip(info.project.name !== "s25-412", "Una sola vez: cada corrida llama a Groq");
  await entrarComo(page, "duenio");
  const respuesta = await page.request.post("/api/voz", { ...conAudio(), timeout: 30_000 });
  expect(respuesta.status()).toBe(200);
  const { comandoId, tarjeta, latenciaMs } = await respuesta.json();

  expect(tarjeta.tipo).toBe("venta");
  expect(tarjeta.cliente.elegido?.nombre).toBe("Luis Paredes");
  expect(tarjeta.items).toHaveLength(1);
  expect(tarjeta.items[0].producto.elegido?.nombre).toBe("Mango Kent");
  expect(tarjeta.items[0].cantidad).toBe(10);
  expect(tarjeta.items[0].precio).toEqual({ valor: 45, sugerido: false });
  expect(tarjeta.total).toBe(450);
  expect(tarjeta.condicion).toBe("credito");
  expect(tarjeta.falta).toEqual([]);

  // Lo que quedó en la base: el comando pendiente de confirmar, con sus modelos y su latencia.
  const { data: comando } = await baseLocal().from("comandos_voz").select("*").eq("id", comandoId).single();
  expect(comando).toMatchObject({ intencion: "registrar_venta", resultado: "pendiente", duracion_audio_ms: 4200, latencia_ms: latenciaMs });
  expect(comando!.modelo_stt).toContain("whisper");
  expect(comando!.modelo_llm).toBeTruthy();
  expect(comando!.transcripcion.toLowerCase()).toContain("mango");
  console.log(`latencia del servidor: ${latenciaMs} ms`);
});

// «Hola Fructus» (actividades 5c y 5d): lo dictado después de la frase llega como WAV con `despertar=1`, con la frase incluida.
// Los audios son de la voz de Piper que el modelo nunca oyó (tests/palabra/).
/** El último comando de voz que hay: lo nuevo se cuenta por id (la transcripción cambia de una corrida a otra). */
const ultimoComando = async () =>
  (await baseLocal().from("comandos_voz").select("id").order("id", { ascending: false }).limit(1).maybeSingle()).data?.id ?? 0;

const conPalabra = (archivo: string) => ({
  multipart: { audio: { name: "voz.wav", mimeType: "audio/wav", buffer: readFileSync(`tests/palabra/${archivo}`) }, duracion_ms: "6000", despertar: "1" },
  timeout: 30_000,
});

test("después de «Hola Fructus», se interpreta lo que siguió y en comandos_voz queda todo lo dicho", async ({ page }, info) => {
  test.skip(info.project.name !== "s25-412", "Una sola vez: cada corrida llama a Groq");
  await entrarComo(page, "duenio");
  const respuesta = await page.request.post("/api/voz", conPalabra("hola-fructus-venta.wav"));
  expect(respuesta.status()).toBe(200);
  const { comandoId, tarjeta } = await respuesta.json();
  expect(tarjeta.tipo).toBe("venta");
  expect(tarjeta.items[0].cantidad).toBe(10);
  expect(tarjeta.condicion).toBe("credito");
  const { data: comando } = await baseLocal().from("comandos_voz").select("transcripcion, intencion").eq("id", comandoId).single();
  expect(comando!.intencion).toBe("registrar_venta");
  // Queda todo lo dicho, con la frase. Whisper no siempre escribe la marca igual («Fructus», «Fruptus»): la regla del servidor la reconoce.
  expect(revisarFrase(comando!.transcripcion).veredicto).toBe("dijo");
});

test("si después de despertar Whisper oyó «Hola, ¿hay frutas?», se descarta y no se guarda nada", async ({ page }, info) => {
  test.skip(info.project.name !== "s25-412", "Una sola vez: cada corrida llama a Groq");
  await entrarComo(page, "duenio");
  const antes = await ultimoComando();
  const respuesta = await page.request.post("/api/voz", conPalabra("hola-frutas.wav"));
  expect(respuesta.status()).toBe(200);
  expect(await respuesta.json()).toEqual({ ignorado: "parecida" });
  // Nada de lo que se habla en el puesto queda en la base.
  const { data: guardados } = await baseLocal().from("comandos_voz").select("id").gt("id", antes).ilike("transcripcion", "%fruta%");
  expect(guardados).toEqual([]);
});

test("dos celulares que oyeron la misma venta abren una sola tarjeta (ADR-0022)", async ({ page }, info) => {
  test.skip(info.project.name !== "s25-412", "Una sola vez: cada corrida llama a Groq");
  test.slow();
  await entrarComo(page, "duenio");
  const antes = await ultimoComando();
  // Los dos celulares del puesto (aquí, la misma cuenta) envían a la vez lo que oyeron después de «Hola Fructus».
  const desde2 = (celular: string) => {
    const pedido = conPalabra("hola-fructus-venta.wav");
    return page.request.post("/api/voz", { ...pedido, multipart: { ...pedido.multipart, celular } });
  };
  const [a, b] = await Promise.all([desde2("celular-de-prueba-a"), desde2("celular-de-prueba-b")]);
  const cuerpos = [await a.json(), await b.json()];
  expect([a.status(), b.status()]).toEqual([200, 200]);
  // Uno abre su tarjeta y el otro dice que ya la anotó otro celular: un solo «confirmo» ya no guarda dos ventas.
  expect(cuerpos.filter((c) => c.tarjeta?.tipo === "venta")).toHaveLength(1);
  expect(cuerpos.filter((c) => c.ignorado === "otro_celular")).toHaveLength(1);
  const { data: comandos } = await baseLocal().from("comandos_voz").select("id").gt("id", antes).ilike("transcripcion", "%mango%");
  expect(comandos).toHaveLength(1);
});

test("el contador no puede dictar", async ({ page }) => {
  await entrarComo(page, "contador");
  const respuesta = await page.request.post("/api/voz", conAudio());
  expect(respuesta.status()).toBe(403);
});

test("sin sesión responde 401, no una pantalla de login", async ({ request }) => {
  const respuesta = await request.post("/api/voz", { ...conAudio(), maxRedirects: 0 });
  expect(respuesta.status()).toBe(401);
});

test("sin audio, con algo que no es audio o muy largo, dice qué pasó", async ({ page }) => {
  await entrarComo(page, "ayudante");
  expect((await page.request.post("/api/voz", { multipart: { nada: "x" } })).status()).toBe(400);
  expect((await page.request.post("/api/voz", conAudio(Buffer.from("hola"), "text/plain"))).status()).toBe(415);
  const largo = await page.request.post("/api/voz", { multipart: { audio: { name: "a.m4a", mimeType: "audio/mp4", buffer: audio }, duracion_ms: "61000" } });
  expect(largo.status()).toBe(413);
  expect((await largo.json()).error).toContain("menos de un minuto");
});
