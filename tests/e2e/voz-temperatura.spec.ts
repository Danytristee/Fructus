import { expect, test, type Page } from "@playwright/test";

import { baseLocal } from "./base";
import { entrarComo } from "./cuentas";
import { comando, crearComando, dictar } from "./dictar";

// Dictar la temperatura → tarjeta → Confirmar, y anotarla a mano desde «Hoy», contra la base local (aviso de frescura).

const base = baseLocal();
const lecturasDe = async (comandoId: number) => ((await base.from("temperaturas").select("grados").eq("comando_voz_id", comandoId)).data ?? []).map((t) => Number(t.grados));

const tarjeta = (cambios: Record<string, unknown> = {}) => ({ tipo: "temperatura", grados: 29, ayer: 30, ...cambios });
const dictarTemperatura = (page: Page, comandoId: number, t: ReturnType<typeof tarjeta>) => dictar(page, comandoId, t, "¿Esto marca el termómetro?");

test("temperatura dictada: se ve la cifra y, con dos toques, se guarda una vez", async ({ page }) => {
  test.slow();
  const comandoId = await crearComando("registrar_temperatura");
  const hoja = await dictarTemperatura(page, comandoId, tarjeta());

  await expect(hoja.getByText("29°")).toBeVisible();
  await expect(hoja.getByText("Ayer anotaste 30°.")).toBeVisible();
  await expect(hoja.getByText("Es mucha diferencia")).toHaveCount(0);

  const confirmar = hoja.getByRole("button", { name: "Confirmar temperatura" });
  await confirmar.evaluate((b: HTMLButtonElement) => {
    b.click();
    b.click();
  });
  await expect(page.getByText("Temperatura anotada")).toBeVisible();
  await expect(page.getByText("Hoy hace 29° en el puesto")).toBeVisible();

  expect(await lecturasDe(comandoId)).toEqual([29]);
  expect(await comando(comandoId)).toEqual({ resultado: "confirmado", latencia_ms: expect.any(Number) });
});

test("temperatura corregida: se mueve con los botones y el comando queda como corregido", async ({ page }) => {
  test.slow();
  const comandoId = await crearComando("registrar_temperatura");
  const hoja = await dictarTemperatura(page, comandoId, tarjeta());

  await hoja.getByRole("button", { name: "Un grado más" }).click();
  await hoja.getByRole("button", { name: "Un grado más" }).click();
  await expect(hoja.getByText("31°")).toBeVisible();

  await hoja.getByRole("button", { name: "Confirmar temperatura" }).click();
  await expect(page.getByText("Hoy hace 31° en el puesto")).toBeVisible();

  expect(await lecturasDe(comandoId)).toEqual([31]);
  expect((await comando(comandoId)).resultado).toBe("corregido");
});

test("un número mal oído («290») no se guarda hasta moverlo a una temperatura", async ({ page }) => {
  test.slow();
  const comandoId = await crearComando("registrar_temperatura");
  const hoja = await dictarTemperatura(page, comandoId, tarjeta({ grados: 290 }));

  await expect(hoja.getByText("Eso no parece una temperatura. Muévela a lo que marca el termómetro.")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Confirmar temperatura" })).toBeDisabled();
  expect(await lecturasDe(comandoId)).toEqual([]);

  // Al primer toque vuelve a lo más alto que puede marcar el termómetro, y avisa que se aleja mucho de la de ayer.
  await hoja.getByRole("button", { name: "Un grado menos" }).click();
  await expect(hoja.getByText("45°")).toBeVisible();
  await expect(hoja.getByText("Es mucha diferencia: mira otra vez el termómetro.")).toBeVisible();
});

test("un número absurdo no rompe la tarjeta: los botones y Confirmar siguen en pantalla (/chaos 2026-11-14)", async ({ page }) => {
  test.slow();
  const comandoId = await crearComando("registrar_temperatura");
  // El servidor ya no deja pasar un número así (lib/voz/esquemas.ts); la tarjeta igual no puede romperse si le llega.
  const hoja = await dictarTemperatura(page, comandoId, tarjeta({ grados: 1_000_000_000 }));

  await expect(hoja.getByText("Eso no parece una temperatura. Muévela a lo que marca el termómetro.")).toBeVisible();
  const ancho = page.viewportSize()!.width;
  for (const nombre of ["Un grado menos", "Un grado más", "Confirmar temperatura"]) {
    const caja = (await hoja.getByRole("button", { name: nombre }).boundingBox())!;
    expect(caja.x, `«${nombre}» empieza dentro de la pantalla`).toBeGreaterThanOrEqual(0);
    expect(caja.x + caja.width, `«${nombre}» termina dentro de la pantalla`).toBeLessThanOrEqual(ancho);
  }
  await hoja.getByRole("button", { name: "Un grado menos" }).click();
  await expect(hoja.getByText("45°")).toBeVisible();
  expect(await lecturasDe(comandoId)).toEqual([]);
});

test("un salto grande con la de ayer se avisa, pero la decisión es de la persona", async ({ page }) => {
  test.slow();
  const comandoId = await crearComando("registrar_temperatura");
  const hoja = await dictarTemperatura(page, comandoId, tarjeta({ grados: 39 }));

  await expect(hoja.getByText("Es mucha diferencia: mira otra vez el termómetro.")).toBeVisible();
  await hoja.getByRole("button", { name: "Confirmar temperatura" }).click();
  await expect(page.getByText("Temperatura anotada")).toBeVisible();
  expect(await lecturasDe(comandoId)).toEqual([39]);
});

test("descartar la temperatura avisa qué no guardó y no deja nada en la base", async ({ page }) => {
  test.slow();
  const comandoId = await crearComando("registrar_temperatura");
  const hoja = await dictarTemperatura(page, comandoId, tarjeta());
  await hoja.getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByText("No guardé esa temperatura.")).toBeVisible();
  expect(await lecturasDe(comandoId)).toEqual([]);
});

test("a mano desde «Hoy»: si falta la de hoy, se pide; al anotarla queda guardada", async ({ page }) => {
  test.slow();
  const aMano = async () =>
    (await base.from("temperaturas").select("id, comando:comandos_voz!inner(modelo_stt, intencion)").eq("comando.modelo_stt", "manual").eq("comando.intencion", "registrar_temperatura")).data?.length ?? 0;
  const antes = await aMano();
  await entrarComo(page, "duenio");

  // Otras pruebas anotan la de hoy en paralelo. Para que «Hoy» la pida, las lecturas de hoy se pasan a ayer (no se borran:
  // las otras pruebas las leen por su comando, no por su fecha) y se recarga hasta ver el pedido.
  // Es un renglón de «Lo que pide tu puesto hoy», justo debajo de lo vendido, y dice para qué sirve (/formidable 2026-11-14).
  const pedido = page.getByRole("list", { name: "Lo que pide tu puesto hoy" }).getByRole("button", { name: /^Anota la temperatura/ });
  await expect(async () => {
    // La medianoche de hoy en Lima, que siempre es UTC−5.
    const desde = `${new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10)}T00:00:00-05:00`;
    const { data } = await base.from("temperaturas").select("id, fecha").gte("fecha", desde);
    for (const t of data ?? []) await base.from("temperaturas").update({ fecha: new Date(Date.parse(t.fecha) - 86_400_000).toISOString() }).eq("id", t.id);
    await page.reload();
    await expect(pedido).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 30_000 });

  await expect(pedido).toContainText("Así sé qué fruta sale primero");
  // Se ve sin deslizar, por encima del botón de voz y de su etiqueta: antes empezaba debajo de la pantalla.
  const voz = (await page.locator("#voz-texto").boundingBox())!;
  const renglon = (await pedido.boundingBox())!;
  expect(renglon.y + renglon.height, "el renglón termina antes de la etiqueta del botón de voz").toBeLessThanOrEqual(voz.y);
  await pedido.click();
  const hoja = page.getByRole("dialog", { name: "Anotar la temperatura" });
  await expect(hoja).toBeVisible({ timeout: 15_000 });
  await expect(hoja.getByText("¿Cuánto marca el termómetro?")).toBeVisible();
  await hoja.getByRole("button", { name: "Un grado menos" }).click();
  await hoja.getByRole("button", { name: "Confirmar temperatura" }).click();
  await expect(page.getByText("Temperatura anotada")).toBeVisible();
  await expect.poll(aMano).toBeGreaterThan(antes);
});

test("sin señal: la temperatura dictada queda en el celular y al volver entra una sola vez (ADR-0019)", async ({ page, context }) => {
  test.setTimeout(120_000);
  const comandoId = await crearComando("registrar_temperatura");
  const hoja = await dictarTemperatura(page, comandoId, tarjeta({ grados: 33 }));

  await context.setOffline(true);
  // Dos toques seguidos: se guarda una sola vez en la cola.
  await hoja.getByRole("button", { name: "Confirmar temperatura" }).dblclick();
  await expect(page.getByText("Quedó en el celular")).toBeVisible();
  expect(await lecturasDe(comandoId)).toEqual([]);

  await context.setOffline(false);
  await expect(page.getByText("Listo: se envió lo guardado")).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => lecturasDe(comandoId)).toEqual([33]);
});
