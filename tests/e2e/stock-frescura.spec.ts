import { expect, test } from "@playwright/test";

import { baseLocal } from "./base";
import { entrarComo } from "./cuentas";
import { verTuStock } from "./stock";

// El aviso de frescura en Stock y en «Hoy»: con el calor de cada día, lo que tiene que salir hoy. Contra la base local.
// Cada prueba crea sus frutas (con su calibre de marca) y las deja inactivas.

test.setTimeout(90_000);
const base = baseLocal();
const DIA_MS = 86_400_000;
/** Las 7 a. m. de Lima (UTC−5) de hace `n` días. */
const haceDias = (n: number) => `${new Date(Date.now() - 5 * 3_600_000 - n * DIA_MS).toISOString().slice(0, 10)}T07:00:00-05:00`;

async function idDelDuenio() {
  const { data } = await base.from("perfiles").select("id").eq("rol", "duenio").limit(1).single();
  return data!.id;
}

/** Cajas que llegaron hace `dias` días. La base no acepta fechas de hace más de 48 horas al insertar: entran hoy y se mueven. */
async function llegaron(productoId: number, cajas: number, dias: number, duenio: string) {
  const { data, error } = await base.from("movimientos_stock").insert({ producto_id: productoId, tipo: "ajuste", cantidad: cajas, motivo: "prueba e2e", registrado_por: duenio }).select("id").single();
  if (error) throw new Error(`No se pudieron cargar las cajas de prueba: ${error.message}`);
  await base.from("movimientos_stock").update({ fecha: haceDias(dias) }).eq("id", data.id);
}

/** Que los tres días anteriores tengan temperatura de calor (30°). Si ya la tienen (la semilla trae una semana de calor), no se toca. */
async function calorEstosDias(duenio: string) {
  for (const n of [1, 2, 3]) {
    const dia = haceDias(n).slice(0, 10);
    const { data } = await base.from("v_temperatura_dia").select("grados").eq("dia", dia).maybeSingle();
    if (data) continue;
    const { data: nueva } = await base.from("temperaturas").insert({ grados: 30, registrado_por: duenio }).select("id").single();
    await base.from("temperaturas").update({ fecha: haceDias(n) }).eq("id", nueva!.id);
  }
}

test("con calor, la papaya que llegó hace 3 días tiene que salir hoy; la manzana del mismo día, no", async ({ page }) => {
  const duenio = await idDelDuenio();
  const marca = `E2E${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const { data: frutas } = await base
    .from("productos")
    .insert([
      { nombre: "Papaya", calibre: marca, unidad: "caja" },
      { nombre: "Manzana", calibre: marca, unidad: "caja" },
    ])
    .select("id, nombre");
  const papaya = frutas!.find((f) => f.nombre === "Papaya")!.id;
  const manzana = frutas!.find((f) => f.nombre === "Manzana")!.id;
  try {
    await llegaron(papaya, 8, 3, duenio);
    await llegaron(manzana, 8, 3, duenio);
    await calorEstosDias(duenio);

    await entrarComo(page, "duenio");
    // «Hoy» lo dice primero: cuántas frutas tienen que salir.
    await expect(page.getByText(/frutas? tienen? que salir hoy/).first()).toBeVisible({ timeout: 30_000 });

    await page.goto("/stock");
    await expect(page.getByRole("heading", { name: "Qué hacer hoy" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Por malograrse/ }).click();
    const tarjetas = page.locator("li[data-productos]");
    const con = (id: number) => tarjetas.filter({ has: page.locator(`xpath=self::*[contains(concat(' ', @data-productos, ' '), ' ${id} ')]`) });
    // La papaya (dura 5 días a temperatura normal) está en una tarjeta con la etiqueta «Hoy» y la frase nueva.
    const dePapaya = con(papaya);
    await expect(dePapaya).toHaveCount(1);
    await expect(dePapaya.getByText("Hoy", { exact: true })).toBeVisible();
    await expect(dePapaya).toContainText(/tienen? que salir hoy/);
    await expect(dePapaya).toContainText("Véndel"); // «Véndelo hoy…» o «Véndelas hoy…», si va junto a otras
    // La manzana (dura 30) llegó el mismo día y con el mismo calor: no tiene nada que avisar.
    await expect(con(manzana)).toHaveCount(0);

    // El porqué, a un toque desde el aviso: qué gastó cada día y qué hacer.
    await dePapaya.getByRole("button").filter({ hasText: new RegExp(`${marca}|¿Por qué\\?`) }).first().click();
    const hoja = page.getByRole("dialog", { name: new RegExp(marca) });
    await expect(hoja).toBeVisible({ timeout: 15_000 });
    await expect(hoja.getByText("Tiene que salir hoy")).toBeVisible();
    await expect(hoja.getByText(/8 cajas · llegaron el /)).toBeVisible();
    await expect(hoja.getByRole("heading", { name: "Lo que gastó cada día" })).toBeVisible();
    await expect(hoja.getByText(/El calor le quitó \d+ días?\.|no le quitó ningún día/)).toBeVisible();
    await expect(hoja.getByRole("button", { name: "Se malogró" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(hoja).toBeHidden();

    // «Tu stock»: los totales y la lista; la fila de la papaya dice lo mismo con palabras y abre el mismo porqué desde su llegada.
    await verTuStock(page);
    const fila = page.getByRole("listitem").filter({ hasText: marca }).filter({ hasText: "Sale hoy" }).first();
    await fila.getByRole("button").first().click();
    const llegada = fila.getByRole("list", { name: /^Llegadas de Papaya/ }).getByRole("button");
    await expect(llegada).toHaveCount(1);
    await expect(llegada).toContainText(/8 cajas de/);
    await expect(llegada).toContainText("Sale hoy");
    await llegada.click();
    await expect(hoja).toBeVisible();
    await expect(hoja.getByText("Tiene que salir hoy")).toBeVisible();
  } finally {
    // No se borra (CLAUDE.md): las frutas de prueba quedan inactivas.
    await base.from("productos").update({ activo: false }).in("id", [papaya, manzana]);
  }
});

test("el clima del puesto está al final de «Qué hacer», y desde ahí se anota o se corrige la de hoy", async ({ page }) => {
  await calorEstosDias(await idDelDuenio());
  await entrarComo(page, "duenio");
  await page.goto("/stock");
  await expect(page.getByRole("heading", { name: "Qué hacer hoy" })).toBeVisible({ timeout: 30_000 });

  const clima = page.getByRole("region", { name: "El clima del puesto" });
  await expect(clima.getByText("En el puesto hoy")).toBeVisible();
  // La semana en barras, con cada día dicho también para el lector de pantalla.
  await expect(clima.getByRole("img", { name: /^Temperatura de la semana: / })).toBeVisible();
  // Va después de lo que hay que hacer: lo principal no queda debajo de la temperatura.
  const avisos = (await page.getByRole("group", { name: "Filtrar alertas" }).boundingBox())!;
  expect((await clima.boundingBox())!.y).toBeGreaterThan(avisos.y);

  // Otras pruebas anotan la de hoy en paralelo: el botón dice «Anotar» o «Corregir» según el caso, y abre la misma hoja.
  await clima.getByRole("button", { name: /^(Anotar la temperatura|Corregir la de hoy)$/ }).click();
  const hoja = page.getByRole("dialog", { name: "Anotar la temperatura" });
  await expect(hoja).toBeVisible({ timeout: 15_000 });
  await expect(hoja.getByText("¿Cuánto marca el termómetro?")).toBeVisible();
  await hoja.getByRole("button", { name: "Descartar" }).click();
  await expect(hoja).toBeHidden();
});
