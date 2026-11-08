import { expect, test, type Page } from "@playwright/test";

import { entrarComo } from "./cuentas";

// La app se instala en el teléfono (PWA). Lo que tiene que cumplirse para que Chrome, Edge, Samsung Internet y Safari la ofrezcan:
// el manifest se abre SIN sesión (el navegador lo pide sin cookies), los íconos existen con el tamaño que dicen, y las páginas lo enlazan.
// Y el menú «Más» dice cómo instalarla en el teléfono de quien la abre.

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

type Icono = { src: string; sizes: string; type: string; purpose?: string };
type Manifest = {
  id: string;
  name: string;
  short_name: string;
  lang: string;
  start_url: string;
  scope: string;
  display: string;
  orientation: string;
  background_color: string;
  theme_color: string;
  icons: Icono[];
  shortcuts: { name: string; url: string; icons: Icono[] }[];
};

/** Ancho y alto de un PNG, leídos de su cabecera (IHDR): así se comprueba que el ícono mide lo que el manifest dice. */
const medidaDelPng = (cuerpo: Buffer) => ({ ancho: cuerpo.readUInt32BE(16), alto: cuerpo.readUInt32BE(20) });

test("el manifest se abre sin sesión y trae todo lo que pide el teléfono para instalar la app", async ({ request }) => {
  const respuesta = await request.get("/manifest.webmanifest");
  expect(respuesta.status(), "sin sesión no puede redirigir al login").toBe(200);
  expect(respuesta.headers()["content-type"]).toContain("json");
  const m = (await respuesta.json()) as Manifest;

  expect(m).toMatchObject({ id: "/", name: "Fructus", short_name: "Fructus", lang: "es-PE", start_url: "/", scope: "/", display: "standalone", orientation: "portrait" });
  expect(m.background_color).toBe(m.theme_color);

  // Chrome pide 192 y 512; Android recorta los «maskable» con la forma de su pantalla.
  const clave = (i: Icono) => `${i.sizes} ${i.purpose}`;
  expect(m.icons.map(clave).sort()).toEqual(["192x192 any", "192x192 maskable", "512x512 any", "512x512 maskable"]);

  // Cada ícono existe, es PNG y mide lo que dice.
  for (const icono of m.icons) {
    const r = await request.get(icono.src);
    expect(r.status(), icono.src).toBe(200);
    expect(r.headers()["content-type"], icono.src).toContain("image/png");
    const lado = Number(icono.sizes.split("x")[0]);
    expect(medidaDelPng(await r.body()), icono.src).toEqual({ ancho: lado, alto: lado });
  }

  // Los atajos del ícono (mantener el dedo encima) llevan a pantallas de la app.
  expect(m.shortcuts.map((a) => a.url)).toEqual(["/clientes", "/stock", "/ventas"]);
});

test("las páginas enlazan el manifest, el ícono de iPhone y el color de la barra; y el ícono de la pestaña se abre sin sesión", async ({ page, request }) => {
  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /\/apple-icon\.png/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#eef3f8");
  // Al abrirla desde el ícono se ve como app, en iPhone y en Android.
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "Fructus");

  for (const ruta of ["/favicon.ico", "/apple-icon.png", "/icon.png"]) {
    const r = await request.get(ruta);
    expect(r.status(), ruta).toBe(200);
  }
});

test("el navegador no ve ningún error de instalación (ícono, manifest, página de inicio)", async ({ page }) => {
  await page.goto("/login");
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors.map((e) => e.errorId)).toEqual([]);
});

// -----------------------------------------------------------------------------------------------------------------------------------
// El menú «Más»: «Instalar la app»
// -----------------------------------------------------------------------------------------------------------------------------------

async function abrirMenu(page: Page) {
  await entrarComo(page, "duenio");
  await page.getByRole("button", { name: /Menú/ }).click();
  const hoja = page.getByRole("dialog", { name: "Más" });
  await expect(hoja).toBeVisible();
  return hoja;
}

/** El aviso del navegador de que la app se puede instalar: Chrome lo manda solo en un teléfono real; aquí se simula. */
const avisarQueSePuedeInstalar = (page: Page, respuesta: "accepted" | "dismissed") =>
  page.evaluate((outcome) => {
    const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    (window as unknown as { __pidio: number }).__pidio = 0;
    e.prompt = async () => {
      (window as unknown as { __pidio: number }).__pidio++;
    };
    e.userChoice = Promise.resolve({ outcome });
    window.dispatchEvent(e);
  }, respuesta);

test("en Android sin diálogo de instalación, «Instalar la app» dice los pasos del menú del navegador", async ({ page }) => {
  const hoja = await abrirMenu(page);
  const fila = hoja.getByRole("button", { name: "Instalar la app" });
  await expect(fila).toBeVisible();
  await expect(fila).toHaveAttribute("aria-expanded", "false");
  await fila.click();
  await expect(fila).toHaveAttribute("aria-expanded", "true");
  await expect(hoja.getByRole("listitem")).toHaveCount(3);
  await expect(hoja.getByText(/Instalar app/)).toBeVisible();
  // Se queda en la hoja: son instrucciones, no una acción que cierre el menú.
  await expect(hoja).toBeVisible();
});

test("si el navegador ofrece el diálogo, «Instalar la app» lo abre con un toque y se cierra el menú al aceptar", async ({ page }) => {
  await entrarComo(page, "duenio");
  await avisarQueSePuedeInstalar(page, "accepted");
  await page.getByRole("button", { name: /Menú/ }).click();
  const hoja = page.getByRole("dialog", { name: "Más" });
  await hoja.getByRole("button", { name: "Instalar la app" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __pidio: number }).__pidio)).toBe(1);
  await expect(hoja).toBeHidden();
});

test("si la persona descarta el diálogo, el menú sigue abierto y no se vuelve a pedir con el mismo aviso", async ({ page }) => {
  await entrarComo(page, "duenio");
  await avisarQueSePuedeInstalar(page, "dismissed");
  await page.getByRole("button", { name: /Menú/ }).click();
  const hoja = page.getByRole("dialog", { name: "Más" });
  await hoja.getByRole("button", { name: "Instalar la app" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __pidio: number }).__pidio)).toBe(1);
  await expect(hoja).toBeVisible();
  // El aviso se usa una sola vez: ahora la fila dice los pasos a mano en vez de un botón muerto.
  const fila = hoja.getByRole("button", { name: "Instalar la app" });
  await fila.click();
  await expect(hoja.getByRole("listitem")).toHaveCount(3);
});

test.describe("en un iPhone", () => {
  test.use({ userAgent: IPHONE });

  test("«Instalar la app» no promete un botón que Safari no tiene: dice Compartir y «Añadir a pantalla de inicio»", async ({ page }) => {
    const hoja = await abrirMenu(page);
    await hoja.getByRole("button", { name: "Instalar la app" }).click();
    await expect(hoja.getByRole("listitem")).toHaveCount(3);
    await expect(hoja.getByText(/Compartir/)).toBeVisible();
    await expect(hoja.getByText(/Añadir a pantalla de inicio/).first()).toBeVisible();
  });
});

test.describe("con la app ya instalada", () => {
  test("abierta desde el ícono, el menú no ofrece instalarla otra vez", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }));
    const hoja = await abrirMenu(page);
    await expect(hoja.getByRole("button", { name: "Salir" })).toBeVisible();
    await expect(hoja.getByRole("button", { name: "Instalar la app" })).toHaveCount(0);
  });
});

test("la fila y los pasos caben en el celular: controles de 48 px y sin desborde", async ({ page }) => {
  const hoja = await abrirMenu(page);
  await hoja.getByRole("button", { name: "Instalar la app" }).click();
  await page.waitForTimeout(700); // que termine la entrada de los pasos
  const { height } = page.viewportSize()!;
  const medidas = await hoja.evaluate((raiz) => ({
    desborde: raiz.scrollWidth - raiz.clientWidth,
    chicos: [...raiz.querySelectorAll("button, a")].filter((e) => e.getBoundingClientRect().height < 48).map((e) => e.textContent?.trim()),
  }));
  expect(medidas.desborde).toBeLessThanOrEqual(0);
  expect(medidas.chicos, "controles de menos de 48 px").toEqual([]);
  const salir = (await hoja.getByRole("button", { name: "Salir" }).boundingBox())!;
  expect(salir.y + salir.height, "«Salir» sigue a la vista con los pasos abiertos").toBeLessThanOrEqual(height);
});
