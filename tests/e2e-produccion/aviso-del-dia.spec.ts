import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";

import { baseLocal } from "../e2e/base";
import { entrarComo } from "../e2e/cuentas";

// El aviso del día con el service worker DE VERDAD (public/sw.js, compilado y registrado), que en desarrollo no existe.
// Tres pruebas:
//   1 y 2 · Sin red: el navegador entrega un aviso al service worker (el protocolo de depuración hace lo que haría el servicio de avisos
//           de Google) y se mira qué muestra. Corren siempre.
//   3     · De punta a punta con el servicio de avisos DE VERDAD (Google, Apple o Mozilla, según el navegador): activar desde el menú,
//           el servidor manda el aviso de prueba, el servicio de avisos lo entrega y el service worker lo muestra. Necesita internet y que
//           el navegador de la prueba tenga servicio de avisos: se pide con PUSH_REAL=1. Es la prueba que más se parece a un teléfono.
//           Lo que ninguna prueba ve: el aviso en la pantalla de bloqueo de un teléfono real (queda en la bitácora).

// El navegador «sin pantalla» liviano de Playwright (headless shell) siempre contesta «permiso denegado» a las notificaciones: se usa el
// Chromium completo, que sí deja darlas.
test.use({ channel: "chromium" });

type Mostrado = { title: string; body: string; tag: string; lang: string; data: unknown };

const mostrados = (page: Page) =>
  page.evaluate(async (): Promise<Mostrado[]> => {
    const registro = await navigator.serviceWorker.ready;
    return (await registro.getNotifications()).map((n) => ({ title: n.title, body: n.body, tag: n.tag, lang: n.lang, data: n.data }));
  });

/** Le entrega un aviso al service worker, como lo haría el servicio de avisos del navegador, y devuelve lo que se ve en pantalla. */
async function entregarAviso(page: Page, context: BrowserContext, contenido: string) {
  const cdp = await context.newCDPSession(page);
  const registros: string[] = [];
  cdp.on("ServiceWorker.workerRegistrationUpdated", (e) => registros.push(...e.registrations.map((r) => r.registrationId)));
  await cdp.send("ServiceWorker.enable");
  await expect.poll(() => registros.length, { timeout: 10_000 }).toBeGreaterThan(0);
  await cdp.send("ServiceWorker.deliverPushMessage", { origin: new URL(page.url()).origin, registrationId: registros[0]!, data: contenido });
}

async function conServiceWorkerActivo(page: Page, context: BrowserContext, origen: string) {
  await context.grantPermissions(["notifications"], { origin: origen });
  await entrarComo(page, "duenio");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  // Un service worker recién activado puede tardar en tomar el control de la pantalla (clients.claim): se espera.
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), { timeout: 15_000 }).toBe(true);
}

test("el service worker muestra el aviso que llega, con su título, su texto y a dónde lleva", async ({ page, context, baseURL }) => {
  await conServiceWorkerActivo(page, context, baseURL!);
  await entregarAviso(page, context, JSON.stringify({ titulo: "Vendiste S/ 1,250.00 hoy", cuerpo: "58 cajas en 9 ventas · Cobraste S/ 1,030.00", url: "/cierre", tag: "resumen-2026-11-09" }));

  await expect.poll(() => mostrados(page), { timeout: 10_000 }).toEqual([
    { title: "Vendiste S/ 1,250.00 hoy", body: "58 cajas en 9 ventas · Cobraste S/ 1,030.00", tag: "resumen-2026-11-09", lang: "es-PE", data: { url: "/cierre" } },
  ]);
});

test("si el aviso llega ilegible, muestra el aviso genérico (Chrome exige mostrar algo)", async ({ page, context, baseURL }) => {
  await conServiceWorkerActivo(page, context, baseURL!);
  await entregarAviso(page, context, "esto no es JSON");
  await expect.poll(() => mostrados(page), { timeout: 10_000 }).toEqual([
    { title: "Tu día en Fructus", body: "Toca para ver cómo va el cierre del día.", tag: "resumen", lang: "es-PE", data: { url: "/cierre" } },
  ]);
});

test("de punta a punta con el servicio de avisos de verdad: se activa desde el menú y el aviso de prueba llega y se muestra", async ({ baseURL }) => {
  test.skip(!process.env.PUSH_REAL, "Necesita internet y el servicio de avisos del navegador: se corre con PUSH_REAL=1");
  test.setTimeout(120_000);

  // Chrome no deja usar los avisos en una ventana de incógnito, y las pruebas de Playwright lo son: aquí va un perfil normal, aparte.
  const perfil = mkdtempSync(join(tmpdir(), "fructus-avisos-"));
  const contexto = await chromium.launchPersistentContext(perfil, { channel: "chromium", headless: true, baseURL: baseURL!, locale: "es-PE", timezoneId: "America/Lima", viewport: { width: 412, height: 915 } });
  try {
    const page = contexto.pages()[0] ?? (await contexto.newPage());
    await conServiceWorkerActivo(page, contexto, baseURL!);
    await page.getByRole("button", { name: /Menú/ }).click();
    const hoja = page.getByRole("dialog", { name: "Más" });
    const fila = hoja.getByRole("switch", { name: /Aviso del día/ });
    await expect(fila).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });

    await fila.click();
    await expect(fila).toHaveAttribute("aria-checked", "true", { timeout: 45_000 });

    // El aviso de prueba salió del servidor, pasó por el servicio de avisos de verdad y el service worker lo mostró.
    await expect
      .poll(async () => (await mostrados(page)).map((m) => m.title), { timeout: 45_000 })
      .toContain("Listo: el aviso del día está activado");

    // Y apagarlo deja el teléfono y la base sin esa suscripción activa.
    const endpoint = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).pushManager.getSubscription())?.endpoint);
    expect(endpoint).toBeTruthy();
    await fila.click();
    await expect(fila).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });
    const base = baseLocal();
    const { data } = await base.from("suscripciones_push").select("activa").eq("endpoint", endpoint!).single();
    expect(data?.activa).toBe(false);
    await base.from("suscripciones_push").delete().eq("endpoint", endpoint!); // dato de prueba de la base local
  } finally {
    await contexto.close();
    rmSync(perfil, { recursive: true, force: true });
  }
});
