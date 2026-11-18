import { expect, test } from "@playwright/test";

import { baseLocal } from "./base";
import { abastecer, comando, crearComando, dictar, stockDe } from "./dictar";
import { distintas, microfonoControlado, responder, sintetizadorDePrueba, terminarFrase } from "./manos-libres";

// Contar por voz (ADR-0028): «conté 8 de …, dos se malograron» abre la tarjeta de conteo con lo que dijo y lo que decía la app al
// dictar; con manos libres se lee y «confirmo» guarda. La voz se simula (/api/voz); el conteo pasa por registrar_conteo de verdad.

test.setTimeout(90_000);
const base = baseLocal();
const creadas: number[] = [];
test.afterAll(async () => {
  if (creadas.length) await base.from("productos").update({ activo: false }).in("id", creadas);
});

async function fruta(cajas: number) {
  const { data } = await base.from("productos").insert({ nombre: `Fruta de voz ${Date.now()}-${Math.floor(Math.random() * 1e4)}`, unidad: "caja" }).select("id, nombre").single();
  creadas.push(data!.id);
  await abastecer(data!.id, cajas);
  return data!;
}

const tarjeta = (f: { id: number; nombre: string }, stock: number, causa: string | null = "se_malogro") => ({
  tipo: "conteo",
  producto: { dicho: f.nombre.toLowerCase(), elegido: f, opciones: [] },
  contado: 8,
  causa,
  stock,
  dudas: [],
  falta: [],
});

test("dictado con su causa: la tarjeta trae lo contado y la diferencia, y se guarda como merma", async ({ page }) => {
  const f = await fruta(10);
  const comandoId = await crearComando("registrar_conteo");
  const hoja = await dictar(page, comandoId, tarjeta(f, 10), "¿Así fue el conteo?");
  await expect(hoja.locator("output")).toHaveText("8");
  await expect(hoja.getByText("Faltan 2 cajas.")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Se malogró" })).toHaveAttribute("aria-pressed", "true");
  await hoja.getByRole("button", { name: "Confirmar conteo" }).click();
  await expect(page.getByText("Conteo guardado")).toBeVisible();
  expect(await stockDe(f.id)).toBe(8);
  const { data } = await base.from("conteos").select("contado, diferencia, causa, comando_voz_id").eq("producto_id", f.id).single();
  expect(data).toEqual({ contado: 8, diferencia: -2, causa: "se_malogro", comando_voz_id: comandoId });
  expect((await comando(comandoId)).resultado).toBe("confirmado");
});

test.describe("con manos libres", () => {
  test.beforeEach(async ({ page }) => {
    await microfonoControlado(page);
    await sintetizadorDePrueba(page, { manosLibres: true });
  });

  test("lo lee con la diferencia y la causa, y «confirmo» lo guarda por voz", async ({ page }) => {
    const f = await fruta(10);
    await page.route("/api/voz/respuesta", (r) => r.fulfill({ json: { respuesta: "confirmar" } }));
    const comandoId = await crearComando("registrar_conteo");
    const hoja = await dictar(page, comandoId, tarjeta(f, 10), "¿Así fue el conteo?");
    await expect.poll(() => distintas(page)).toEqual([`Contaste 8 cajas de ${f.nombre}. La app decía 10 cajas: faltan 2 cajas, se malograron. ¿Confirmo?`]);
    await terminarFrase(page);
    await expect(hoja.getByRole("status").filter({ hasText: "di «confirmo»" })).toBeVisible();
    await responder(page);
    await expect(page.getByText("Conteo guardado")).toBeVisible();
    const { data } = await base.from("comandos_voz").select("resultado, confirmado_por").eq("id", comandoId).single();
    expect(data).toEqual({ resultado: "confirmado", confirmado_por: "voz" });
  });

  test("sin causa no se confirma hablando: lo dice y espera el toque", async ({ page }) => {
    const f = await fruta(10);
    const comandoId = await crearComando("registrar_conteo");
    const hoja = await dictar(page, comandoId, tarjeta(f, 10, null), "¿Así fue el conteo?");
    await expect.poll(() => distintas(page)).toEqual([`Contaste 8 cajas de ${f.nombre}. La app decía 10 cajas: faltan 2 cajas. Elige por qué en la tarjeta.`]);
    await terminarFrase(page);
    await expect(hoja.getByRole("button", { name: "Confirmar conteo" })).toBeDisabled();
    await hoja.getByRole("button", { name: "No sé" }).click();
    await hoja.getByRole("button", { name: "Confirmar conteo" }).click();
    await expect(page.getByText("Conteo guardado")).toBeVisible();
  });
});
