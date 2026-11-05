import { expect, test } from "@playwright/test";

import { baseLocal, enSoles } from "./base";
import { entrarComo } from "./cuentas";
import { medir } from "./medir";

// La ficha de un cliente (A8): lo que dice la pantalla es lo que dice la base, y nada se sale de 360 px.

test.setTimeout(60_000);

/** Un cliente de prueba en la base local; `limpiar` lo quita al terminar (es la base de pruebas, no la del puesto). */
async function crearCliente(datos: Record<string, string | null>) {
  const base = baseLocal();
  const nombre = `Cliente de prueba ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { data, error } = await base.from("clientes").insert({ nombre, ...datos }).select("id, nombre").single();
  if (error || !data) throw new Error(`No se pudo crear el cliente de prueba: ${error?.message}`);
  return { ...data, limpiar: async () => void (await base.from("clientes").delete().eq("id", data.id)) };
}

test("el cuaderno abre la ficha de quien más debe, con su deuda y su historial tal como están en la base", async ({ page }) => {
  await entrarComo(page, "duenio");
  const base = baseLocal();

  const { data: deudor } = await base.from("v_saldo_clientes").select("cliente_id, nombre, saldo").order("saldo", { ascending: false }).limit(1).single();
  expect(Number(deudor!.saldo)).toBeGreaterThan(0);
  const id = deudor!.cliente_id!;
  const [{ count: ventas }, { count: abonos }] = await Promise.all([
    base.from("ventas").select("id", { count: "exact", head: true }).eq("cliente_id", id).eq("estado", "registrada"),
    base.from("abonos").select("id", { count: "exact", head: true }).eq("cliente_id", id),
  ]);
  const esperados = Math.min(40, (ventas ?? 0) + (abonos ?? 0));
  expect(esperados).toBeGreaterThan(0);

  await page.goto("/clientes");
  await page.getByRole("link", { name: new RegExp(deudor!.nombre!) }).click();
  await expect(page).toHaveURL(`/clientes/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: deudor!.nombre! })).toBeVisible();

  // Lo que se ve es lo que dice la base: la deuda y cuántos movimientos hay.
  const deuda = page.getByTestId("deuda-cliente");
  await expect(deuda).toContainText("Te debe");
  await expect(deuda).toContainText(enSoles(Number(deudor!.saldo)));
  await expect(page.getByTestId("movimientos").getByRole("listitem")).toHaveCount(esperados);

  // Cada fila dice qué pasó, cuánto y cómo quedó; no repite el nombre del cliente.
  const primera = page.getByTestId("movimientos").getByRole("listitem").first();
  await expect(primera).not.toContainText(deudor!.nombre!);
  await expect(primera.getByText(/Lo debe|Pagó|Abono/)).toBeVisible();

  // Las etiquetas dicen lo del puesto («fiado»), miden 17 px o más y no se parten en dos líneas a 360 px (/formidable 2026-11-05).
  await expect(page.getByText("Último fiado")).toBeVisible();
  const etiquetas = await page.locator("dt").evaluateAll((els) => els.map((e) => ({ px: parseFloat(getComputedStyle(e).fontSize), lineas: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)) })));
  expect(etiquetas.length).toBeGreaterThan(0);
  for (const e of etiquetas) {
    expect(e.px).toBeGreaterThanOrEqual(17);
    expect(e.lineas).toBe(1);
  }

  const { desborde, chicos } = await medir(page);
  expect(desborde, "nada se sale de la pantalla").toBeLessThanOrEqual(0);
  expect(chicos, "controles de menos de 48 px").toEqual([]);

  // «Clientes» vuelve al cuaderno con un toque.
  await page.getByRole("link", { name: "Clientes", exact: true }).first().click();
  await expect(page).toHaveURL("/clientes");
});

test("un cliente sin movimientos está al día y la ficha dice qué falta, sin filas vacías", async ({ page }) => {
  const nuevo = await crearCliente({});
  try {
    await entrarComo(page, "duenio");
    await page.goto(`/clientes/${nuevo.id}`);
    await expect(page.getByRole("heading", { level: 1, name: nuevo.nombre })).toBeVisible();
    await expect(page.getByTestId("deuda-cliente")).toContainText("Al día");
    await expect(page.getByTestId("deuda-cliente")).toContainText("No te debe nada");
    await expect(page.getByText("Todavía no hay movimientos")).toBeVisible();
    // Sin teléfono, documento, dirección ni notas no hay sección de datos.
    await expect(page.getByRole("heading", { name: "Sus datos" })).toHaveCount(0);

    const { desborde, chicos } = await medir(page);
    expect(desborde).toBeLessThanOrEqual(0);
    expect(chicos).toEqual([]);
  } finally {
    await nuevo.limpiar();
  }
});

test("los datos del cliente salen si los hay, y el teléfono se llama con un toque", async ({ page }) => {
  const nuevo = await crearCliente({ telefono: "987 654 321", tipo_documento: "DNI", numero_documento: "12345678", notas: "Paga los viernes" });
  try {
    await entrarComo(page, "duenio");
    await page.goto(`/clientes/${nuevo.id}`);
    const datos = page.getByRole("region", { name: "Sus datos" });
    await expect(datos.getByRole("link", { name: "987 654 321" })).toHaveAttribute("href", "tel:987654321");
    await expect(datos).toContainText("DNI 12345678");
    await expect(datos).toContainText("Paga los viernes");
    // Lo que no hay no se muestra.
    await expect(datos).not.toContainText("Dirección");

    const { desborde, chicos } = await medir(page);
    expect(desborde).toBeLessThanOrEqual(0);
    expect(chicos).toEqual([]);
  } finally {
    await nuevo.limpiar();
  }
});

test("un enlace roto responde 404 en lenguaje de puesto y ofrece volver al cuaderno", async ({ page }) => {
  await entrarComo(page, "duenio");
  for (const ruta of ["/clientes/999999999", "/clientes/abc"]) {
    const respuesta = await page.goto(ruta);
    expect(respuesta?.status(), ruta).toBe(404);
    await expect(page.getByText("No encontré a ese cliente")).toBeVisible();
  }
  await page.getByRole("link", { name: "Ver el cuaderno" }).click();
  await expect(page).toHaveURL("/clientes");
});

test("el contador abre la ficha y la lee", async ({ page }) => {
  await entrarComo(page, "contador");
  const base = baseLocal();
  const { data: deudor } = await base.from("v_saldo_clientes").select("cliente_id, nombre").order("saldo", { ascending: false }).limit(1).single();
  await page.goto(`/clientes/${deudor!.cliente_id}`);
  await expect(page.getByRole("heading", { level: 1, name: deudor!.nombre! })).toBeVisible();
  await expect(page.getByTestId("deuda-cliente")).toBeVisible();
});
