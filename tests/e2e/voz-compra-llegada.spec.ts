import { expect, test, type Page } from "@playwright/test";

import { baseLocal } from "./base";
import { comando, crearComando, dictar } from "./dictar";

// «¿Cómo llegó?» en la compra (aviso de frescura): verde, pintón o maduro, y cuánto va a aguantar. Contra la base local.
// Cada prueba crea sus frutas (con su calibre de marca) y al terminar se desactivan (nunca se borran datos).

const base = baseLocal();
const creadas: number[] = [];
test.afterAll(async () => {
  if (creadas.length) await base.from("productos").update({ activo: false }).in("id", creadas);
});

/** Una fruta de prueba. El nombre decide si madura en la caja («Mango» sí, «Piña» no); el calibre la hace única. */
async function nuevaFruta(nombre: string) {
  const calibre = `E2E${Date.now()}${Math.floor(Math.random() * 10_000)}`;
  const { data, error } = await base.from("productos").insert({ nombre, calibre, unidad: "caja" }).select("id").single();
  if (error || !data) throw new Error(`No se pudo crear la fruta de prueba: ${error?.message}`);
  creadas.push(data.id);
  return { id: data.id, nombre: `${nombre} cal. ${calibre}` };
}

type Fruta = { id: number; nombre: string };
const item = (fruta: Fruta, estado: string | null) => ({ producto: { dicho: fruta.nombre.toLowerCase(), elegido: fruta, opciones: [] }, cantidad: 30, costo: { valor: 32, sugerido: false }, estado });
const tarjeta = (items: ReturnType<typeof item>[]) => ({ tipo: "compra", proveedor: { dicho: null, elegido: null, opciones: [] }, items, condicion: "contado", dudas: [], falta: [], temperatura: 30 });
const dictarCompra = (page: Page, comandoId: number, t: ReturnType<typeof tarjeta>) => dictar(page, comandoId, t, "¿Así fue la compra?");

/** Cómo quedó cada fruta de esa compra en su entrada de stock. */
async function entradasDe(comandoId: number) {
  const { data } = await base.from("movimientos_stock").select("producto_id, cantidad, estado_llegada").eq("comando_voz_id", comandoId).eq("tipo", "entrada_compra").order("id");
  return (data ?? []).map((m) => ({ producto: m.producto_id, cajas: Number(m.cantidad), estado: m.estado_llegada }));
}

test("compra de una fruta que madura: se ve cómo llegó y cuánto aguanta; cambiarlo queda guardado como corrección", async ({ page }) => {
  test.slow();
  const mango = await nuevaFruta("Mango");
  const comandoId = await crearComando("registrar_compra");
  const hoja = await dictarCompra(page, comandoId, tarjeta([item(mango, "verde")]));

  // Lo que se dijo viene marcado, y dice con qué temperatura cuenta y cuántos días aguanta.
  const grupo = hoja.getByRole("group", { name: "¿Cómo llegó?" });
  await expect(grupo.getByRole("button", { name: "Verde" })).toHaveAttribute("aria-pressed", "true");
  await expect(hoja.getByText(/Con 30° aguanta \d+ días, hasta/)).toBeVisible();
  const verde = await hoja.getByText(/Con 30° aguanta/).innerText();

  // Maduro aguanta menos: la frase cambia al tocarlo.
  await grupo.getByRole("button", { name: "Maduro" }).click();
  await expect(grupo.getByRole("button", { name: "Maduro" })).toHaveAttribute("aria-pressed", "true");
  await expect(hoja.getByText(/Con 30° aguanta/)).not.toHaveText(verde);

  await hoja.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(page.getByText("Compra guardada")).toBeVisible();

  expect(await entradasDe(comandoId)).toEqual([{ producto: mango.id, cajas: 30, estado: "maduro" }]);
  expect((await comando(comandoId)).resultado).toBe("corregido");
});

test("si no se dijo cómo llegó, se dice que se cuenta como pintón y se guarda sin inventarlo", async ({ page }) => {
  test.slow();
  const mango = await nuevaFruta("Mango");
  const comandoId = await crearComando("registrar_compra");
  const hoja = await dictarCompra(page, comandoId, tarjeta([item(mango, null)]));

  await expect(hoja.getByText(/Si no eliges, cuento como pintón\./)).toBeVisible();
  for (const estado of ["Verde", "Pintón", "Maduro"]) await expect(hoja.getByRole("button", { name: estado })).toHaveAttribute("aria-pressed", "false");
  await hoja.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(page.getByText("Compra guardada")).toBeVisible();

  expect(await entradasDe(comandoId)).toEqual([{ producto: mango.id, cajas: 30, estado: null }]);
  expect((await comando(comandoId)).resultado).toBe("confirmado");
});

test("a una fruta que no madura en la caja no se le pregunta, y no se guarda aunque se haya dicho", async ({ page }) => {
  test.slow();
  const pina = await nuevaFruta("Piña");
  const comandoId = await crearComando("registrar_compra");
  const hoja = await dictarCompra(page, comandoId, tarjeta([item(pina, "verde")]));

  await expect(hoja.getByRole("group", { name: "¿Cómo llegó?" })).toHaveCount(0);
  await hoja.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(page.getByText("Compra guardada")).toBeVisible();
  expect(await entradasDe(comandoId)).toEqual([{ producto: pina.id, cajas: 30, estado: null }]);
});

test("con varias frutas, cómo llegó se elige dentro de cada una y se ve en su fila", async ({ page }) => {
  test.slow();
  const mango = await nuevaFruta("Mango");
  const palta = await nuevaFruta("Palta");
  const comandoId = await crearComando("registrar_compra");
  const hoja = await dictarCompra(page, comandoId, tarjeta([item(mango, null), item(palta, "maduro")]));

  // En la tarjeta no hay tres botones por fruta: la que ya trae cómo llegó lo dice en su fila.
  await expect(hoja.getByRole("group", { name: "¿Cómo llegó?" })).toHaveCount(0);
  await expect(hoja.getByText("· maduras")).toBeVisible();

  await hoja.getByRole("button", { name: new RegExp(`30 cajas de ${mango.nombre}`) }).click();
  await hoja.getByRole("group", { name: "¿Cómo llegó?" }).getByRole("button", { name: "Verde" }).click();
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(hoja.getByText("· verdes")).toBeVisible();

  await hoja.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(page.getByText("Compra guardada")).toBeVisible();
  expect(await entradasDe(comandoId)).toEqual([
    { producto: mango.id, cajas: 30, estado: "verde" },
    { producto: palta.id, cajas: 30, estado: "maduro" },
  ]);
});
