import { expect, test, type CDPSession, type Page } from "@playwright/test";

import { entrarComo } from "./cuentas";

// La hoja se porta como la de un celular: sigue al dedo, se va si se la desliza hacia abajo, vuelve si se la suelta a medio camino, y
// «atrás» la cierra sin salir de la pantalla. Los toques son reales (CDP Input.dispatchTouchEvent), no eventos armados a mano.

let cdp: CDPSession;

test.beforeEach(async ({ page }) => {
  await entrarComo(page, "duenio");
  cdp = await page.context().newCDPSession(page);
  // Se llega a Clientes desde «Hoy», como la persona: así hay un módulo anterior adonde «atrás» podría llevar por error.
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Clientes" }).click();
  await expect(page).toHaveURL("/clientes");
  await expect(page.getByRole("heading", { level: 1, name: "Clientes" })).toBeVisible();
});

async function abrirMenu(page: Page) {
  await page.getByRole("button", { name: /^Menú/ }).click();
  const hoja = page.getByRole("dialog", { name: "Más" });
  await expect(hoja).toBeVisible();
  await quieta(page);
  return hoja;
}

/** Que no quede nada animándose (la subida de la hoja, el velo) antes de tocar o de medir. */
async function quieta(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
  );
}

async function atras(page: Page) {
  await page.evaluate(() => history.back());
  await page.waitForTimeout(400);
}

/** Pone el dedo, lo mueve `dy` píxeles en `pasos` (cada 16 ms, como un dedo de verdad) y, si se pide, lo levanta. */
async function deslizar(page: Page, desde: { x: number; y: number }, dy: number, { pasos = 12, soltar = true, cadaMs = 16 } = {}) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [desde] });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: desde.x, y: desde.y + (dy * i) / pasos }] });
    if (cadaMs) await page.waitForTimeout(cadaMs);
  }
  if (soltar) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function manija(page: Page) {
  const caja = (await page.getByRole("dialog", { name: "Más" }).locator("[data-asa]").boundingBox())!;
  return { x: caja.x + caja.width / 2, y: caja.y + 12 };
}

const corrimiento = (page: Page) =>
  page.getByRole("dialog", { name: "Más" }).evaluate((h) => parseFloat(getComputedStyle(h).translate.split(" ")[1] ?? "0") || 0);

test("«atrás» cierra la hoja y se queda en la pantalla; el siguiente «atrás» va al módulo anterior", async ({ page }) => {
  await abrirMenu(page);
  await atras(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL("/clientes");

  await atras(page);
  await expect(page).toHaveURL("/");
});

test("cerrarla con Escape quita su página: «atrás» no se gasta en una hoja que ya no está", async ({ page }) => {
  await abrirMenu(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.waitForTimeout(300);

  await atras(page);
  await expect(page).toHaveURL("/");
});

test("la hoja sigue al dedo y, si se la suelta a medio camino, vuelve a su sitio", async ({ page }) => {
  await abrirMenu(page);
  await deslizar(page, await manija(page), 70, { soltar: false });
  // Mientras el dedo está abajo, la hoja bajó lo mismo que el dedo (en la captura se ve el velo aclarándose).
  expect(await corrimiento(page)).toBeCloseTo(70, -1);
  await page.screenshot({ path: test.info().outputPath("hoja-a-medio-camino.png") });

  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => corrimiento(page)).toBe(0);
  await expect(page.getByRole("dialog", { name: "Más" })).toBeVisible();
  // Arrastrar desde la manija no toca nada de la hoja.
  await expect(page).toHaveURL("/clientes");
});

test("deslizarla hacia abajo la cierra, y «atrás» después lleva al módulo anterior", async ({ page }) => {
  await abrirMenu(page);
  await deslizar(page, await manija(page), 360);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL("/clientes");
  await page.waitForTimeout(300);

  await atras(page);
  await expect(page).toHaveURL("/");
});

test("un tirón rápido la cierra aunque baje poco", async ({ page }) => {
  await abrirMenu(page);
  await deslizar(page, await manija(page), 90, { pasos: 4, cadaMs: 0 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("hacia arriba se estira poco, con resistencia, y vuelve", async ({ page }) => {
  await abrirMenu(page);
  await deslizar(page, await manija(page), -160, { soltar: false });
  const arriba = await corrimiento(page);
  expect(arriba).toBeLessThan(0);
  expect(arriba).toBeGreaterThan(-90);

  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => corrimiento(page)).toBe(0);
  await expect(page.getByRole("dialog", { name: "Más" })).toBeVisible();
});

test("un enlace dentro de la hoja navega, y «atrás» vuelve a donde estaba, sin hoja", async ({ page }) => {
  const hoja = await abrirMenu(page);
  await hoja.getByRole("link", { name: "Proveedores" }).click();
  await expect(page).toHaveURL("/proveedores");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await atras(page);
  await expect(page).toHaveURL("/clientes");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await atras(page);
  await expect(page).toHaveURL("/");
});

test.describe("en un celular bajito, con una hoja que no entra entera", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("si el contenido está deslizado, el dedo lo desliza a él; al llegar arriba, el mismo dedo baja la hoja", async ({ page }) => {
    const hoja = await abrirMenu(page);
    const maximo = await hoja.evaluate((h) => h.scrollHeight - h.clientHeight);
    expect(maximo).toBeGreaterThan(100);
    await hoja.evaluate((h) => (h.scrollTop = h.scrollHeight));
    const caja = (await hoja.getByRole("link", { name: "Ajustes" }).boundingBox())!;
    const punto = { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };

    // Menos de lo que falta para llegar arriba: se desliza el contenido, la hoja no se mueve.
    await deslizar(page, punto, Math.floor(maximo / 2), { soltar: false });
    expect(await corrimiento(page)).toBe(0);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => hoja.evaluate((h) => h.scrollTop)).toBeLessThan(maximo);
    await expect(hoja).toBeVisible();
    // Y el arrastre no tocó el enlace de abajo del dedo.
    await expect(page).toHaveURL("/clientes");

    // Un gesto largo: primero termina de subir el contenido y, sin levantar el dedo, sigue bajando la hoja hasta cerrarla.
    await deslizar(page, punto, maximo + 360, { pasos: 20 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL("/clientes");
  });
});
