import { expect, test } from "@playwright/test";

import { baseLocal, enSoles } from "./base";
import { comando, crearComando, dictar, fiar, saldoDe } from "./dictar";

// Dictar un abono → tarjeta → Confirmar, contra la base local (A6). Cada prueba y cada ancho usan su propio cliente para
// que las corridas en paralelo no se pisen las deudas, y ninguno es de la prueba de venta.

const base = baseLocal();
const clientes = {
  menor: { "s25-412": { id: 2, nombre: "Rosa Quispe" }, "gama-media-360": { id: 3, nombre: "Juguería El Paraíso" } },
  mayor: { "s25-412": { id: 5, nombre: "Carlos Mendoza" }, "gama-media-360": { id: 6, nombre: "Restaurante Mochica" } },
} as const;
type Ancho = keyof typeof clientes.menor;

const abonosDe = async (comandoId: number) => (await base.from("abonos").select("cliente_id, monto, medio_pago").eq("comando_voz_id", comandoId)).data ?? [];

function tarjeta(cliente: { id: number; nombre: string } | null, cambios: Record<string, unknown> = {}) {
  return {
    tipo: "abono",
    cliente: { dicho: cliente ? cliente.nombre.toLowerCase() : "el flaco", elegido: cliente, opciones: [] },
    monto: 80,
    medio: "efectivo",
    dudas: [],
    falta: cliente ? [] : ["cliente"],
    ...cambios,
  };
}

const dictarAbono = (page: Parameters<typeof dictar>[0], comandoId: number, t: ReturnType<typeof tarjeta>) => dictar(page, comandoId, t, "¿Así fue el abono?");

test("abono que no cubre la deuda: dice cómo queda y, con dos toques, lo guarda una vez", async ({ page }, info) => {
  test.slow();
  const cliente = clientes.menor[info.project.name as Ancho];
  await fiar(cliente.id, 100);
  const antes = await saldoDe(cliente.id);
  const comandoId = await crearComando("registrar_abono");
  const hoja = await dictarAbono(page, comandoId, tarjeta(cliente));

  await expect(hoja.getByText(`Con este abono, ${cliente.nombre} te debe`)).toBeVisible();
  await expect(hoja.getByText(enSoles(antes - 80))).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Efectivo" })).toHaveAttribute("aria-pressed", "true");

  const confirmar = hoja.getByRole("button", { name: "Confirmar abono" });
  await confirmar.evaluate((b: HTMLButtonElement) => {
    b.click();
    b.click();
  });
  await expect(page.getByText("Abono guardado")).toBeVisible();
  await expect(page.getByText(`${cliente.nombre} te debe ${enSoles(antes - 80)}`)).toBeVisible();
  await expect(hoja).toBeHidden({ timeout: 5_000 });

  // Lo que quedó en la base: un solo abono, la deuda baja 80 (no 160) y el comando queda enlazado.
  expect(await abonosDe(comandoId)).toEqual([{ cliente_id: cliente.id, monto: 80, medio_pago: "efectivo" }]);
  expect(await saldoDe(cliente.id)).toBe(antes - 80);
  expect(await comando(comandoId)).toEqual({ resultado: "confirmado", latencia_ms: expect.any(Number) });
});

test("abono de más: avisa lo que queda a favor; corregido el monto y el medio, el comando queda corregido", async ({ page }, info) => {
  test.slow();
  const cliente = clientes.mayor[info.project.name as Ancho];
  await fiar(cliente.id, 100);
  const antes = await saldoDe(cliente.id);
  const comandoId = await crearComando("registrar_abono");
  const hoja = await dictarAbono(page, comandoId, tarjeta(cliente, { monto: antes + 70 }));

  // Se deja guardar, pero el error de oído salta a la vista antes de Confirmar.
  await expect(hoja.getByText("Te dio más de lo que debe.")).toBeVisible();
  await expect(hoja.getByText(enSoles(70))).toBeVisible();

  await hoja.getByRole("button", { name: /Toca para cambiar el monto/ }).click();
  const campo = hoja.getByLabel("¿Cuánto te dio?");
  await campo.fill("1,299");
  await expect(hoja.getByText("Escribe el monto así: 45 o 47.50.")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Listo" })).toBeDisabled();
  await campo.fill("50");
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(hoja.getByText(`Con este abono, ${cliente.nombre} te debe`)).toBeVisible();
  await hoja.getByRole("button", { name: "Yape" }).click();

  await hoja.getByRole("button", { name: "Confirmar abono" }).click();
  await expect(page.getByText("Abono guardado")).toBeVisible();

  expect(await abonosDe(comandoId)).toEqual([{ cliente_id: cliente.id, monto: 50, medio_pago: "yape" }]);
  expect(await saldoDe(cliente.id)).toBe(antes - 50);
  expect((await comando(comandoId)).resultado).toBe("corregido");
});

test("sin saber quién pagó no se guarda: se elige de la lista, y descartar avisa qué no guardó", async ({ page }) => {
  test.slow();
  const comandoId = await crearComando("registrar_abono");
  const dudoso = tarjeta(null, {
    cliente: { dicho: "el flaco", elegido: null, opciones: [{ id: 1, nombre: "Luis Paredes" }, { id: 4, nombre: "Bodega Santa Ana" }] },
  });
  const hoja = await dictarAbono(page, comandoId, dudoso);

  await expect(hoja.getByText("Falta elegir quién te pagó.")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Confirmar abono" })).toBeDisabled();

  await hoja.getByRole("button", { name: /¿el flaco\?/ }).click();
  await hoja.getByRole("button", { name: /Luis Paredes/ }).click();
  await expect(hoja.getByRole("button", { name: "Confirmar abono" })).toBeEnabled();

  await hoja.getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByText("No guardé ese abono.")).toBeVisible();
  expect(await abonosDe(comandoId)).toEqual([]);
});

test("respuesta perdida al confirmar: no dice «no se pudo guardar» de lo que se guardó (/chaos 2026-10-31)", async ({ page }, info) => {
  test.slow();
  const cliente = clientes.menor[info.project.name as Ancho];
  const comandoId = await crearComando("registrar_abono");
  const hoja = await dictarAbono(page, comandoId, tarjeta(cliente, { monto: 1 }));
  // El pedido llega al servidor y se guarda, pero la respuesta se pierde en el camino.
  await page.route("**/*", async (r) => (r.request().method() === "POST" && r.request().headers()["next-action"] ? (await r.fetch(), r.abort()) : r.fallback()));
  await hoja.getByRole("button", { name: "Confirmar abono" }).click();
  // Desde ADR-0017 no pide otro toque: queda en el celular y se reintenta solo, sin repetir el abono.
  await expect(page.getByText("Quedó en el celular")).toBeVisible({ timeout: 20_000 });
  expect(await abonosDe(comandoId)).toHaveLength(1);

  // La cola puede estar reintentando justo ahora: ese pedido en vuelo se deja terminar.
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await expect(page.getByText("Listo: se envió lo guardado")).toBeVisible({ timeout: 30_000 });
  expect(await abonosDe(comandoId)).toHaveLength(1);
});
