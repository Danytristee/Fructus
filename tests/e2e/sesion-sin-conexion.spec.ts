import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

import { entornoLocal } from "./base";
import { entrarComo } from "./cuentas";

// Una caída de la base no es una cuenta sin acceso (CLAUDE.md, principio 8). Con la API de la base local detenida,
// quien entra debe leer «No pudimos conectar con tu cuaderno» y poder reintentar; nunca «Tu cuenta todavía no está activa»
// ni un «no tienes acceso» por permisos que no se pudieron leer.
//
// Detiene el contenedor REST de la base local, y mientras está caído cualquier otra prueba que corra a la vez falla sin
// culpa de la app. Por eso se salta sola si hay más de un worker: córrela de a una, y sin que otra sesión use la misma base:
//   pnpm e2e tests/e2e/sesion-sin-conexion.spec.ts --workers=1
const API = "supabase_rest_fructus";
const AVISO = "No pudimos conectar con tu cuaderno";

test.describe.configure({ mode: "serial" });
// Cada prueba para la API, espera a que no conteste, la levanta y espera a que conteste de nuevo: tarda.
test.setTimeout(120_000);

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.config.workers > 1, "Detiene la base local: córrela con --workers=1 (ver el comentario de arriba).");
});

function docker(...args: string[]) {
  execFileSync("docker", args, { stdio: "pipe", timeout: 60_000 });
}

/** Levanta la API y espera a que PostgREST conteste de verdad (docker start vuelve antes de que esté lista). */
async function levantarApi() {
  docker("start", API);
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: clave } = entornoLocal();
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`${url}/rest/v1/`, { headers: { apikey: clave! }, signal: AbortSignal.timeout(2_000) })).status;
        } catch {
          return 0;
        }
      },
      { timeout: 30_000, intervals: [500] },
    )
    .toBe(200);
}

// Pase lo que pase en una prueba, la base local no puede quedar caída: los demás la usan.
test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== "skipped") await levantarApi();
});

async function sinDesborde(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
}

test("sin conexión con la base, dice que no pudo conectar (no «cuenta no activa») y al volver la señal se reintenta", async ({ page }) => {
  await entrarComo(page, "duenio");
  await expect(page.getByText("Cobraste")).toBeVisible();

  docker("stop", API);
  await page.reload();

  const aviso = page.getByRole("alert").filter({ hasText: AVISO });
  await expect(aviso).toBeVisible({ timeout: 20_000 });
  await expect(aviso).toContainText("Revisa tu señal");
  await expect(page.getByText("Tu cuenta todavía no está activa")).toHaveCount(0);
  await expect(page.getByText("Pídele al dueño del puesto")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Botón de voz" })).toHaveCount(0);

  // El botón se alcanza con el pulgar: 48 px como mínimo, y la pantalla no se sale de los bordes.
  const reintentar = aviso.getByRole("button", { name: "Volver a intentar" });
  const caja = await reintentar.boundingBox();
  expect(caja!.height).toBeGreaterThanOrEqual(48);
  expect(caja!.width).toBeGreaterThanOrEqual(48);
  await sinDesborde(page);

  // Reintentar con la base todavía caída: sigue diciendo lo mismo y el botón vuelve a quedar usable.
  await reintentar.click();
  await expect(reintentar).toBeEnabled({ timeout: 20_000 });
  await expect(aviso).toBeVisible();
  await expect(page.getByText("Tu cuenta todavía no está activa")).toHaveCount(0);

  // Vuelve la señal: el mismo botón trae la pantalla de siempre, sin recargar a mano.
  await levantarApi();
  await reintentar.click();
  await expect(page.getByText("Cobraste")).toBeVisible({ timeout: 20_000 });
  await expect(aviso).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Botón de voz" })).toHaveCount(1);
});

test("con la base caída, Ajustes no dice «es solo para el dueño» a quien sí es el dueño", async ({ page }) => {
  await entrarComo(page, "duenio");
  await expect(page.getByText("Cobraste")).toBeVisible();
  await page.getByRole("button", { name: /^Menú/ }).click();
  const menu = page.getByRole("dialog", { name: "Más" });
  await expect(menu).toBeVisible();

  // Navegar dentro de la app no vuelve a pedir el marco: la pantalla de Ajustes es la que pregunta por el perfil.
  docker("stop", API);
  await menu.getByRole("link", { name: "Ajustes" }).click();
  await expect(page.getByRole("alert").filter({ hasText: AVISO })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Ajustes es solo para el dueño o el administrador")).toHaveCount(0);
  await expect(page.getByText("Tu cuenta todavía no está activa")).toHaveCount(0);
  await sinDesborde(page);

  await levantarApi();
  await page.getByRole("button", { name: "Volver a intentar" }).click();
  await expect(page.getByText("Tu catálogo y tu equipo")).toBeVisible({ timeout: 20_000 });
});
