import { expect, test } from "@playwright/test";

import { baseLocal } from "./base";
import { entrarComo } from "./cuentas";
import { filtrosSinCortes, medir } from "./medir";

// El tablero de Stock (A8, /formidable del 5-11; en dos pestañas desde el 14-11): la cuenta de «Qué hacer» dice lo mismo que las
// etiquetas «Hoy», las palabras son de puesto y los filtros no se esconden.
// Lee lo que haya en la base local; solo la última prueba crea frutas de prueba, y las deja inactivas.

test.setTimeout(60_000);

test("la pestaña «Qué hacer» dice cuántas frutas piden algo hoy, y cuenta lo mismo que las etiquetas «Hoy» de la lista", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/stock");
  await expect(page.getByRole("heading", { name: "Qué hacer hoy" })).toBeVisible({ timeout: 30_000 });

  // La cuenta va en la pestaña (antes, en un anillo «X de Y frutas urgentes»). Sin nada urgente no lleva número: no dice «0».
  const pestana = page.getByRole("button", { name: /^Qué hacer/ });
  await expect(pestana).toHaveAttribute("aria-pressed", "true");
  await expect(pestana).toHaveText(/^Qué hacer(\d+)?$/);
  await expect(pestana).not.toContainText("%");
  // Cuenta lo mismo que la lista: las frutas con la etiqueta roja «Hoy». Una tarjeta puede juntar varias frutas, y en «Todas»
  // se ven las primeras y el resto a un toque (/formidable 2026-11-10): se abren todas y se cuentan frutas, no tarjetas.
  const urgentes = Number((await pestana.innerText()).match(/(\d+)$/)?.[1] ?? 0);
  await page.getByRole("button", { name: /^Todas/ }).click();
  const verMas = page.getByRole("button", { name: /^Ver \d+ avisos? más/ });
  if (await verMas.isVisible()) await verMas.click();
  const conHoy = await page
    .locator("li[data-productos]")
    .filter({ has: page.getByText("Hoy", { exact: true }) })
    .evaluateAll((tarjetas) => new Set(tarjetas.flatMap((t) => t.getAttribute("data-productos")!.split(" "))).size);
  expect(urgentes).toBe(conHoy);
  await expect(page.getByText("sin avisos", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/están bien/)).toHaveCount(0);
});

test("Stock habla como el puesto: «te sobra», no «sobrestock»", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/stock");
  await expect(page.getByRole("heading", { name: "Qué hacer hoy" })).toBeVisible({ timeout: 30_000 });
  // La semilla trae fruta de más: el filtro lo dice con palabras de puesto.
  await expect(page.getByRole("button", { name: /^Te sobra/ })).toBeVisible();
  await expect(page.getByText(/sobrestock/i)).toHaveCount(0);
});

test("los filtros de las alertas se ven enteros: lo que no entra en una fila pasa a la siguiente", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/stock");
  await expect(page.getByRole("heading", { name: "Qué hacer hoy" })).toBeVisible({ timeout: 30_000 });
  const { cortados, desliza } = await filtrosSinCortes(page, "Filtrar alertas");
  expect(cortados, "opciones cortadas").toEqual([]);
  expect(desliza, "no debe deslizarse de lado").toBeLessThanOrEqual(0);
  const { desborde, chicos } = await medir(page);
  expect(desborde).toBeLessThanOrEqual(0);
  expect(chicos, "controles de menos de 48 px").toEqual([]);
});

test("una tarjeta que junta muchas frutas nombra 3 y las demás van en una hoja; las cajas que llegaron hoy no son «sin movimiento» (2026-11-10)", async ({ page }) => {
  const base = baseLocal();
  const { data: duenio } = await base.from("perfiles").select("id").eq("rol", "duenio").limit(1).single();
  // El calibre sí va en el nombre de la frase («Cocona cal. E2E…1»): así se distinguen las cuatro.
  const marca = `E2E${Date.now()}`;
  const hace10 = new Date(Date.now() - 10 * 86_400_000).toISOString();
  // Cuatro frutas con cajas de hace 10 días y sin ventas, y una con cajas de hoy.
  const { data: viejas } = await base
    .from("productos")
    .insert([1, 2, 3, 4].map((n) => ({ nombre: "Cocona", calibre: `${marca}-${n}`, unidad: "caja" })))
    .select("id");
  const { data: nueva } = await base.from("productos").insert({ nombre: "Tumbo", calibre: marca, unidad: "caja" }).select("id").single();
  const { error } = await base.from("movimientos_stock").insert([
    ...viejas!.map((p) => ({ producto_id: p.id, tipo: "ajuste" as const, cantidad: 5, motivo: "prueba e2e", fecha: hace10, registrado_por: duenio!.id })),
    { producto_id: nueva!.id, tipo: "ajuste" as const, cantidad: 20, motivo: "prueba e2e", fecha: new Date().toISOString(), registrado_por: duenio!.id },
  ]);
  if (error) throw new Error(`No se pudieron cargar las cajas de prueba: ${error.message}`);
  try {
    await entrarComo(page, "duenio");
    await page.goto("/stock");
    await expect(page.getByRole("heading", { name: "Qué hacer hoy" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Sin movimiento/ }).click();
    const tarjeta = page.locator("li[data-productos]").filter({ hasText: /frutas no se están vendiendo/ });
    await expect(tarjeta).toBeVisible();
    // Las de hace 10 días están; la de hoy, no.
    const ids = (await tarjeta.getAttribute("data-productos"))!.split(" ").map(Number);
    for (const p of viejas!) expect(ids).toContain(p.id);
    expect(ids).not.toContain(nueva!.id);
    // En la tarjeta se nombran 3; el resto, a un toque, en una hoja con todas.
    await expect(tarjeta.locator("ul > li")).toHaveCount(3);
    await tarjeta.getByRole("button", { name: `Ver las ${ids.length} frutas` }).click();
    const hoja = page.getByRole("dialog", { name: /frutas no se están vendiendo/ });
    await expect(hoja).toBeVisible({ timeout: 15_000 });
    for (const n of [1, 2, 3, 4]) await expect(hoja.getByText(`${marca}-${n}`, { exact: false })).toBeVisible();
    await expect(hoja.getByRole("listitem")).toHaveCount(ids.length);
  } finally {
    // No se borra (CLAUDE.md): las frutas de prueba quedan inactivas.
    await base.from("productos").update({ activo: false }).in("id", [...viejas!.map((p) => p.id), nueva!.id]);
  }
});
