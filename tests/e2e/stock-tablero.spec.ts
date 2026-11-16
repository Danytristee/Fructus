import { expect, test } from "@playwright/test";

import { baseLocal } from "./base";
import { entrarComo } from "./cuentas";
import { medir } from "./medir";

// El tablero de Stock (A8, /formidable del 5-11; en dos pestañas desde el 14-11; en dos grupos desde el 16-11): «Qué hacer» abre
// con lo de hoy, lo que puede esperar va plegado, y las palabras son de puesto.
// Lee lo que haya en la base local; solo la última prueba crea frutas de prueba, y las deja inactivas.

test.setTimeout(60_000);

test("«Qué hacer» se parte en «Para hoy» y «Puede esperar»: sin número en la pestaña, sin filtros y sin etiqueta roja en cada tarjeta", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/stock");
  await expect(page.getByRole("heading", { name: "Qué hacer hoy" })).toBeVisible({ timeout: 30_000 });

  // Decisión del 16-11, sobre maquetas: el número de la pestaña no cuadraba para quien lo veía por primera vez (2.ª prueba a
  // ciegas) y los filtros, abajo, se encontraban tarde. El título del grupo dice la urgencia una sola vez.
  const pestana = page.getByRole("button", { name: /^Qué hacer/ });
  await expect(pestana).toHaveAttribute("aria-pressed", "true");
  await expect(pestana).toHaveText("Qué hacer");
  await expect(page.getByRole("group", { name: "Filtrar alertas" })).toHaveCount(0);
  await expect(page.locator("li[data-productos]").getByText(/^(Hoy|Mañana|Pronto)$/)).toHaveCount(0);

  // La semilla trae fruta que se acabó o que sobra: hay algo para hoy, a la vista y antes que lo demás.
  const paraHoy = page.getByRole("region", { name: "Para hoy" });
  await expect(paraHoy.locator("li[data-productos]").first()).toBeVisible();
  // Lo que puede esperar va plegado detrás de un botón que dice cuántos avisos son; al tocarlo se ven.
  const puedeEsperar = page.getByRole("region", { name: "Puede esperar" });
  if ((await puedeEsperar.count()) > 0) {
    const abrir = puedeEsperar.getByRole("button", { name: /^Ver \d+ avisos?$/ });
    await expect(puedeEsperar.locator("li[data-productos]")).toHaveCount(0);
    const cuantos = Number((await abrir.innerText()).match(/\d+/)![0]);
    await abrir.click();
    const frutas = await puedeEsperar.locator("li[data-productos]").evaluateAll((t) => new Set(t.flatMap((x) => x.getAttribute("data-productos")!.split(" "))).size);
    expect(frutas, "el botón cuenta avisos, fruta por fruta").toBeLessThanOrEqual(cuantos);
    expect((await paraHoy.boundingBox())!.y).toBeLessThan((await puedeEsperar.boundingBox())!.y);
  }
  await expect(page.getByText("sin avisos", { exact: true })).toHaveCount(0);
});

test("Stock habla como el puesto: «te sobra», no «sobrestock»", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/stock");
  await expect(page.getByRole("heading", { name: "Qué hacer hoy" })).toBeVisible({ timeout: 30_000 });
  // La semilla trae fruta de más: la tarjeta lo dice con palabras de puesto.
  await expect(page.locator("li[data-productos]").filter({ hasText: /^.*Te sobra/ }).first()).toBeVisible();
  await expect(page.getByText(/sobrestock/i)).toHaveCount(0);
});

test("«Qué hacer» cabe en el celular: sin desborde y con controles de 48 px", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/stock");
  await expect(page.getByRole("heading", { name: "Qué hacer hoy" })).toBeVisible({ timeout: 30_000 });
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
    ...viejas!.map((p) => ({ producto_id: p.id, tipo: "ajuste" as const, cantidad: 5, motivo: "prueba e2e", registrado_por: duenio!.id })),
    { producto_id: nueva!.id, tipo: "ajuste" as const, cantidad: 20, motivo: "prueba e2e", registrado_por: duenio!.id },
  ]);
  if (error) throw new Error(`No se pudieron cargar las cajas de prueba: ${error.message}`);
  // La base no acepta al insertar una fecha de hace más de 48 horas (ADR-0019): las cajas entran hoy y después se mueven a hace
  // 10 días. Con la fecha en el insert quedaban como de hoy y la prueba fallaba.
  const { error: alMover } = await base.from("movimientos_stock").update({ fecha: hace10 }).in("producto_id", viejas!.map((p) => p.id));
  if (alMover) throw new Error(`No se pudo mover la fecha de las cajas de prueba: ${alMover.message}`);
  try {
    await entrarComo(page, "duenio");
    await page.goto("/stock");
    await expect(page.getByRole("heading", { name: "Qué hacer hoy" })).toBeVisible({ timeout: 30_000 });
    // «No se están vendiendo» puede esperar: va en el segundo grupo, plegado.
    const puedeEsperar = page.getByRole("region", { name: "Puede esperar" });
    await puedeEsperar.getByRole("button", { name: /^Ver \d+ avisos?$/ }).click();
    const tarjeta = puedeEsperar.locator("li[data-productos]").filter({ hasText: /frutas no se están vendiendo/ });
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
