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

  // El desglose hace cuadrar las cuentas: contado + crédito = vendido.
  const contado = Number(data.ventas_contado);
  const credito = Number(data.ventas_credito);
  expect(contado + credito).toBeCloseTo(vendido, 2);
  await expect(page.getByTestId("desglose-vendido")).toHaveText(`${enSoles(contado)} al contado y ${enSoles(credito)} al crédito`);
  // Y lo cobrado es contado más abonos, con los dos números a la vista.
  const abonos = Number(data.abonos);
  await expect(page.getByTestId("desglose-cobrado")).toHaveText(
    abonos > 0 ? `${enSoles(contado)} de ventas al contado y ${enSoles(abonos)} de abonos` : `${enSoles(contado)} de ventas al contado`,
  );
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

test("«Lo último» muestra las 5 operaciones más recientes de la base, en orden", async ({ page }) => {
  const base = baseLocal();
  const limaHoy = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  const desde = `${limaHoy}T00:00:00-05:00`;
  const [ventas, abonos, compras, mermas, gastos] = await Promise.all([
    base.from("ventas").select("fecha, cliente:clientes(nombre)").eq("estado", "registrada").gte("fecha", desde),
    base.from("abonos").select("fecha, cliente:clientes(nombre)").gte("fecha", desde),
    base.from("compras").select("fecha, proveedor:proveedores(nombre)").gte("fecha", desde),
    base.from("movimientos_stock").select("fecha").eq("tipo", "merma").gte("fecha", desde),
    base.from("gastos").select("fecha, descripcion").gte("fecha", desde),
  ]);
  type Fila = { fecha: string; titulo: string };
  const nombre = (r: unknown) => (r as { nombre?: string } | null)?.nombre;
  const todas: Fila[] = [
    ...(ventas.data ?? []).map((v) => ({ fecha: v.fecha, titulo: nombre(v.cliente) ?? "Venta al paso" })),
    ...(abonos.data ?? []).map((a) => ({ fecha: a.fecha, titulo: nombre(a.cliente) ?? "Abono" })),
    ...(compras.data ?? []).map((c) => ({ fecha: c.fecha, titulo: nombre(c.proveedor) ?? "Compra" })),
    ...(mermas.data ?? []).map((m) => ({ fecha: m.fecha, titulo: "Merma" })),
    ...(gastos.data ?? []).map((g) => ({ fecha: g.fecha, titulo: g.descripcion ?? "Gasto" })),
  ];
  const esperadas = todas.sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha)).slice(0, 5).map((f) => f.titulo);
  test.skip(esperadas.length === 0, "La base local no tiene operaciones hoy: corre npx supabase db reset");

  await entrarComo(page, "duenio");
  const filas = page.getByTestId("lo-ultimo").getByRole("listitem");
  await expect(filas).toHaveCount(esperadas.length);
  await expect(filas.locator("span.font-extrabold").first()).toBeVisible();
  const titulos = await filas.evaluateAll((lis) => lis.map((li) => li.querySelector(".leading-tight")?.textContent ?? ""));
  expect(titulos).toEqual(esperadas);

  await page.getByRole("link", { name: "Ver todo" }).click();
  await expect(page).toHaveURL("/ventas");
});

test("«Te deben» se toca y lleva a ver quién te debe", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.getByRole("link", { name: /Te deben.*Ver quién te debe/ }).click();
  await expect(page).toHaveURL("/clientes");
});
