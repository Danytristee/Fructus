import { expect, test, type Page } from "@playwright/test";

import { entrarComo } from "./cuentas";
import { callar, hablar, microfonoControlado } from "./manos-libres";

// Sin el dedo encima, callarse envía lo dicho (lib/voz/silencio-reglas.ts). El micrófono es un tono que la prueba prende («habla»)
// y apaga («se calla»), así se controla exactamente cuándo hay voz. /api/voz va simulado: se prueba la pantalla, no a Groq.

const tarjeta = {
  tipo: "venta",
  cliente: { dicho: "don lucho", elegido: { id: 1, nombre: "Luis Paredes" }, opciones: [] },
  items: [{ producto: { dicho: "mango", elegido: { id: 1, nombre: "Mango Kent" }, opciones: [] }, cantidad: 10, precio: { valor: 45, sugerido: false }, subtotal: 450 }],
  descuento: 0,
  total: 450,
  condicion: "credito",
  medio: null,
  comprobante: "ninguno",
  dudas: [],
  falta: [],
};

async function preparar(page: Page) {
  await microfonoControlado(page);
  await entrarComo(page, "duenio");
  let pedidos = 0;
  await page.route("/api/voz", (ruta) => {
    pedidos++;
    return ruta.fulfill({ status: 200, json: { comandoId: 41, tarjeta, latenciaMs: 900 } });
  });
  await page.waitForLoadState("networkidle");
  return () => pedidos;
}

async function tocarOrbe(page: Page) {
  const caja = (await page.locator("button[data-estado]").boundingBox())!;
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2, { delay: 60 });
}

test("un toque, se habla y al callarse se envía solo: la tarjeta llega sin el segundo toque", async ({ page }) => {
  test.slow(); // la primera vez compila la hoja
  await preparar(page);
  const orbe = page.locator("button[data-estado]");
  await tocarOrbe(page);
  await expect(orbe).toHaveAttribute("data-bloqueado", "true", { timeout: 10_000 });
  await expect(orbe).toHaveAttribute("data-estado", "escuchando");

  const pedido = page.waitForRequest((r) => r.url().endsWith("/api/voz"));
  await hablar(page);
  await page.waitForTimeout(1500);
  await callar(page);
  const enviado = await pedido;
  // Lo que viajó incluye lo dicho y el silencio que lo cerró (~1.2 s), no más.
  const duracion = Number(enviado.postDataBuffer()!.toString("latin1").match(/name="duracion_ms"\r\n\r\n(\d+)/)?.[1]);
  expect(duracion).toBeGreaterThanOrEqual(2500);
  expect(duracion).toBeLessThan(5000);
  await expect(page.getByRole("dialog", { name: "¿Así fue la venta?" })).toBeVisible({ timeout: 15_000 });
});

test("una pausa corta para pensar no envía, y si no se dijo nada tampoco", async ({ page }) => {
  const pedidos = await preparar(page);
  const orbe = page.locator("button[data-estado]");
  await tocarOrbe(page);
  await expect(orbe).toHaveAttribute("data-bloqueado", "true", { timeout: 10_000 });

  await page.waitForTimeout(2500); // todavía no habla: el silencio solo no envía
  await hablar(page);
  await page.waitForTimeout(800);
  await callar(page);
  await page.waitForTimeout(700); // «… a cuarenta y…»: piensa el precio
  await hablar(page);
  await page.waitForTimeout(800);
  await expect(orbe).toHaveAttribute("data-estado", "escuchando");
  expect(pedidos()).toBe(0);

  const pedido = page.waitForRequest((r) => r.url().endsWith("/api/voz"));
  await callar(page);
  await pedido;
});

test("mientras se mantiene el dedo, callarse no envía: manda el dedo", async ({ page }) => {
  const pedidos = await preparar(page);
  const orbe = page.locator("button[data-estado]");
  const caja = (await orbe.boundingBox())!;
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  await expect(orbe).toHaveAttribute("data-estado", "escuchando", { timeout: 10_000 });
  await hablar(page);
  await page.waitForTimeout(1000);
  await callar(page);
  await page.waitForTimeout(2500);
  await expect(orbe).toHaveAttribute("data-estado", "escuchando");
  expect(pedidos()).toBe(0);

  const pedido = page.waitForRequest((r) => r.url().endsWith("/api/voz"));
  await page.mouse.up();
  await pedido;
});

test("si la bulla nunca deja «callarse», a los 15 s de empezar a hablar se envía solo, no a los 55", async ({ page }) => {
  test.slow();
  const pedidos = await preparar(page);
  const orbe = page.locator("button[data-estado]");
  await tocarOrbe(page);
  await expect(orbe).toHaveAttribute("data-bloqueado", "true", { timeout: 10_000 });

  const pedido = page.waitForRequest((r) => r.url().endsWith("/api/voz"), { timeout: 25_000 });
  await hablar(page); // y no se calla nunca: el vecino pregona tan fuerte como la voz
  await page.waitForTimeout(12_000);
  expect(pedidos()).toBe(0); // una venta larga de 12 s no se corta
  const enviado = await pedido;
  const duracion = Number(enviado.postDataBuffer()!.toString("latin1").match(/name="duracion_ms"\r\n\r\n(\d+)/)?.[1]);
  expect(duracion).toBeGreaterThanOrEqual(15_000);
  expect(duracion).toBeLessThan(18_000);
  await expect(page.getByRole("dialog", { name: "¿Así fue la venta?" })).toBeVisible({ timeout: 15_000 });
});
