import { expect, test, type Page } from "@playwright/test";

import { baseLocal } from "./base";
import { entrarComo, type Rol } from "./cuentas";
import { abastecer, stockDe } from "./dictar";
import { verTuStock } from "./stock";

// Contar a mano desde Stock (ADR-0028): el contador arranca en lo que dice la app, se compara, se dice por qué no cuadra y la base
// deja el stock en lo contado. Cada prueba crea su propia fruta, así las corridas en paralelo no se pisan; al terminar se desactivan.

test.setTimeout(90_000);
const base = baseLocal();
const creadas: number[] = [];
test.afterAll(async () => {
  if (creadas.length) await base.from("productos").update({ activo: false }).in("id", creadas);
});

async function fruta(cajas: number | null) {
  const nombre = `Fruta de conteo ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const { data, error } = await base.from("productos").insert({ nombre, unidad: "caja" }).select("id, nombre").single();
  if (error || !data) throw new Error(`No se pudo crear la fruta de prueba: ${error?.message}`);
  creadas.push(data.id);
  if (cajas !== null) await abastecer(data.id, cajas);
  return data;
}

const conteosDe = async (productoId: number) =>
  (await base.from("conteos").select("id, contado, segun_app, diferencia, causa").eq("producto_id", productoId).order("id")).data ?? [];
const movimientoDe = async (conteoId: number) =>
  (await base.from("movimientos_stock").select("tipo, cantidad").eq("conteo_id", conteoId)).data ?? [];

/** En Stock, abre la fila de la fruta y toca «Contar». Devuelve la hoja ya abierta. */
async function contarDesdeLaFila(page: Page, nombre: string, rol: Rol = "duenio") {
  await entrarComo(page, rol);
  await page.goto("/stock");
  await verTuStock(page);
  const fila = page.getByRole("listitem").filter({ hasText: nombre });
  await fila.getByRole("button", { name: new RegExp(nombre) }).click();
  await fila.getByRole("button", { name: "Contar" }).click();
  const hoja = page.getByRole("dialog", { name: "Contar cajas" });
  await expect(hoja).toBeVisible({ timeout: 20_000 });
  return hoja;
}

test("faltan 2 que se malograron: pide la causa, guarda una merma y el stock queda en lo contado", async ({ page }) => {
  const f = await fruta(12);
  const hoja = await contarDesdeLaFila(page, f.nombre);

  // Arranca en lo que dice la app: si cuadra, no hay que tocar nada.
  await expect(hoja.locator("output")).toHaveText("12");
  await expect(hoja.getByRole("status").filter({ hasText: "Cuadra con la app" })).toBeVisible();

  await hoja.getByRole("button", { name: "Una caja menos" }).click();
  await hoja.getByRole("button", { name: "Una caja menos" }).click();
  await expect(hoja.getByText("Faltan 2 cajas.")).toBeVisible();
  await expect(hoja.getByText("La app decía 12 cajas.")).toBeVisible();
  await expect(hoja.getByText("Elige por qué faltan.")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Confirmar conteo" })).toBeDisabled();

  await hoja.getByRole("button", { name: "Se malogró" }).click();
  await expect(hoja.getByText("Se anota como merma.")).toBeVisible();
  await hoja.getByRole("button", { name: "Confirmar conteo" }).evaluate((b: HTMLButtonElement) => {
    b.click();
    b.click();
  });
  await expect(page.getByText("Conteo guardado")).toBeVisible();
  await expect(page.getByText("Ahora la app dice 10 cajas")).toBeVisible();

  // En la base: un solo conteo (dos toques), su merma de −2 y el stock en 10.
  const conteos = await conteosDe(f.id);
  expect(conteos).toEqual([{ id: expect.any(Number), contado: 10, segun_app: 12, diferencia: -2, causa: "se_malogro" }]);
  expect(await movimientoDe(conteos[0]!.id)).toEqual([{ tipo: "merma", cantidad: -2 }]);
  expect(await stockDe(f.id)).toBe(10);
});

test("si cuadra se confirma sin tocar el contador: queda el conteo, sin movimiento", async ({ page }) => {
  const f = await fruta(7);
  const hoja = await contarDesdeLaFila(page, f.nombre);
  await expect(hoja.getByRole("status").filter({ hasText: "Cuadra con la app" })).toBeVisible();
  await hoja.getByRole("button", { name: "Confirmar conteo" }).click();
  await expect(page.getByText("Cuadra: tienes 7 cajas")).toBeVisible();

  const conteos = await conteosDe(f.id);
  expect(conteos).toEqual([{ id: expect.any(Number), contado: 7, segun_app: 7, diferencia: 0, causa: null }]);
  expect(await movimientoDe(conteos[0]!.id)).toEqual([]);
});

test("el ayudante también cuenta: sobran 3 que llegaron sin anotar", async ({ page }) => {
  const f = await fruta(4);
  const hoja = await contarDesdeLaFila(page, f.nombre, "ayudante");
  for (let i = 0; i < 3; i++) await hoja.getByRole("button", { name: "Una caja más" }).click();
  await expect(hoja.getByText("Sobran 3 cajas.")).toBeVisible();
  // Lo que sobra no puede ser una merma ni una venta sin anotar.
  await expect(hoja.getByRole("button", { name: "Se malogró" })).toHaveCount(0);
  await hoja.getByRole("button", { name: "Llegó sin anotar" }).click();
  await hoja.getByRole("button", { name: "Confirmar conteo" }).click();
  await expect(page.getByText("Conteo guardado")).toBeVisible();

  const [c] = await conteosDe(f.id);
  expect(c).toMatchObject({ contado: 7, diferencia: 3, causa: "compra_sin_anotar" });
  expect(await movimientoDe(c!.id)).toEqual([{ tipo: "ajuste", cantidad: 3 }]);
});

test("si entra una compra mientras se cuenta, no guarda una causa vieja: lo dice y vuelve a comparar", async ({ page }) => {
  const f = await fruta(10);
  const hoja = await contarDesdeLaFila(page, f.nombre);
  await hoja.getByRole("button", { name: "Una caja menos" }).click();
  await hoja.getByRole("button", { name: "Se malogró" }).click();
  // Mientras tanto, otra persona anota una compra de 5: la app ahora dice 15 y contar 9 ya no es «falta 1 que se malogró».
  await abastecer(f.id, 5);
  await hoja.getByRole("button", { name: "Confirmar conteo" }).click();
  await expect(hoja.getByText(/Mientras contabas cambió el stock: la app ahora dice 15 cajas/)).toBeVisible();
  await expect(hoja.getByText("Faltan 6 cajas.")).toBeVisible();
  // La causa de antes era para «falta 1»: se vuelve a elegir, con la diferencia nueva a la vista (el pie muestra el error, no el aviso).
  await expect(hoja.getByRole("button", { name: "Se malogró" })).toHaveAttribute("aria-pressed", "false");
  await expect(hoja.getByRole("button", { name: "Confirmar conteo" })).toBeDisabled();
  expect(await conteosDe(f.id)).toEqual([]);
  expect(await stockDe(f.id)).toBe(15);
});

test("una fruta que la app no tiene se cuenta desde el final de la lista: llegó sin anotar", async ({ page }) => {
  const f = await fruta(null);
  await entrarComo(page, "duenio");
  await page.goto("/stock");
  await verTuStock(page);
  await page.getByRole("button", { name: "Contar una fruta sin cajas" }).click();
  const hoja = page.getByRole("dialog", { name: "Contar cajas" });
  await expect(hoja).toBeVisible({ timeout: 20_000 });
  await hoja.getByPlaceholder("¿Qué fruta contaste?").fill(f.nombre);
  await hoja.getByRole("button", { name: new RegExp(f.nombre) }).click();
  await expect(hoja.getByRole("status").filter({ hasText: "Cuadra con la app" })).toBeVisible();
  for (let i = 0; i < 4; i++) await hoja.getByRole("button", { name: "Una caja más" }).click();
  await expect(hoja.getByText("La app no tenía ninguna caja.")).toBeVisible();
  await hoja.getByRole("button", { name: "Llegó sin anotar" }).click();
  await hoja.getByRole("button", { name: "Confirmar conteo" }).click();
  await expect(page.getByText("Ahora la app dice 4\u00a0cajas")).toBeVisible();
  expect(await stockDe(f.id)).toBe(4);
});

test("el contador no ve «Contar»", async ({ page }) => {
  const f = await fruta(3);
  await entrarComo(page, "contador");
  await page.goto("/stock");
  await verTuStock(page);
  const fila = page.getByRole("listitem").filter({ hasText: f.nombre });
  await fila.getByRole("button", { name: new RegExp(f.nombre) }).click();
  await expect(page.getByRole("button", { name: "Contar" })).toHaveCount(0);
});
