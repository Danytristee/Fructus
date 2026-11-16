import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { entrarComo } from "./cuentas";

// POST /api/voz/respuesta de punta a punta con Whisper y el intérprete reales (necesita GROQ_API_KEY en .env.local): la respuesta corta
// después de oír la lectura (ADR-0020). Los audios son sintéticos (la voz «Paulina» del Mac). No guarda nada: solo dice qué entendió.
const audio = (id: string) => readFileSync(`tests/e2e/audios/respuesta-${id}.m4a`);
const LECTURA = "10 cajas de Mango Kent, a 45 la caja, para Luis Paredes. Total, 450 soles. Lo debe. ¿Confirmo?";
const enviar = (id: string, extra: Record<string, string> = {}) => ({
  multipart: { audio: { name: "respuesta.m4a", mimeType: "audio/mp4", buffer: audio(id) }, duracion_ms: "1500", ...extra },
  timeout: 30_000,
});

test.describe.configure({ mode: "serial" });

test.describe("con Groq real", () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== "s25-412", "Una sola vez: cada corrida llama a Groq");
    await entrarComo(page, "duenio");
  });

  test("«confirmo» confirma y un «sí» suelto no", async ({ page }) => {
    expect(await (await page.request.post("/api/voz/respuesta", enviar("confirmo", { lectura: LECTURA }))).json()).toEqual({ respuesta: "confirmar" });
    expect(await (await page.request.post("/api/voz/respuesta", enviar("si", { lectura: LECTURA }))).json()).toEqual({ respuesta: "otra" });
  });

  test("«no, son ocho cajas» vuelve la venta corregida, con los nombres de la base", async ({ page }) => {
    const r = await page.request.post("/api/voz/respuesta", enviar("ocho-cajas", { lectura: LECTURA }));
    expect(r.status()).toBe(200);
    const { respuesta, tarjeta } = await r.json();
    expect(respuesta).toBe("corregir");
    // Lo que corrigió el intérprete: las cajas cambian y lo demás queda como se leyó.
    expect(tarjeta).toMatchObject({ tipo: "venta", condicion: "credito" });
    // El cliente se conserva al corregir. Elegirlo en la base es otra cosa: si el modelo lo escribe distinto y el parecido baja, la
    // tarjeta ofrece opciones y pide el toque (no guarda nada mal). Pasó 1 de cada 8 corridas.
    expect(tarjeta.cliente.dicho.toLowerCase()).toContain("luis");
    expect(tarjeta.items).toHaveLength(1);
    expect(tarjeta.items[0]).toMatchObject({ cantidad: 8, precio: { valor: 45, sugerido: false } });
    // La fruta se busca en la base como en un dictado. Con el catálogo real cargado, el Mango Kent del seed está inactivo y queda
    // para elegir: por eso aquí se mira lo que se dijo, no lo que se eligió.
    expect(tarjeta.items[0].producto.dicho.toLowerCase()).toContain("mango kent");
  });

  test("a «¿Pagó o lo debe?», «lo debe» es crédito", async ({ page }) => {
    const r = await page.request.post("/api/voz/respuesta", enviar("lo-debe", { pregunta: "pago" }));
    expect(await r.json()).toEqual({ pago: { condicion: "credito", medio: null } });
  });
});

test("el contador no puede confirmar hablando", async ({ page }) => {
  await entrarComo(page, "contador");
  expect((await page.request.post("/api/voz/respuesta", enviar("confirmo"))).status()).toBe(403);
});

test("sin sesión responde 401", async ({ request }) => {
  expect((await request.post("/api/voz/respuesta", { ...enviar("confirmo"), maxRedirects: 0 })).status()).toBe(401);
});
