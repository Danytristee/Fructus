import { expect, test, type Page } from "@playwright/test";

import { baseLocal, enSoles } from "./base";
import { entrarComo, type Rol } from "./cuentas";
import { fiar, venderAlPaso } from "./dictar";
import { medir } from "./medir";

// El historial de ventas (A8): cuánto se vendió hoy y en 7 días tal como está en la base, y el detalle de cada venta al tocarla.
// Cada prueba crea su propio cliente y sus propias ventas, así las corridas en paralelo no se pisan.

test.setTimeout(90_000);
const base = baseLocal();

async function clienteNuevo() {
  const nombre = `Cliente de ventas ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const { data, error } = await base.from("clientes").insert({ nombre }).select("id, nombre").single();
  if (error || !data) throw new Error(`No se pudo crear el cliente: ${error?.message}`);
  return data;
}

async function abrirVentas(page: Page, rol: Rol = "duenio") {
  await entrarComo(page, rol);
  await page.goto("/ventas");
  await expect(page.getByTestId("resumen-periodo")).toBeVisible();
}

test("el resumen de «Hoy» y de «7 días» es el que dice la base, y los chips cuentan lo que filtran", async ({ page }) => {
  await abrirVentas(page);
  const { data: hoy } = await base.rpc("resumen_dia");
  const dia = hoy as { ventas_total: number; ventas_contado: number; ventas_credito: number; numero_ventas: number };
  expect(dia.numero_ventas).toBeGreaterThan(0);

  const resumen = page.getByTestId("resumen-periodo");
  await expect(resumen).toContainText("Hoy vendiste");
  await expect(resumen).toContainText(enSoles(Number(dia.ventas_total)));
  await expect(resumen).toContainText(`${dia.numero_ventas} ${dia.numero_ventas === 1 ? "venta" : "ventas"}`);
  await expect(resumen).toContainText(`${enSoles(Number(dia.ventas_contado))} al contado y ${enSoles(Number(dia.ventas_credito))} al crédito`);

  // Los 7 días suman lo de la base en ese mismo rango.
  const hace7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: semana } = await base.from("ventas").select("total, condicion").eq("estado", "registrada").gte("fecha", hace7);
  const total = (semana ?? []).reduce((s, v) => s + Math.round(Number(v.total) * 100), 0) / 100;
  await page.getByRole("button", { name: /7 días/ }).click();
  await expect(resumen).toContainText("En 7 días vendiste");
  await expect(resumen).toContainText(enSoles(total));
  await expect(resumen).toContainText(`${semana!.length} ${semana!.length === 1 ? "venta" : "ventas"}`);
});

test("tocar una venta abre su detalle: a quién, qué fruta, cuánto, cómo y quién la registró", async ({ page }) => {
  const c = await clienteNuevo();
  await fiar(c.id, 100);
  await abrirVentas(page);

  await page.getByRole("button", { name: new RegExp(c.nombre) }).click();
  const hoja = page.getByRole("dialog", { name: "Detalle de la venta" });
  await expect(hoja).toBeVisible({ timeout: 15_000 });
  await expect(hoja.getByText(c.nombre)).toBeVisible();
  await expect(hoja.getByText("Ver su ficha")).toBeVisible();
  await expect(hoja.getByText(enSoles(100)).first()).toBeVisible();
  await expect(hoja.getByText("Lo debe")).toBeVisible();
  await expect(hoja.getByRole("list", { name: "Fruta de la venta" })).toContainText("1 caja de mango kent");
  await expect(hoja.getByRole("list", { name: "Fruta de la venta" })).toContainText(`${enSoles(100)} la caja`);
  await expect(hoja.getByText("La registró Dueño de prueba.")).toBeVisible();

  // Desde el detalle se llega a la ficha del cliente.
  await hoja.getByRole("link", { name: /Ver su ficha/ }).click();
  await expect(page).toHaveURL(`/clientes/${c.id}`);
});

test("una venta al paso dice que fue al paso y con qué se pagó", async ({ page }) => {
  const id = await venderAlPaso(77, "yape");
  expect(id).toBeGreaterThan(0);
  await abrirVentas(page);
  await page.getByRole("button", { name: /Venta al paso/ }).filter({ hasText: "Yape" }).first().click();
  const hoja = page.getByRole("dialog", { name: "Detalle de la venta" });
  await expect(hoja).toBeVisible({ timeout: 15_000 });
  await expect(hoja.getByText("Venta al paso")).toBeVisible();
  await expect(hoja.getByText("Pagó con Yape")).toBeVisible();
  await expect(hoja.getByRole("link", { name: /Ver su ficha/ })).toHaveCount(0);
});

test("el contador puede ver el detalle, sin saber quién la registró", async ({ page }) => {
  const c = await clienteNuevo();
  await fiar(c.id, 55);
  await abrirVentas(page, "contador");
  await page.getByRole("button", { name: new RegExp(c.nombre) }).click();
  const hoja = page.getByRole("dialog", { name: "Detalle de la venta" });
  await expect(hoja).toBeVisible({ timeout: 15_000 });
  await expect(hoja.getByText(enSoles(55)).first()).toBeVisible();
  await expect(hoja.getByText(/La registró/)).toHaveCount(0);
});

test("la pantalla cabe en el celular: sin desborde, con controles de 48 px y la hoja a la vista", async ({ page }) => {
  const c = await clienteNuevo();
  await fiar(c.id, 40);
  await abrirVentas(page);
  const { desborde, chicos } = await medir(page);
  expect(desborde).toBeLessThanOrEqual(0);
  expect(chicos, "controles de menos de 48 px").toEqual([]);

  await page.getByRole("button", { name: new RegExp(c.nombre) }).click();
  const hoja = page.getByRole("dialog", { name: "Detalle de la venta" });
  await expect(hoja).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(800);
  const medidas = await hoja.evaluate((raiz) => ({ desborde: raiz.scrollWidth - raiz.clientWidth, alto: raiz.getBoundingClientRect().height }));
  expect(medidas.desborde).toBeLessThanOrEqual(0);
  expect(medidas.alto).toBeLessThanOrEqual(page.viewportSize()!.height);
});
