import { expect, test, type Page } from "@playwright/test";

import { entrarComo } from "../e2e/cuentas";

// El service worker (public/sw.js) con la app compilada: sin señal, abrir una pantalla muestra la página «Sin conexión» de la app, no la del
// navegador. Y no guarda nada más: ninguna pantalla ni dato viejo se muestra como si fuera de ahora.

async function conServiceWorkerActivo(page: Page) {
  await entrarComo(page, "duenio");
  // Se registra después de que la pantalla carga y toma el control solo (clients.claim).
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20_000 });
}

test("el service worker se registra, toma el control y guarda solo la página sin conexión", async ({ page }) => {
  await conServiceWorkerActivo(page);
  const { alcance, caches: claves, guardado } = await page.evaluate(async () => {
    const registro = await navigator.serviceWorker.getRegistration();
    const nombres = await caches.keys();
    const rutas: string[] = [];
    for (const nombre of nombres) rutas.push(...(await (await caches.open(nombre)).keys()).map((r) => new URL(r.url).pathname));
    return { alcance: new URL(registro?.scope ?? "").pathname, caches: nombres, guardado: rutas.sort() };
  });
  expect(alcance).toBe("/");
  expect(claves).toEqual(["fructus-v1"]);
  // Nada de pantallas ni de datos: solo lo que hace falta para decir «sin conexión».
  expect(guardado).toEqual(["/icons/icon-192.png", "/sin-conexion.html"]);
});

test("/sw.js se sirve como JavaScript y sin caché, para que un cambio llegue a los teléfonos", async ({ request }) => {
  const r = await request.get("/sw.js");
  expect(r.status(), "sin sesión no puede redirigir al login").toBe(200);
  expect(r.headers()["content-type"]).toContain("javascript");
  expect(r.headers()["cache-control"]).toContain("no-cache");
  expect(r.headers()["service-worker-allowed"]).toBe("/");
});

test("sin señal, abrir una pantalla muestra «Sin conexión» (no la del navegador); «Reintentar» sin señal lo vuelve a decir, sin romperse", async ({ page, context }) => {
  await conServiceWorkerActivo(page);

  await context.setOffline(true);
  await page.goto("/clientes");
  await expect(page.getByRole("heading", { name: "Sin conexión" })).toBeVisible();
  await expect(page.getByText("Lo que ya registraste está guardado")).toBeVisible();
  const boton = page.getByRole("button", { name: "Reintentar" });
  expect((await boton.boundingBox())!.height, "botón grande, de 48 px o más").toBeGreaterThanOrEqual(48);
  // No se mostró ninguna pantalla vieja: la página de «Clientes» no está.
  await expect(page.getByRole("heading", { level: 1, name: "Clientes" })).toHaveCount(0);
  // Y lo que no es abrir una pantalla sigue directo a la red: una consulta sin señal falla, no devuelve algo guardado.
  expect(await page.evaluate(() => fetch("/api/salud").then(() => "respondió", () => "falló"))).toBe("falló");

  // Tocar «Reintentar» sin señal: la página se vuelve a pedir y el service worker la vuelve a servir.
  await boton.click();
  await expect(page.getByRole("heading", { name: "Sin conexión" })).toBeVisible();
  expect(page.url()).toContain("/clientes");
});

test("la página sin conexión se abre sola cuando el teléfono avisa que volvió la señal", async ({ page, context }) => {
  await conServiceWorkerActivo(page);
  await context.setOffline(true);
  await page.goto("/stock");
  await expect(page.getByRole("heading", { name: "Sin conexión" })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByRole("heading", { level: 1, name: "Stock" })).toBeVisible({ timeout: 15_000 });
});

test("la página sin conexión cabe en el celular: sin desborde, sin ampliar, con el texto en 15 px o más", async ({ page }) => {
  await page.goto("/sin-conexion.html");
  const medidas = await page.evaluate(() => ({
    desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    letras: [...document.querySelectorAll("h1, p, button")].map((e) => parseFloat(getComputedStyle(e).fontSize)),
    viewport: document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "",
  }));
  expect(medidas.desborde).toBeLessThanOrEqual(0);
  for (const px of medidas.letras) expect(px).toBeGreaterThanOrEqual(15);
  expect(medidas.viewport).toContain("user-scalable=no");
});
