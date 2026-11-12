import { expect, test, type Page } from "@playwright/test";

import { entrarComo } from "./cuentas";

// El botón de voz con un micrófono falso (playwright.config.ts) y /api/voz simulado: se prueba la pantalla, no a Groq.
// voz-api.spec.ts prueba el servidor con Groq real.

const tarjetaVenta = {
  tipo: "venta",
  cliente: { dicho: "don lucho", elegido: { id: 1, nombre: "Luis Paredes" }, opciones: [] },
  items: [{ producto: { dicho: "mango", elegido: { id: 1, nombre: "Mango Kent" }, opciones: [] }, cantidad: 10, precio: { valor: 45, sugerido: true }, subtotal: 450 }],
  descuento: 0,
  total: 450,
  condicion: null,
  medio: null,
  comprobante: "ninguno",
  dudas: [],
  falta: ["condicion"],
};

/** Responde /api/voz con las respuestas dadas, una por llamada (la última se repite). */
async function simularVoz(page: Page, ...respuestas: { status: number; body: unknown }[]) {
  let n = 0;
  await page.route("/api/voz", (ruta) => {
    const r = respuestas[Math.min(n++, respuestas.length - 1)]!;
    return ruta.fulfill({ status: r.status, json: r.body });
  });
}

/** El aviso del botón de voz (Next también usa role="alert" para anunciar el cambio de ruta). */
const avisoVoz = (page: Page) => page.getByRole("alert").filter({ has: page.getByRole("button", { name: /Borrar el audio|Cerrar el aviso/ }) });

/** Mantiene el orbe apretado el tiempo dado y lo suelta. */
async function dictar(page: Page, ms = 1200) {
  await page.waitForLoadState("networkidle"); // que React monte el botón antes de presionarlo
  const caja = (await page.getByRole("button", { name: "Botón de voz" }).boundingBox())!;
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  // Un toque corto se suelta enseguida; uno largo se cuenta desde que el micrófono graba («Te escucho»), no desde el toque.
  if (ms >= 600) await expect(page.locator("button[data-estado]")).toHaveAttribute("data-estado", "escuchando", { timeout: 10_000 });
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test("el botón de voz vive abajo al centro, mide 96 px o más, graba al mantenerlo y abre la tarjeta al soltar", async ({ page }) => {
  test.slow(); // la primera vez compila «Hoy» y la hoja
  await entrarComo(page, "duenio");
  await simularVoz(page, { status: 200, body: { comandoId: 1, tarjeta: tarjetaVenta, latenciaMs: 900 } });
  const voz = page.getByRole("button", { name: "Botón de voz" });
  await expect(voz).toBeVisible();

  const caja = (await voz.boundingBox())!;
  const pantalla = page.viewportSize()!;
  expect(caja.width).toBeGreaterThanOrEqual(96);
  expect(Math.abs(caja.x + caja.width / 2 - pantalla.width / 2)).toBeLessThanOrEqual(2); // al centro
  expect(caja.y).toBeGreaterThan((pantalla.height * 2) / 3 - caja.height); // en el tercio de abajo

  const pedido = page.waitForRequest((r) => r.url().endsWith("/api/voz"));
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  await expect(voz).toHaveAttribute("data-estado", "escuchando", { timeout: 10_000 });
  await expect(page.locator("#voz-texto")).toContainText("Te escucho");
  await page.waitForTimeout(1200);
  await page.mouse.up();

  // Lo que viaja: un audio de verdad, con su duración (se cuenta desde que el micrófono arrancó, no desde el toque).
  const enviado = await pedido;
  expect(enviado.headers()["content-type"]).toContain("multipart/form-data");
  expect(Number(enviado.postDataBuffer()!.toString("latin1").match(/name="duracion_ms"\r\n\r\n(\d+)/)?.[1])).toBeGreaterThanOrEqual(600);

  const hoja = page.getByRole("dialog", { name: "¿Así fue la venta?" });
  await expect(hoja).toBeVisible();
  await expect(hoja.getByText("Luis Paredes")).toBeVisible();
  await expect(hoja.getByText("10 cajas de Mango Kent")).toBeVisible();
  await expect(hoja.getByText("sugerido")).toBeVisible();
  await expect(hoja.getByText("S/ 450.00")).toBeVisible();
  // Con la hoja abierta el resto queda oculto para el lector de pantalla: el orbe se busca por su estado.
  await expect(page.locator("button[data-estado]")).toHaveAttribute("data-estado", "listo");
});

/** Un toque corto en el orbe (menos de TOQUE_MAXIMO_MS). */
async function tocarOrbe(page: Page) {
  const caja = (await page.locator("button[data-estado]").boundingBox())!;
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2, { delay: 60 });
}

test("un toque deja el botón escuchando sin el dedo, y otro toque envía", async ({ page }) => {
  test.slow(); // la primera vez compila la hoja
  await entrarComo(page, "duenio");
  await simularVoz(page, { status: 200, body: { comandoId: 4, tarjeta: tarjetaVenta, latenciaMs: 900 } });
  await page.waitForLoadState("networkidle");
  const orbe = page.locator("button[data-estado]");
  await tocarOrbe(page);
  await expect(orbe).toHaveAttribute("data-estado", "escuchando", { timeout: 10_000 });
  await expect(orbe).toHaveAttribute("data-bloqueado", "true");
  await expect(page.locator("#voz-texto")).toContainText("toca para enviar");
  await expect(page.getByRole("button", { name: "Cancelar sin enviar" })).toBeVisible();

  const pedido = page.waitForRequest((r) => r.url().endsWith("/api/voz"));
  await page.waitForTimeout(1500); // sigue escuchando sin el dedo encima
  await expect(orbe).toHaveAttribute("data-estado", "escuchando");
  await tocarOrbe(page);
  const enviado = await pedido;
  expect(Number(enviado.postDataBuffer()!.toString("latin1").match(/name="duracion_ms"\r\n\r\n(\d+)/)?.[1])).toBeGreaterThanOrEqual(1400);
  await expect(page.getByRole("dialog", { name: "¿Así fue la venta?" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Cancelar sin enviar" })).toHaveCount(0);
});

test("escuchando sin el dedo, la X descarta sin enviar nada", async ({ page }) => {
  await entrarComo(page, "duenio");
  let llamadas = 0;
  await page.route("/api/voz", (r) => (llamadas++, r.abort()));
  await page.waitForLoadState("networkidle");
  const orbe = page.locator("button[data-estado]");
  await tocarOrbe(page);
  await expect(orbe).toHaveAttribute("data-estado", "escuchando", { timeout: 10_000 });
  await page.getByRole("button", { name: "Cancelar sin enviar" }).click();
  await expect(orbe).toHaveAttribute("data-estado", "listo");
  await expect(orbe).not.toHaveAttribute("data-bloqueado", "true");
  await expect(page.locator("#voz-texto")).toHaveText("Cancelado. No se envió nada.");
  await page.waitForTimeout(500);
  expect(llamadas).toBe(0);
});

/** Mantiene el orbe y, ya escuchando, sube el dedo los píxeles dados (sin soltarlo). */
async function mantenerYSubir(page: Page, px: number) {
  await page.waitForLoadState("networkidle");
  const caja = (await page.locator("button[data-estado]").boundingBox())!;
  const x = caja.x + caja.width / 2;
  const y = caja.y + caja.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect(page.locator("button[data-estado]")).toHaveAttribute("data-estado", "escuchando", { timeout: 10_000 });
  await expect(page.locator("[data-candado]")).toBeVisible();
  await page.waitForTimeout(700);
  await page.mouse.move(x, y - px, { steps: 8 });
}

test("mientras se mantiene, subir el dedo hasta el candado lo deja escuchando sin el dedo", async ({ page }) => {
  test.slow(); // la primera vez compila la hoja
  await entrarComo(page, "duenio");
  await simularVoz(page, { status: 200, body: { comandoId: 5, tarjeta: tarjetaVenta, latenciaMs: 900 } });
  let llamadas = 0;
  page.on("request", (r) => r.url().endsWith("/api/voz") && llamadas++);
  const orbe = page.locator("button[data-estado]");

  await mantenerYSubir(page, 120);
  await expect(orbe).toHaveAttribute("data-bloqueado", "true");
  await expect(page.locator("[data-candado]")).toHaveCount(0);
  await page.mouse.up();
  // Soltar ya no envía: sigue escuchando hasta el siguiente toque.
  await page.waitForTimeout(1000);
  await expect(orbe).toHaveAttribute("data-estado", "escuchando");
  await expect(page.locator("#voz-texto")).toContainText("toca para enviar");
  expect(llamadas).toBe(0);

  await tocarOrbe(page);
  await expect(page.getByRole("dialog", { name: "¿Así fue la venta?" })).toBeVisible({ timeout: 15_000 });
  expect(llamadas).toBe(1);
});

test("subir el dedo solo un poco y soltar envía, como mantener", async ({ page }) => {
  test.slow();
  await entrarComo(page, "duenio");
  await simularVoz(page, { status: 200, body: { comandoId: 6, tarjeta: tarjetaVenta, latenciaMs: 900 } });
  await mantenerYSubir(page, 40);
  await expect(page.locator("button[data-estado]")).not.toHaveAttribute("data-bloqueado", "true");
  await page.mouse.up();
  await expect(page.getByRole("dialog", { name: "¿Así fue la venta?" })).toBeVisible({ timeout: 15_000 });
});

test("mantener un instante sin alcanzar a hablar no envía nada y dice por qué", async ({ page }) => {
  await entrarComo(page, "duenio");
  let llamadas = 0;
  await page.route("/api/voz", (r) => (llamadas++, r.abort()));
  await dictar(page, 400); // más que un toque, menos que lo mínimo para entender algo
  await expect(page.locator("#voz-texto")).toHaveText("No alcancé a oírte. Habla después de «Te escucho».");
  expect(llamadas).toBe(0);
});

test("si el servicio falla, dice qué hacer y el audio guardado se reintenta con un toque, también tras recargar", async ({ page }) => {
  await entrarComo(page, "duenio");
  await simularVoz(
    page,
    { status: 502, body: { error: "No te entendí, inténtalo otra vez.", conservarAudio: true } },
    { status: 200, body: { comandoId: 2, tarjeta: tarjetaVenta, latenciaMs: 900 } },
  );
  await dictar(page);
  const aviso = page.getByRole("alert").filter({ hasText: "No te entendí" });
  await expect(aviso).toBeVisible();

  // Se recarga la página: el audio sigue guardado en el celular.
  await page.reload();
  await expect(page.getByRole("alert").filter({ hasText: "Tienes un audio que no se pudo enviar" })).toBeVisible();
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByRole("dialog", { name: "¿Así fue la venta?" })).toBeVisible();

  // Enviado, ya no queda pendiente.
  await page.reload();
  await expect(page.getByText("Cobraste")).toBeVisible();
  await expect(avisoVoz(page)).toHaveCount(0);
});

test("sin señal no intenta enviar: lo dice y guarda el audio", async ({ page, context }) => {
  await entrarComo(page, "duenio");
  let llamadas = 0;
  await page.route("/api/voz", (r) => (llamadas++, r.abort()));
  await context.setOffline(true);
  await dictar(page);
  await expect(page.getByRole("alert").filter({ hasText: "Sin señal" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  expect(llamadas).toBe(0);
  // La X borra el audio guardado.
  await page.getByRole("button", { name: "Borrar el audio guardado" }).click();
  await expect(avisoVoz(page)).toHaveCount(0);
  await context.setOffline(false);
});

test("si no entendió nada, lo pide otra vez sin guardar el audio", async ({ page }) => {
  await entrarComo(page, "duenio");
  await simularVoz(page, { status: 200, body: { comandoId: 3, tarjeta: { tipo: "no_entendido", mensaje: "x" }, latenciaMs: 700 } });
  await dictar(page);
  await expect(page.getByRole("alert").filter({ hasText: "No te entendí" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toHaveCount(0);
});

test("la etiqueta enseña la primera vez y, después de usarlo, deja de tapar «Lo último»", async ({ page }) => {
  await entrarComo(page, "duenio");
  const etiqueta = page.locator("#voz-texto");
  await expect(etiqueta).toHaveText("Toca o mantén para hablar");
  await expect(etiqueta).toHaveCSS("opacity", "1");

  await dictar(page, 400);
  await expect(etiqueta).toHaveText("No alcancé a oírte. Habla después de «Te escucho».");

  await page.reload();
  await expect(page.getByText("Cobraste")).toBeVisible();
  await expect(etiqueta).toHaveCSS("opacity", "0");
  // Oculta a la vista, el lector de pantalla la sigue teniendo.
  await expect(etiqueta).toHaveText("Toca o mantén para hablar");

  // Al bajar hasta el final, la última fila de «Lo último» queda por encima del orbe.
  const voz = page.getByRole("button", { name: "Botón de voz" });
  await page.getByTestId("lo-ultimo").getByRole("listitem").last().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const ultima = (await page.getByTestId("lo-ultimo").getByRole("listitem").last().boundingBox())!;
  const orbe = (await voz.boundingBox())!;
  expect(ultima.y + ultima.height).toBeLessThanOrEqual(orbe.y);
});

test("con la etiqueta visible, «Clientes» y «Stock» de la barra se pueden tocar", async ({ page }) => {
  await entrarComo(page, "duenio");
  await expect(page.locator("#voz-texto")).toHaveCSS("opacity", "1");
  const barra = page.getByRole("navigation", { name: "Principal" });
  await barra.getByRole("link", { name: "Clientes" }).click({ timeout: 5_000 });
  await expect(page).toHaveURL("/clientes");
  await page.goto("/");
  await barra.getByRole("link", { name: "Stock" }).click({ timeout: 5_000 });
  await expect(page).toHaveURL("/stock");
});
