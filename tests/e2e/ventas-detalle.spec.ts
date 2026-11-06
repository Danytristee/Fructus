import { expect, test, type Page } from "@playwright/test";

import { baseLocal, enSoles } from "./base";
import { entrarComo, type Rol } from "./cuentas";
import { fiar, venderAlPaso, venderAlPasoVarias } from "./dictar";
import { filtrosSinCortes, medir } from "./medir";

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

test("«cuánto fiaste» se ve en negrita, con su etiqueta, y ningún filtro queda cortado ni escondido", async ({ page }) => {
  await abrirVentas(page);
  const { data: hoy } = await base.rpc("resumen_dia");
  const dia = hoy as { ventas_contado: number; ventas_credito: number };

  // El contado y el crédito son dos cifras en negrita (como en «Hoy»), no una frase gris.
  const resumen = page.getByTestId("resumen-periodo");
  const cifras = resumen.locator("strong");
  await expect(cifras).toHaveCount(2);
  await expect(cifras.nth(0)).toHaveText(enSoles(Number(dia.ventas_contado)));
  await expect(cifras.nth(1)).toHaveText(enSoles(Number(dia.ventas_credito)));
  await expect(resumen).toContainText("al contado y");
  await expect(resumen).toContainText("al crédito");

  // Las etiquetas son cortas, y las dos filas de filtros se ven enteras: lo que no entra se parte en otra fila.
  await expect(page.getByRole("button", { name: /^Contado/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Crédito/ })).toBeVisible();
  for (const grupo of ["Período", "Filtrar ventas"]) {
    const { cortados, desliza } = await filtrosSinCortes(page, grupo);
    expect(cortados, `opciones cortadas en «${grupo}»`).toEqual([]);
    expect(desliza, `«${grupo}» no debe deslizarse de lado`).toBeLessThanOrEqual(0);
  }
});

for (const rol of ["duenio", "ayudante", "contador"] as const) {
  test(`${rol}: el detalle de una venta se cierra con un botón «Cerrar» a la mano`, async ({ page }) => {
    const c = await clienteNuevo();
    await fiar(c.id, 25);
    await abrirVentas(page, rol);
    await page.getByRole("button", { name: new RegExp(c.nombre) }).click();
    const hoja = page.getByRole("dialog", { name: "Detalle de la venta" });
    await expect(hoja).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800); // que termine de subir

    const cerrar = hoja.getByRole("button", { name: "Cerrar", exact: true });
    await expect(cerrar).toBeVisible({ timeout: 5_000 });
    const caja = (await cerrar.boundingBox())!;
    const { width, height } = page.viewportSize()!;
    expect(caja.height, "alto del botón").toBeGreaterThanOrEqual(48);
    expect(caja.y + caja.height, "«Cerrar» a la vista, sin deslizar").toBeLessThanOrEqual(height);
    expect(caja.x + caja.width).toBeLessThanOrEqual(width);
    await cerrar.click();
    await expect(hoja).toBeHidden();
  });
}

test("con más de 300 ventas en 7 días, los totales cuentan todas y la lista avisa que muestra las últimas 300", async ({ page }) => {
  test.setTimeout(240_000);
  const hace7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  // Las anuladas no suman dinero: el tope se supera con ventas registradas.
  const { count } = await base.from("ventas").select("id", { count: "exact", head: true }).eq("estado", "registrada").gte("fecha", hace7);
  if ((count ?? 0) < 310) await venderAlPasoVarias(310 - (count ?? 0), 10);

  // Lo que dice la base: todas las ventas registradas de 7 días, sin tope.
  const { data: semana } = await base.from("ventas").select("total, condicion").eq("estado", "registrada").gte("fecha", hace7);
  const sumar = (c?: "contado" | "credito") => (semana ?? []).filter((v) => !c || v.condicion === c).reduce((s, v) => s + Math.round(Number(v.total) * 100), 0) / 100;
  expect(semana!.length, "la base tiene más ventas que el tope de la lista").toBeGreaterThan(300);

  await abrirVentas(page);
  await page.getByRole("button", { name: /7 días/ }).click();
  const resumen = page.getByTestId("resumen-periodo");
  await expect(resumen).toContainText("En 7 días vendiste");
  await expect(resumen).toContainText(enSoles(sumar()));
  await expect(resumen).toContainText(`${semana!.length} ventas`);
  await expect(resumen).toContainText(`${enSoles(sumar("contado"))} al contado y ${enSoles(sumar("credito"))} al crédito`);

  // La lista dice que no las muestra todas, y con cuántas se quedó.
  const aviso = page.getByText(/Mostrando las últimas 300 ventas de las \d+/);
  await expect(aviso).toBeVisible();
  const total = Number((await aviso.textContent())!.match(/de las (\d+)/)![1]);
  expect(total).toBeGreaterThan(300);

  // «Hoy» sigue completo: el aviso es de la lista de 7 días, no de todo.
  await page.getByRole("button", { name: /^Hoy/ }).click();
  await expect(page.getByTestId("resumen-periodo")).toContainText("Hoy vendiste");
});
