import { expect, test } from "@playwright/test";

import { baseLocal } from "./base";
import { comando, crearComando, dictar } from "./dictar";

// Dictar un gasto → tarjeta → Confirmar, contra la base local (A6).

const base = baseLocal();
const gastosDe = async (comandoId: number) => (await base.from("gastos").select("categoria, monto, descripcion, medio_pago").eq("comando_voz_id", comandoId)).data ?? [];

const tarjeta = (cambios: Record<string, unknown> = {}) => ({
  tipo: "gasto",
  categoria: "personal",
  monto: 50,
  descripcion: "cargador",
  medio: "efectivo",
  ...cambios,
});

const dictarGasto = (page: Parameters<typeof dictar>[0], comandoId: number, t: ReturnType<typeof tarjeta>) => dictar(page, comandoId, t, "¿Así fue el gasto?");

test("gasto dictado: se ve en qué fue y, con dos toques, se guarda una vez", async ({ page }) => {
  test.slow();
  const comandoId = await crearComando("registrar_gasto");
  const hoja = await dictarGasto(page, comandoId, tarjeta());

  await expect(hoja.getByText("S/ 50.00")).toBeVisible();
  await expect(hoja.getByText("«cargador»")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Personal" })).toHaveAttribute("aria-pressed", "true");
  await expect(hoja.getByRole("button", { name: "Efectivo" })).toHaveAttribute("aria-pressed", "true");

  const confirmar = hoja.getByRole("button", { name: "Confirmar gasto" });
  await confirmar.evaluate((b: HTMLButtonElement) => {
    b.click();
    b.click();
  });
  await expect(page.getByText("Gasto guardado")).toBeVisible();
  await expect(page.getByText("S/ 50.00 en personal")).toBeVisible();

  expect(await gastosDe(comandoId)).toEqual([{ categoria: "personal", monto: 50, descripcion: "cargador", medio_pago: "efectivo" }]);
  expect(await comando(comandoId)).toEqual({ resultado: "confirmado", latencia_ms: expect.any(Number) });
});

test("gasto corregido: categoría, monto y medio; el comando queda como corregido", async ({ page }) => {
  test.slow();
  const comandoId = await crearComando("registrar_gasto");
  const hoja = await dictarGasto(page, comandoId, tarjeta());

  await hoja.getByRole("button", { name: "Flete" }).click();
  await hoja.getByRole("button", { name: /S\/ 50.00/ }).click();
  await hoja.getByLabel("¿Cuánto gastaste?").fill("35,50");
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(hoja.getByText("S/ 35.50")).toBeVisible();
  await hoja.getByRole("button", { name: "Yape" }).click();

  await hoja.getByRole("button", { name: "Confirmar gasto" }).click();
  await expect(page.getByText("S/ 35.50 en flete")).toBeVisible();

  expect(await gastosDe(comandoId)).toEqual([{ categoria: "flete", monto: 35.5, descripcion: "cargador", medio_pago: "yape" }]);
  expect((await comando(comandoId)).resultado).toBe("corregido");
});

test("descartar un gasto avisa qué no guardó y no deja nada en la base", async ({ page }) => {
  test.slow();
  const comandoId = await crearComando("registrar_gasto");
  const hoja = await dictarGasto(page, comandoId, tarjeta());
  await hoja.getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByText("No guardé ese gasto.")).toBeVisible();
  expect(await gastosDe(comandoId)).toEqual([]);
});

test("una descripción dictada muy larga no deja la tarjeta sin poder guardarse (/chaos 2026-10-31)", async ({ page }) => {
  test.slow();
  const comandoId = await crearComando("registrar_gasto");
  const hoja = await dictarGasto(page, comandoId, tarjeta({ descripcion: "bolsas para la fruta y ".repeat(15).trim() }));
  await hoja.getByRole("button", { name: "Confirmar gasto" }).click();
  await expect(page.getByText("Gasto guardado")).toBeVisible();
  const [gasto] = await gastosDe(comandoId);
  expect(gasto!.descripcion!.length).toBeLessThanOrEqual(200);
});
