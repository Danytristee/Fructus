import { expect, test } from "@playwright/test";

import { baseLocal } from "./base";
import { entrarComo } from "./cuentas";
import { verTuStock } from "./stock";

// «Sigue buena» (ADR-0021): la llegada que ya pasó su último día bueno se revisa con un toque desde la hoja «¿por qué?». Queda
// anotado, sale de «para hoy» y pasa a «sale mañana». Contra la base local; cada prueba crea su fruta y la deja inactiva.

test.setTimeout(90_000);
const base = baseLocal();
const DIA_MS = 86_400_000;
/** Las 7 a. m. de Lima (UTC−5) de hace `n` días. */
const haceDias = (n: number) => `${new Date(Date.now() - 5 * 3_600_000 - n * DIA_MS).toISOString().slice(0, 10)}T07:00:00-05:00`;
const hoyEnLima = () => new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);

/** Una papaya (dura 5 días) con 6 cajas que llegaron hace 8: su último día bueno ya pasó. Devuelve su id y su calibre de marca. */
async function papayaPasada() {
  const marca = `E2ESB${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const { data: duenio } = await base.from("perfiles").select("id").eq("rol", "duenio").limit(1).single();
  const { data: fruta, error } = await base.from("productos").insert({ nombre: "Papaya", calibre: marca, unidad: "caja" }).select("id").single();
  if (error) throw new Error(`No se pudo crear la fruta de prueba: ${error.message}`);
  // La base no acepta fechas de hace más de 48 horas al insertar: las cajas entran hoy y se mueven.
  const { data: cajas } = await base.from("movimientos_stock").insert({ producto_id: fruta.id, tipo: "ajuste", cantidad: 6, motivo: "prueba e2e", registrado_por: duenio!.id }).select("id").single();
  await base.from("movimientos_stock").update({ fecha: haceDias(8) }).eq("id", cajas!.id);
  return { id: fruta.id, marca, llegadaDia: haceDias(8).slice(0, 10), duenio: duenio!.id };
}

test("el dueño mira la fruta pasada, toca «Sigue buena», y sale de «para hoy»: queda anotado y pasa a «sale mañana»", async ({ page }) => {
  const papaya = await papayaPasada();
  try {
    await entrarComo(page, "duenio");
    await page.goto("/stock");
    // Antes de revisarla: está entre lo de hoy.
    const paraHoy = page.getByRole("region", { name: "Para hoy" }).locator("li[data-productos]");
    const con = (lista: typeof paraHoy) => lista.filter({ has: page.locator(`xpath=self::*[contains(concat(' ', @data-productos, ' '), ' ${papaya.id} ')]`) });
    await expect(con(paraHoy)).toHaveCount(1, { timeout: 30_000 });

    // La hoja «¿por qué?», desde su fila: pide mirarla y ofrece las dos respuestas, lado a lado.
    await verTuStock(page);
    const fila = page.getByRole("listitem").filter({ hasText: papaya.marca }).last();
    await fila.getByRole("button").first().click();
    await fila.getByRole("list", { name: /^Llegadas de / }).getByRole("button").first().click();
    const hoja = page.getByRole("dialog", { name: new RegExp(papaya.marca) });
    await expect(hoja.getByText("Revísala antes de vender")).toBeVisible({ timeout: 15_000 });
    const sigueBuena = hoja.getByRole("button", { name: "Sigue buena" });
    const seMalogro = hoja.getByRole("button", { name: "Se malogró" });
    await expect(sigueBuena).toBeVisible();
    await expect(seMalogro).toBeVisible();
    // Las piezas de la hoja entran en cascada: se mide cuando ya se asentaron.
    await expect
      .poll(async () => Math.abs((await sigueBuena.boundingBox())!.y - (await seMalogro.boundingBox())!.y), { message: "las dos respuestas van en la misma fila" })
      .toBeLessThan(2);
    for (const boton of [sigueBuena, seMalogro]) {
      const caja = (await boton.boundingBox())!;
      expect(caja.height, "controles de 48 px o más").toBeGreaterThanOrEqual(48);
    }

    // Un toque: la hoja lo dice recién cuando la base respondió, y ya no vuelve a preguntar hoy.
    await sigueBuena.click();
    await expect(hoja.getByText("Sigue buena", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(hoja.getByText("La revisaste hoy. Mañana vuelve a mirarla.")).toBeVisible();
    await expect(hoja.getByRole("button", { name: "Sigue buena" })).toHaveCount(0);
    await expect(seMalogro, "si después se malogra, se anota desde aquí mismo").toBeVisible();

    // En la base: una sola revisión, de esa llegada, de hoy y de quien la tocó.
    const { data: revisiones } = await base.from("revisiones_frescura").select("llegada_dia, llegada_estado, dia, registrado_por").eq("producto_id", papaya.id);
    expect(revisiones).toEqual([{ llegada_dia: papaya.llegadaDia, llegada_estado: null, dia: hoyEnLima(), registrado_por: papaya.duenio }]);

    // Y en «Qué hacer»: ya no está en «Para hoy»; espera en el otro grupo como «sale mañana».
    await page.keyboard.press("Escape");
    await expect(hoja).toBeHidden();
    await page.getByRole("button", { name: "Qué hacer", exact: true }).click();
    await expect(con(paraHoy)).toHaveCount(0);
    const esperan = page.getByRole("region", { name: "Puede esperar" });
    const abrir = esperan.getByRole("button", { name: /^Ver \d+ avisos?/ });
    if (await abrir.isVisible()) await abrir.click();
    // (La misma fruta puede tener otro aviso en ese grupo: «no se está vendiendo». El que importa aquí es el de frescura.)
    await expect(con(esperan.locator("li[data-productos]")).filter({ hasText: /salen? mañana/ })).toHaveCount(1);
  } finally {
    await base.from("productos").update({ activo: false }).eq("id", papaya.id);
  }
});

test("a la llegada que vence hoy no se le pregunta: todavía le queda su día", async ({ page }) => {
  const marca = `E2ESB${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const { data: duenio } = await base.from("perfiles").select("id").eq("rol", "duenio").limit(1).single();
  // Una manzana (dura 30 días) que llegó hoy: lejos de pasarse.
  const { data: fruta } = await base.from("productos").insert({ nombre: "Manzana", calibre: marca, unidad: "caja" }).select("id").single();
  await base.from("movimientos_stock").insert({ producto_id: fruta!.id, tipo: "ajuste", cantidad: 4, motivo: "prueba e2e", registrado_por: duenio!.id });
  try {
    await entrarComo(page, "duenio");
    await page.goto("/stock");
    await verTuStock(page);
    const fila = page.getByRole("listitem").filter({ hasText: marca }).last();
    await fila.getByRole("button").first().click();
    await fila.getByRole("list", { name: /^Llegadas de / }).getByRole("button").first().click();
    const hoja = page.getByRole("dialog", { name: new RegExp(marca) });
    await expect(hoja.getByRole("button", { name: "Se malogró" })).toBeVisible({ timeout: 15_000 });
    await expect(hoja.getByRole("button", { name: "Sigue buena" })).toHaveCount(0);
  } finally {
    await base.from("productos").update({ activo: false }).eq("id", fruta!.id);
  }
});

test("el contador ve el porqué, pero no puede anotar: no tiene los botones", async ({ page }) => {
  const papaya = await papayaPasada();
  try {
    await entrarComo(page, "contador");
    await page.goto("/stock");
    await verTuStock(page);
    const fila = page.getByRole("listitem").filter({ hasText: papaya.marca }).last();
    await fila.getByRole("button").first().click();
    await fila.getByRole("list", { name: /^Llegadas de / }).getByRole("button").first().click();
    const hoja = page.getByRole("dialog", { name: new RegExp(papaya.marca) });
    await expect(hoja.getByText("Revísala antes de vender")).toBeVisible({ timeout: 15_000 });
    await expect(hoja.getByRole("button", { name: "Sigue buena" })).toHaveCount(0);
    await expect(hoja.getByRole("button", { name: "Se malogró" })).toHaveCount(0);
  } finally {
    await base.from("productos").update({ activo: false }).eq("id", papaya.id);
  }
});
