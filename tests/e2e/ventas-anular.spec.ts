import { expect, test, type Locator, type Page } from "@playwright/test";

import { baseLocal, enSoles, invariantes } from "./base";
import { entrarComo, type Rol } from "./cuentas";
import { fiar, saldoDe } from "./dictar";

// Anular una venta (A8): solo dueño y administrador, siempre con motivo y con sus consecuencias a la vista. La fruta vuelve al
// stock y la deuda baja una sola vez, aunque se toque dos veces, se pierda la respuesta o dos personas lo hagan a la vez.
// Cada prueba crea su propio cliente y su propia venta.

test.setTimeout(90_000);
const base = baseLocal();

async function ventaAlCredito(monto: number) {
  const nombre = `Cliente de anular ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const { data: c, error } = await base.from("clientes").insert({ nombre }).select("id, nombre").single();
  if (error || !c) throw new Error(`No se pudo crear el cliente: ${error?.message}`);
  await fiar(c.id, monto);
  const { data: v } = await base.from("ventas").select("id").eq("cliente_id", c.id).single();
  return { cliente: c, ventaId: v!.id };
}

const venta = async (id: number) =>
  (await base.from("ventas").select("estado, motivo_anulacion, anulada_por, anulada_en").eq("id", id).single()).data!;
const devoluciones = async (ventaId: number) =>
  (await base.from("movimientos_stock").select("cantidad").eq("venta_id", ventaId).eq("tipo", "devolucion")).data ?? [];

async function abrirDetalle(page: Page, nombre: string, rol: Rol = "duenio") {
  await entrarComo(page, rol);
  await page.goto("/ventas");
  await page.getByRole("button", { name: new RegExp(nombre) }).click();
  const hoja = page.getByRole("dialog", { name: "Detalle de la venta" });
  await expect(hoja).toBeVisible({ timeout: 15_000 });
  return hoja;
}

async function irAAnular(hoja: Locator) {
  await hoja.getByRole("button", { name: "Anular esta venta" }).click();
  await expect(hoja.getByText(/¿Anular esta venta de/)).toBeVisible();
}

test("anular con motivo: dice qué va a pasar, devuelve la fruta, baja la deuda una sola vez con dos toques y deja quién y por qué", async ({ page }) => {
  const { cliente, ventaId } = await ventaAlCredito(100);
  expect(await saldoDe(cliente.id)).toBe(100);
  const hoja = await abrirDetalle(page, cliente.nombre);
  await irAAnular(hoja);

  // Antes de confirmar se dice qué pasa; sin motivo no se deja.
  await expect(hoja.getByText(`¿Anular esta venta de ${enSoles(100)}?`)).toBeVisible();
  await expect(hoja.getByRole("list", { name: "Qué pasa al anular" })).toContainText("Vuelven al stock 1 caja de mango kent.");
  await expect(hoja.getByRole("list", { name: "Qué pasa al anular" })).toContainText(`${cliente.nombre} te debe ${enSoles(100)} menos.`);
  await expect(hoja.getByText("Elige por qué la anulas.")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Anular la venta" })).toBeDisabled();

  await hoja.getByRole("button", { name: "Se registró dos veces" }).click();
  await hoja.getByRole("button", { name: "Anular la venta" }).evaluate((b: HTMLButtonElement) => {
    b.click();
    b.click();
  });
  await expect(page.getByText("Venta anulada").first()).toBeVisible();
  await expect(hoja).toBeHidden({ timeout: 6_000 });

  // Lo que quedó en la base: anulada, con el motivo y quién; una sola devolución (no dos); la deuda en cero.
  const v = await venta(ventaId);
  expect(v).toMatchObject({ estado: "anulada", motivo_anulacion: "Se registró dos veces", anulada_por: expect.any(String), anulada_en: expect.any(String) });
  expect(await devoluciones(ventaId)).toEqual([{ cantidad: 1 }]);
  expect(await saldoDe(cliente.id)).toBe(0);
  expect(invariantes()).toBe("limpias");

  // En la pantalla: sigue en el historial, marcada «Anulada», fuera del conteo de ventas, y su detalle dice cuándo, quién y por qué.
  const fila = page.getByRole("button", { name: new RegExp(cliente.nombre) });
  await expect(fila).toContainText("Anulada");
  await fila.click();
  const detalle = page.getByRole("dialog", { name: "Detalle de la venta" });
  await expect(detalle.getByRole("note")).toContainText("Venta anulada");
  await expect(detalle.getByRole("note")).toContainText("por Dueño de prueba");
  await expect(detalle.getByRole("note")).toContainText("Motivo: «Se registró dos veces».");
  await expect(detalle.getByRole("button", { name: "Anular esta venta" })).toHaveCount(0);
});

test("lo anulado se ve pero no cuenta: el resumen de «Hoy» baja lo que valía la venta", async ({ page }) => {
  const { cliente } = await ventaAlCredito(120);
  await entrarComo(page, "duenio");
  await page.goto("/ventas");
  const resumen = page.getByTestId("resumen-periodo");
  const { data: antes } = await base.rpc("resumen_dia");
  const totalAntes = Number((antes as { ventas_total: number }).ventas_total);
  await expect(resumen).toContainText(enSoles(totalAntes));

  await page.getByRole("button", { name: new RegExp(cliente.nombre) }).click();
  const hoja = page.getByRole("dialog", { name: "Detalle de la venta" });
  await irAAnular(hoja);
  await hoja.getByRole("button", { name: "Me equivoqué al registrarla" }).click();
  await hoja.getByRole("button", { name: "Anular la venta" }).click();
  await expect(page.getByText("Venta anulada").first()).toBeVisible();
  await expect(hoja).toBeHidden({ timeout: 6_000 });

  const { data: despues } = await base.rpc("resumen_dia");
  const totalDespues = Number((despues as { ventas_total: number }).ventas_total);
  expect(totalDespues).toBe(Math.round((totalAntes - 120) * 100) / 100);
  await expect(resumen).toContainText(enSoles(totalDespues));
});

test("«Otro motivo» pide contarlo (3 letras o más) y guarda lo que se escribió, sin espacios de más", async ({ page }) => {
  const { cliente, ventaId } = await ventaAlCredito(80);
  const hoja = await abrirDetalle(page, cliente.nombre);
  await irAAnular(hoja);
  await hoja.getByRole("button", { name: "Otro motivo" }).click();
  await expect(hoja.getByRole("button", { name: "Anular la venta" })).toBeDisabled();
  await hoja.getByLabel("Cuéntalo en pocas palabras").fill("ay");
  await expect(hoja.getByText("Cuéntalo con 3 letras o más.").first()).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Anular la venta" })).toBeDisabled();
  await hoja.getByLabel("Cuéntalo en pocas palabras").fill("  se   cayó la caja  ");
  await expect(hoja.getByRole("button", { name: "Anular la venta" })).toBeEnabled();
  await hoja.getByRole("button", { name: "Anular la venta" }).click();
  await expect(page.getByText("Venta anulada").first()).toBeVisible();
  expect((await venta(ventaId)).motivo_anulacion).toBe("se cayó la caja");
});

test("«No, dejarla» y «Volver a la venta» no anulan nada", async ({ page }) => {
  const { cliente, ventaId } = await ventaAlCredito(60);
  const hoja = await abrirDetalle(page, cliente.nombre);
  await irAAnular(hoja);
  await hoja.getByRole("button", { name: "Se registró dos veces" }).click();
  await hoja.getByRole("button", { name: "No, dejarla" }).click();
  await expect(hoja.getByRole("list", { name: "Fruta de la venta" })).toBeVisible();
  await irAAnular(hoja);
  await hoja.getByRole("button", { name: "Volver a la venta" }).click();
  await expect(hoja.getByRole("button", { name: "Anular esta venta" })).toBeVisible();
  expect((await venta(ventaId)).estado).toBe("registrada");
  expect(await devoluciones(ventaId)).toEqual([]);
  expect(await saldoDe(cliente.id)).toBe(60);
});

test("respuesta perdida al anular: no dice que no se hizo, y al reintentar no devuelve la fruta otra vez", async ({ page }) => {
  const { cliente, ventaId } = await ventaAlCredito(90);
  const hoja = await abrirDetalle(page, cliente.nombre);
  await irAAnular(hoja);
  await hoja.getByRole("button", { name: "El cliente la devolvió" }).click();

  // El pedido llega al servidor y se anula, pero la respuesta se pierde en el camino.
  await page.route("**/*", async (r) => (r.request().method() === "POST" && r.request().headers()["next-action"] ? (await r.fetch(), r.abort()) : r.fallback()));
  await hoja.getByRole("button", { name: "Anular la venta" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("La señal no respondió y no sé si se guardó. Toca Anular la venta otra vez: no se va a repetir.");
  expect(await devoluciones(ventaId)).toHaveLength(1);

  // La persona toca otra vez, como le dice la hoja: ya estaba anulada por ella con ese motivo, así que está hecho.
  await page.unrouteAll();
  await hoja.getByRole("button", { name: "Anular la venta" }).click();
  await expect(page.getByText("Venta anulada").first()).toBeVisible();
  expect(await devoluciones(ventaId)).toEqual([{ cantidad: 1 }]);
  expect(await saldoDe(cliente.id)).toBe(0);
  expect(invariantes()).toBe("limpias");
});

test("el dueño y el administrador anulan la misma venta a la vez: gana uno, el otro lo sabe, y la fruta vuelve una sola vez", async ({ page, browser }) => {
  const { cliente, ventaId } = await ventaAlCredito(70);
  const hojaA = await abrirDetalle(page, cliente.nombre, "duenio");
  const ctx = await browser.newContext({ baseURL: "http://127.0.0.1:3000", viewport: page.viewportSize()!, locale: "es-PE", timezoneId: "America/Lima" });
  const paginaB = await ctx.newPage();
  const hojaB = await abrirDetalle(paginaB, cliente.nombre, "administrador");
  await irAAnular(hojaA);
  await irAAnular(hojaB);
  await hojaA.getByRole("button", { name: "Se registró dos veces" }).click();
  await hojaB.getByRole("button", { name: "El cliente la devolvió" }).click();
  await Promise.all([hojaA.getByRole("button", { name: "Anular la venta" }).click(), hojaB.getByRole("button", { name: "Anular la venta" }).click()]);
  await page.waitForTimeout(3_000);

  const alertaA = await hojaA.getByRole("alert").textContent({ timeout: 1_000 }).catch(() => null);
  const alertaB = await hojaB.getByRole("alert").textContent({ timeout: 1_000 }).catch(() => null);
  await ctx.close();
  // Uno anuló (su hoja mostró el sello y se cerró, sin alerta); el otro recibe que ya estaba anulada, por quién y por qué.
  const mensajes = [alertaA, alertaB].filter(Boolean) as string[];
  expect(mensajes).toHaveLength(1);
  expect(mensajes[0]).toMatch(/^Esa venta ya estaba anulada por .+: «.+»\.$/);
  expect(await devoluciones(ventaId)).toEqual([{ cantidad: 1 }]);
  expect((await venta(ventaId)).estado).toBe("anulada");
  expect(await saldoDe(cliente.id)).toBe(0);
  expect(invariantes()).toBe("limpias");
});

test("una venta con comprobante enviado no ofrece anular: corresponde una nota de crédito (y la base igual lo rechaza)", async ({ page }) => {
  const { cliente, ventaId } = await ventaAlCredito(110);
  // El número se pide a la serie, como lo hará el servidor: un número inventado rompería la invariante INV-10.
  const { data: numero, error: errorNumero } = await base.rpc("tomar_numero", { p_serie: "B001" });
  expect(errorNumero).toBeNull();
  const { error } = await base.from("comprobantes").insert({ venta_id: ventaId, tipo: "03", serie: "B001", numero: numero!, estado: "enviado" });
  expect(error).toBeNull();
  const hoja = await abrirDetalle(page, cliente.nombre);
  // La pantalla ya no ofrece lo que la base va a rechazar (pgTAP 12 prueba el rechazo de la base): dice qué corresponde.
  await expect(hoja.getByRole("group", { name: "Comprobante" })).toContainText("enviada, esperando a SUNAT");
  await expect(hoja.getByRole("button", { name: "Anular esta venta" })).toHaveCount(0);
  await expect(hoja.getByText("Ya tiene comprobante: no se puede anular. Si te equivocaste, pídele a tu contador una nota de crédito.")).toBeVisible();
  expect((await venta(ventaId)).estado).toBe("registrada");
  expect(await devoluciones(ventaId)).toEqual([]);
});

test("con la sesión vencida dice que hay que anularla otra vez, y no anula nada", async ({ page, context }) => {
  const { cliente, ventaId } = await ventaAlCredito(65);
  const hoja = await abrirDetalle(page, cliente.nombre);
  await irAAnular(hoja);
  await hoja.getByRole("button", { name: "Se registró dos veces" }).click();
  await context.clearCookies();
  await hoja.getByRole("button", { name: "Anular la venta" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("Tu sesión terminó. Vuelve a entrar y anula la venta otra vez.");
  await expect(hoja.getByRole("button", { name: "Entrar otra vez" })).toBeVisible();
  expect((await venta(ventaId)).estado).toBe("registrada");
});

for (const rol of ["ayudante", "contador"] as const) {
  test(`el ${rol} ve el detalle de la venta pero no «Anular esta venta»`, async ({ page }) => {
    const { cliente } = await ventaAlCredito(45);
    const hoja = await abrirDetalle(page, cliente.nombre, rol);
    await expect(hoja.getByRole("list", { name: "Fruta de la venta" })).toBeVisible();
    await expect(hoja.getByRole("button", { name: "Anular esta venta" })).toHaveCount(0);
  });
}

test("la hoja de anular cabe en la pantalla, con controles de 48 px y «Anular la venta» a la vista", async ({ page }) => {
  const { cliente } = await ventaAlCredito(35);
  const hoja = await abrirDetalle(page, cliente.nombre);
  await irAAnular(hoja);
  await hoja.getByRole("button", { name: "Otro motivo" }).click();
  await page.waitForTimeout(800);
  const medidas = await hoja.evaluate((raiz) => ({
    desborde: raiz.scrollWidth - raiz.clientWidth,
    chicos: [...raiz.querySelectorAll("button, a, input")]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.width < 48 || r.height < 48);
      })
      .map((e) => e.getAttribute("aria-label") ?? e.textContent?.trim()),
  }));
  expect(medidas.desborde).toBeLessThanOrEqual(0);
  expect(medidas.chicos, "controles de menos de 48 px").toEqual([]);
  const anular = await hoja.getByRole("button", { name: "Anular la venta" }).boundingBox();
  expect(anular!.y + anular!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});
