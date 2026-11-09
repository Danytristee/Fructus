import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { avisoDeActivacion } from "../../lib/push-reglas";
import { descifrar, telefonoDePrueba, type TelefonoDePrueba } from "../ayudas/push-de-prueba";
import { baseLocal } from "./base";
import { cuentas, entrarComo, type Rol } from "./cuentas";
import { quieto } from "./medir";

// «Aviso del día» en el menú «Más»: activarlo, apagarlo y lo que se dice cuando el teléfono no puede.
// Playwright no tiene un teléfono con servicio de avisos, así que el navegador se simula (permiso, service worker y suscripción de
// mentira, con las claves de un teléfono de verdad). Lo demás es real: la acción del servidor, la tabla de suscripciones y el aviso de
// prueba, que sale cifrado hacia el servicio de avisos de mentira (tests/e2e/push-simulado.mjs) y se descifra aquí.
// Lo que NO se prueba aquí: que Chrome o Safari muestren el aviso. Eso solo se ve en un teléfono (queda en la bitácora).

const base = baseLocal();
const SERVICIO_DE_AVISOS = `http://127.0.0.1:${Number(process.env.PUERTO ?? "3000") + 300}`;
const PREFIJO = "e2e-menu";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

let contador = 0;
/** Un teléfono con una dirección propia de esta prueba: cada prueba y cada ancho usan la suya, porque corren a la vez. */
function telefonoPropio(info: TestInfo) {
  return telefonoDePrueba(`https://fcm.googleapis.com/fcm/send/${PREFIJO}-${info.project.name}-${Date.now()}-${++contador}`);
}

type Preparacion = { permiso: "default" | "granted" | "denied"; alPedirPermiso: "granted" | "denied" | "default"; suscripcion: TelefonoDePrueba["suscripcion"] };

/** Un navegador de mentira: permiso, service worker y suscripción. `window.__avisos` cuenta lo que la app le pidió. */
async function simularNavegador(page: Page, preparacion: Preparacion) {
  await page.addInitScript((p: Preparacion) => {
    const estado = { permiso: p.permiso, pidioPermiso: 0, subscribe: 0, unsubscribe: 0, suscripcion: null as unknown, opciones: null as unknown };
    (window as unknown as { __avisos: typeof estado }).__avisos = estado;

    class Notificacion {
      static get permission() {
        return estado.permiso;
      }
      static async requestPermission() {
        estado.pidioPermiso++;
        if (estado.permiso === "default") estado.permiso = p.alPedirPermiso;
        return estado.permiso;
      }
    }
    Object.defineProperty(window, "Notification", { value: Notificacion, configurable: true });

    const nueva = (clave: Uint8Array) => ({
      endpoint: p.suscripcion.endpoint,
      options: { applicationServerKey: clave.buffer },
      toJSON: () => p.suscripcion,
      unsubscribe: async () => {
        estado.unsubscribe++;
        estado.suscripcion = null;
        return true;
      },
    });
    const registro = {
      active: {},
      pushManager: {
        getSubscription: async () => estado.suscripcion,
        subscribe: async (opciones: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) => {
          estado.subscribe++;
          estado.opciones = { userVisibleOnly: opciones.userVisibleOnly, largoDeLaClave: opciones.applicationServerKey.length };
          estado.suscripcion = nueva(opciones.applicationServerKey);
          return estado.suscripcion;
        },
      },
    };
    Object.defineProperty(navigator, "serviceWorker", { value: { getRegistration: async () => registro, ready: Promise.resolve(registro), register: async () => registro }, configurable: true });
  }, preparacion);
}

const lo = (page: Page) =>
  page.evaluate(() => {
    const e = (window as unknown as { __avisos: { permiso: string; pidioPermiso: number; subscribe: number; unsubscribe: number; suscripcion: unknown; opciones: unknown } }).__avisos;
    return { permiso: e.permiso, pidioPermiso: e.pidioPermiso, subscribe: e.subscribe, unsubscribe: e.unsubscribe, haySuscripcion: e.suscripcion !== null, opciones: e.opciones };
  });

async function abrirMenu(page: Page, rol: Rol = "duenio") {
  await entrarComo(page, rol);
  await page.waitForLoadState("networkidle"); // que React termine de montar el menú
  await page.getByRole("button", { name: /Menú/ }).click();
  const hoja = page.getByRole("dialog", { name: "Más" });
  await expect(hoja).toBeVisible();
  return hoja;
}

const filaDe = (hoja: ReturnType<Page["getByRole"]>) => hoja.getByRole("switch", { name: /Aviso del día/ });

const filaEnLaBase = async (t: TelefonoDePrueba) =>
  (await base.from("suscripciones_push").select("usuario_id, activa, desactivada_en, ultimo_aviso_en, ultimo_error, clave_p256dh, clave_auth").eq("endpoint", t.destino.endpoint).maybeSingle()).data;

type Recibido = { endpoint: string; topic?: string; ttl?: string; cuerpo: string };
const recibidosPor = async (t: TelefonoDePrueba): Promise<Recibido[]> =>
  ((await (await fetch(`${SERVICIO_DE_AVISOS}/recibidos`)).json()) as Recibido[]).filter((r) => r.endpoint === t.destino.endpoint);

test.afterAll(async () => {
  await base.from("suscripciones_push").delete().like("endpoint", `%${PREFIJO}%`); // datos de prueba de la base local
});

test("se activa con un toque: pide el permiso, suscribe el teléfono, lo guarda en la base y manda un aviso de prueba que el teléfono puede leer", async ({ page }, info) => {
  const t = telefonoPropio(info);
  await simularNavegador(page, { permiso: "default", alPedirPermiso: "granted", suscripcion: t.suscripcion });
  const hoja = await abrirMenu(page);

  const fila = filaDe(hoja);
  await expect(fila).toBeVisible();
  await expect(fila).toHaveAttribute("aria-checked", "false");
  await expect(fila).toContainText("Lo vendido y lo que te deben, como a las 7 p. m.");

  await fila.click();
  await expect(fila).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
  await expect(fila).toContainText("Activado, como a las 7 p. m.");
  await expect(hoja.getByRole("status").filter({ hasText: "Aviso activado" })).toContainText("Te mandamos uno de prueba");

  // Lo que le pidió al navegador: el permiso una vez, y una suscripción visible con la clave pública del servidor (65 bytes).
  expect(await lo(page)).toMatchObject({ pidioPermiso: 1, subscribe: 1, haySuscripcion: true, opciones: { userVisibleOnly: true, largoDeLaClave: 65 } });

  // Lo que quedó en la base: el teléfono de quien lo pidió, activo, con el aviso de prueba ya anotado como enviado.
  const { data: cuentasDeLaBase } = await base.auth.admin.listUsers();
  const duenio = cuentasDeLaBase.users.find((u) => u.email === cuentas.duenio)!.id;
  const guardada = await filaEnLaBase(t);
  expect(guardada).toMatchObject({ usuario_id: duenio, activa: true, desactivada_en: null, ultimo_error: null, clave_p256dh: t.destino.clave_p256dh, clave_auth: t.destino.clave_auth });
  expect(guardada?.ultimo_aviso_en).not.toBeNull();

  // El aviso de prueba salió cifrado, con su tema, y el teléfono lo descifra tal cual el servidor lo armó.
  const enviados = await recibidosPor(t);
  expect(enviados).toHaveLength(1);
  expect(enviados[0]).toMatchObject({ topic: "aviso-activado", ttl: "300" });
  expect(JSON.parse(descifrar(Buffer.from(enviados[0]!.cuerpo, "base64"), t))).toEqual(avisoDeActivacion());
});

test("al volver a abrir el menú sigue activado, y al apagarlo se desactiva en la base (con su fecha, sin borrar nada) y en el teléfono", async ({ page }, info) => {
  const t = telefonoPropio(info);
  await simularNavegador(page, { permiso: "default", alPedirPermiso: "granted", suscripcion: t.suscripcion });
  const hoja = await abrirMenu(page);
  await filaDe(hoja).click();
  await expect(filaDe(hoja)).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });

  // Cerrar y volver a abrir: el estado sale del teléfono (la suscripción), no de lo que quedó en pantalla.
  await page.keyboard.press("Escape");
  await expect(hoja).toBeHidden();
  await page.getByRole("button", { name: /Menú/ }).click();
  await expect(filaDe(page.getByRole("dialog", { name: "Más" }))).toHaveAttribute("aria-checked", "true");

  await filaDe(page.getByRole("dialog", { name: "Más" })).click();
  await expect(filaDe(page.getByRole("dialog", { name: "Más" }))).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });
  await expect(page.getByRole("dialog", { name: "Más" }).getByRole("status").filter({ hasText: "Aviso apagado" })).toBeVisible();

  expect(await lo(page)).toMatchObject({ unsubscribe: 1, haySuscripcion: false });
  const apagado = await filaEnLaBase(t);
  expect(apagado).toMatchObject({ activa: false });
  expect(apagado?.desactivada_en).not.toBeNull();

  // Volver a activarlo reactiva la misma dirección: no se duplica ni queda con la fecha de baja.
  await filaDe(page.getByRole("dialog", { name: "Más" })).click();
  await expect(filaDe(page.getByRole("dialog", { name: "Más" }))).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
  expect(await filaEnLaBase(t)).toMatchObject({ activa: true, desactivada_en: null });
  const { count } = await base.from("suscripciones_push").select("id", { count: "exact", head: true }).eq("endpoint", t.destino.endpoint);
  expect(count).toBe(1);
});

test("un doble toque no activa dos veces: el segundo no cuenta mientras el primero termina", async ({ page }, info) => {
  const t = telefonoPropio(info);
  await simularNavegador(page, { permiso: "default", alPedirPermiso: "granted", suscripcion: t.suscripcion });
  const hoja = await abrirMenu(page);
  await filaDe(hoja).dblclick();
  await expect(filaDe(hoja)).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
  expect(await lo(page)).toMatchObject({ pidioPermiso: 1, subscribe: 1 });
  expect(await recibidosPor(t)).toHaveLength(1);
});

test("si la persona cierra el diálogo del permiso sin elegir, no se activa nada y se le dice que puede volver a intentarlo", async ({ page }, info) => {
  const t = telefonoPropio(info);
  await simularNavegador(page, { permiso: "default", alPedirPermiso: "default", suscripcion: t.suscripcion });
  const hoja = await abrirMenu(page);
  await filaDe(hoja).click();
  await expect(hoja.getByRole("status").filter({ hasText: "No activaste el aviso" })).toBeVisible({ timeout: 15_000 });
  await expect(filaDe(hoja)).toHaveAttribute("aria-checked", "false");
  expect(await lo(page)).toMatchObject({ subscribe: 0 });
  expect(await filaEnLaBase(t)).toBeNull();
});

test("si la persona elige «No permitir», queda bloqueado: se dice cómo cambiarlo y no hay interruptor que no haga nada", async ({ page }, info) => {
  const t = telefonoPropio(info);
  await simularNavegador(page, { permiso: "default", alPedirPermiso: "denied", suscripcion: t.suscripcion });
  const hoja = await abrirMenu(page);
  await filaDe(hoja).click();
  await expect(hoja.getByText("Bloqueado en tu teléfono")).toBeVisible({ timeout: 15_000 });
  await expect(hoja.getByText("Los avisos están bloqueados")).toBeVisible();
  await expect(filaDe(hoja), "ya no es un interruptor").toHaveCount(0);
  expect(await filaEnLaBase(t)).toBeNull();
});

test("con el permiso ya bloqueado de antes, la fila lo dice desde el principio", async ({ page }, info) => {
  await simularNavegador(page, { permiso: "denied", alPedirPermiso: "denied", suscripcion: telefonoPropio(info).suscripcion });
  const hoja = await abrirMenu(page);
  await expect(hoja.getByText("Bloqueado en tu teléfono")).toBeVisible();
  await expect(hoja.getByText("Entra a los ajustes de tu navegador")).toBeVisible();
});

test("si el servidor no acepta la dirección, no queda una suscripción en el teléfono que el servidor no conoce, y se dice qué pasó", async ({ page }, info) => {
  // Una dirección que no es de un servicio de avisos conocido: el servidor la rechaza (si no, mandaría un POST a donde le digan).
  const t = telefonoDePrueba(`https://interno.example/aviso/${PREFIJO}-${info.project.name}-${Date.now()}`);
  await simularNavegador(page, { permiso: "default", alPedirPermiso: "granted", suscripcion: t.suscripcion });
  const hoja = await abrirMenu(page);
  await filaDe(hoja).click();
  await expect(hoja.getByRole("alert").filter({ hasText: "No pudimos activar el aviso" })).toBeVisible({ timeout: 15_000 });
  await expect(filaDe(hoja)).toHaveAttribute("aria-checked", "false");
  expect(await lo(page)).toMatchObject({ subscribe: 1, unsubscribe: 1, haySuscripcion: false }); // se deshizo
  expect(await filaEnLaBase(t)).toBeNull();
  expect(await recibidosPor(t)).toEqual([]);
});

test.describe("iPhone con la app sin instalar", () => {
  test.use({ userAgent: IPHONE });

  test("Safari solo manda avisos a la app instalada: la fila lo dice y manda a «Instalar la app», sin un interruptor que no haga nada", async ({ page }) => {
    const hoja = await abrirMenu(page);
    await expect(hoja.getByText("Primero instala la app")).toBeVisible();
    await expect(hoja.getByText("En iPhone, los avisos llegan solo a la app instalada")).toBeVisible();
    await expect(filaDe(hoja)).toHaveCount(0);
    await expect(hoja.getByRole("button", { name: "Instalar la app" })).toBeVisible();
  });
});

test("sin service worker (como en desarrollo) la fila no aparece, y el menú sigue igual", async ({ page }) => {
  const hoja = await abrirMenu(page);
  await expect(hoja.getByRole("link", { name: "Cierre del día" })).toBeVisible();
  await expect(hoja.getByText("Aviso del día")).toHaveCount(0);
});

for (const rol of ["ayudante", "contador"] as const) {
  test(`el ${rol} también puede pedir el aviso: ve el cierre, así que ve las mismas cifras`, async ({ page }, info) => {
    await simularNavegador(page, { permiso: "default", alPedirPermiso: "granted", suscripcion: telefonoPropio(info).suscripcion });
    const hoja = await abrirMenu(page, rol);
    await expect(filaDe(hoja)).toBeVisible();
  });
}

test("la fila se alcanza con el pulgar: 48 px o más de alto, cabe en la hoja y no se sale de la pantalla", async ({ page }, info) => {
  await simularNavegador(page, { permiso: "default", alPedirPermiso: "granted", suscripcion: telefonoPropio(info).suscripcion });
  const hoja = await abrirMenu(page);
  await quieto(page); // medir con la hoja ya quieta: durante la entrada todo está a otra escala
  const caja = (await filaDe(hoja).boundingBox())!;
  const ancho = page.viewportSize()!.width;
  expect(caja.height).toBeGreaterThanOrEqual(48);
  expect(caja.x).toBeGreaterThanOrEqual(0);
  expect(caja.x + caja.width).toBeLessThanOrEqual(ancho);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), "sin scroll horizontal").toBeLessThanOrEqual(0);
});
