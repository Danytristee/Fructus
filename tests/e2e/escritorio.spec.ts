import { expect, test } from "@playwright/test";

import { entrarComo } from "./cuentas";

// El escritorio (ADR-0015): desde 1024 px, un panel lateral verde reemplaza a la barra de abajo y al menú de tres rayas. Quien lo usa es quien
// revisa (administrador o contador). No depende del celular emulado: corre una sola vez, a 1280 × 800.
test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
test.beforeEach(({}, info) => test.skip(info.project.name !== "s25-412", "es el escritorio: corre una vez"));

test("el panel lateral lleva a todas las pantallas, marca la actual, y no hay barra de abajo ni menú de tres rayas", async ({ page }) => {
  await entrarComo(page, "duenio");
  const panel = page.getByRole("complementary", { name: "Fructus" });
  await expect(panel).toBeVisible();
  const nav = panel.getByRole("navigation", { name: "Principal" });
  await expect(nav.getByRole("link")).toHaveText(["Hoy", "Clientes", "Stock", "Ventas", "Cierre del día", "Ajustes"]);
  // La barra de abajo y el botón de tres rayas de la cabecera no se dibujan: el panel los reemplaza.
  await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(1);
  await expect(page.locator("header").getByRole("button", { name: /^Menú/ })).toBeHidden();

  for (const [nombre, ruta, titulo] of [
    ["Clientes", "/clientes", "Clientes"],
    ["Stock", "/stock", "Stock"],
    ["Ventas", "/ventas", "Ventas"],
    ["Cierre del día", "/cierre", "Cierre del día"],
    ["Ajustes", "/ajustes", "Ajustes"],
    ["Hoy", "/", "Hoy"],
  ] as const) {
    await nav.getByRole("link", { name: nombre }).click();
    await expect(page).toHaveURL(ruta);
    await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible();
    await expect(nav.getByRole("link", { name: nombre })).toHaveAttribute("aria-current", "page");
    // El contenido empieza a la derecha del panel y nada se sale de la pantalla.
    const medida = await page.evaluate(() => ({
      desborde: document.documentElement.scrollWidth - innerWidth,
      contenido: Math.round(document.querySelector("main")!.getBoundingClientRect().left),
      panel: Math.round(document.querySelector("aside")!.getBoundingClientRect().right),
    }));
    expect(medida.desborde).toBe(0);
    expect(medida.contenido).toBeGreaterThanOrEqual(medida.panel);
  }
});

test("«Más» del panel abre el mismo menú: quién entró, aviso del día y salir", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.getByRole("complementary", { name: "Fructus" }).getByRole("button", { name: /^Menú/ }).click();
  const hoja = page.getByRole("dialog", { name: "Más" });
  await expect(hoja).toBeVisible({ timeout: 15_000 });
  await expect(hoja.getByText("Entraste como")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Salir" })).toBeVisible();
});

test("el contador ve el panel sin Ajustes, y sin el botón de voz", async ({ page }) => {
  await entrarComo(page, "contador");
  const nav = page.getByRole("complementary", { name: "Fructus" }).getByRole("navigation", { name: "Principal" });
  await expect(nav.getByRole("link")).toHaveText(["Hoy", "Clientes", "Stock", "Ventas", "Cierre del día"]);
  await expect(page.getByRole("button", { name: /Mantén para hablar/ })).toHaveCount(0);
});
