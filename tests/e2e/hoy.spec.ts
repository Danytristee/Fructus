import { expect, test, type Page } from "@playwright/test";

import { baseLocal, enSoles } from "./base";
import { entrarComo } from "./cuentas";

// Lo que se ve en el monto cuando termina de contar (el segundo span oculto al lector; el primero solo reserva el ancho).
const montoVisible = (page: Page, id: string) =>
  page.getByTestId(id).evaluate((e) => e.querySelectorAll("span[aria-hidden]")[1]?.textContent ?? "");

test("«Hoy» muestra lo mismo que resumen_dia() de la base", async ({ page }) => {
  const { data, error } = await baseLocal().rpc("resumen_dia");
  expect(error).toBeNull();
  const vendido = Number(data.ventas_total);
  const cobrado = Number(data.ventas_contado) + Number(data.abonos);
  const porCobrar = Number(data.por_cobrar_total);
  const ventas = Number(data.numero_ventas);
  test.skip(ventas === 0, "La base local no tiene ventas hoy: corre npx supabase db reset");

  await entrarComo(page, "duenio");

  await expect.poll(() => montoVisible(page, "monto-vendido")).toBe(enSoles(vendido));
  await expect.poll(() => montoVisible(page, "monto-cobrado")).toBe(enSoles(cobrado));
  await expect.poll(() => montoVisible(page, "monto-deben")).toBe(enSoles(porCobrar));
  // El lector de pantalla oye el monto final desde el primer momento, no la cuenta.
  await expect(page.getByTestId("monto-vendido").locator(".sr-only")).toHaveText(enSoles(vendido));

  await expect(page.getByText(`${ventas} ventas`, { exact: true })).toBeVisible();
  await expect(page.getByText(`${Number(data.cajas_vendidas)} cajas en ${ventas} ventas`)).toBeVisible();
  await expect(page.getByRole("figure", { name: /Lo vendido a lo largo del día: la hora que más vendiste fue a las/ })).toBeVisible();
});

test("«Hoy» entra sin scroll horizontal, con controles de 48 px y las cifras clave grandes", async ({ page }) => {
  await entrarComo(page, "duenio");
  await expect(page.getByTestId("monto-vendido")).toBeVisible();
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
  );
  const medidas = await page.evaluate(() => ({
    desborde: document.documentElement.scrollWidth - innerWidth,
    chicos: [...document.querySelectorAll("button, a")]
      .filter((e) => !e.closest("nextjs-portal") && !e.getAttribute("aria-label")?.startsWith("Open Next.js"))
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.width < 48 || r.height < 48);
      }).length,
    cifras: ["monto-vendido", "monto-cobrado", "monto-deben"].map((id) =>
      parseFloat(getComputedStyle(document.querySelector(`[data-testid="${id}"] .cifra`)!).fontSize),
    ),
  }));
  expect(medidas.desborde).toBe(0);
  expect(medidas.chicos).toBe(0);
  for (const tamano of medidas.cifras) expect(tamano).toBeGreaterThanOrEqual(28);
});
