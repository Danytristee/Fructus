import { expect, test } from "@playwright/test";

import { baseLocal } from "./base";
import { entrarComo } from "./cuentas";
import { quieto } from "./medir";

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

test("«Hoy» en grilla: lo vendido a la izquierda y lo cobrado al lado; «Lo último» debajo, con el aviso de stock al lado", async ({ page }) => {
  await entrarComo(page, "duenio");
  const vendido = page.getByLabel("Lo vendido hoy");
  const cobrado = page.getByLabel("Lo que cobraste y lo que te deben");
  await expect(cobrado).toBeVisible({ timeout: 15_000 });
  test.skip(!(await vendido.isVisible()), "la base local no tiene ventas hoy: corre npx supabase db reset");
  await quieto(page); // las tarjetas entran con su animación, desfasadas: se mide cuando terminaron
  const [v, c] = [(await vendido.boundingBox())!, (await cobrado.boundingBox())!];
  expect(c.x, "lo cobrado va a la derecha de lo vendido").toBeGreaterThan(v.x + v.width - 1);
  expect(Math.abs(c.y - v.y), "en la misma fila").toBeLessThan(2);
  const ultimo = (await page.getByRole("heading", { name: "Lo último" }).boundingBox())!;
  expect(ultimo.y, "«Lo último» debajo").toBeGreaterThan(v.y + v.height);
});

test("Clientes en tabla: ordena por deuda o por nombre, coincide con la base y una fila abre la ficha", async ({ page }) => {
  const { data } = await baseLocal().from("v_saldo_clientes").select("cliente_id, nombre, saldo").gt("saldo", 0).order("saldo", { ascending: false }).limit(1);
  const mayor = data![0]!;
  await entrarComo(page, "duenio");
  await page.goto("/clientes");
  const tabla = page.getByRole("table", { name: /Cuaderno de clientes/ });
  await expect(tabla).toBeVisible({ timeout: 15_000 });
  // Por defecto, de quien más debe a quien menos: el primero es el que dice la base.
  const primera = tabla.locator("tbody tr").first();
  await expect(primera).toContainText(mayor.nombre!);
  await expect(tabla.getByRole("columnheader", { name: /Te debe/ })).toHaveAttribute("aria-sort", "descending");
  // Por nombre, de la A a la Z.
  await tabla.getByRole("button", { name: "Cliente" }).click();
  await expect(tabla.getByRole("columnheader", { name: /Cliente/ })).toHaveAttribute("aria-sort", "ascending");
  const nombres = await tabla.locator("tbody tr a").allTextContents();
  expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, "es")));
  // Toda la fila abre la ficha.
  await tabla.getByRole("link", { name: mayor.nombre! }).click();
  await expect(page).toHaveURL(`/clientes/${mayor.cliente_id}`);
  await expect(page.getByRole("heading", { level: 1, name: mayor.nombre! })).toBeVisible();
});

test("Ventas en tabla: hora, cliente, qué llevó, cómo quedó y monto; toda la fila abre el detalle", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/ventas");
  const tabla = page.getByRole("table").first();
  await expect(tabla).toBeVisible({ timeout: 15_000 });
  await expect(tabla.getByRole("columnheader")).toHaveText(["Hora", "Cliente", "Qué llevó", "Cómo quedó", "Monto"]);
  // La lista del celular no se ve: no se duplican las ventas.
  await expect(page.locator("li").filter({ visible: true }).getByRole("button", { name: /mango|plátano|piña/i })).toHaveCount(0);
  const fila = tabla.locator("tbody tr").first();
  await expect(fila.locator("td").first()).toHaveText(/\d{1,2}:\d{2}\s?[ap]\. m\./);
  // Se toca en la celda del monto (no en el nombre): igual abre el detalle.
  const caja = (await fila.locator("td").last().boundingBox())!;
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await expect(page.getByRole("dialog", { name: "Detalle de la venta" })).toBeVisible({ timeout: 15_000 });
});
