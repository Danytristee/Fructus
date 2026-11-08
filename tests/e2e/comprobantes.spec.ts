import { expect, test, type Browser, type Page } from "@playwright/test";

import { baseLocal, invariantes } from "./base";
import { entrarComo, type Rol } from "./cuentas";
import { fiar, venderAlPaso } from "./dictar";
import { controlarLucode, recibidosPorLucode } from "./lucode";

// Emitir una boleta desde el detalle de la venta (A9). El proveedor es un Lucode simulado (tests/e2e/lucode-simulado.mjs): la
// prueba mira lo que le llegó, no solo lo que dice la pantalla. Cada prueba crea su propio cliente y su propia venta.

test.setTimeout(90_000);
const base = baseLocal();

async function clienteNuevo(documento?: { tipo_documento: "DNI" | "RUC"; numero_documento: string }) {
  const nombre = `Cliente de comprobantes ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const { data, error } = await base.from("clientes").insert({ nombre, ...documento }).select("id, nombre").single();
  if (error || !data) throw new Error(`No se pudo crear el cliente: ${error?.message}`);
  return data;
}

async function ventaAlCredito(monto: number, documento?: { tipo_documento: "DNI" | "RUC"; numero_documento: string }) {
  const cliente = await clienteNuevo(documento);
  await fiar(cliente.id, monto);
  const { data: v } = await base.from("ventas").select("id").eq("cliente_id", cliente.id).single();
  return { cliente, ventaId: v!.id };
}

const comprobantesDe = async (ventaId: number) => (await base.from("comprobantes").select("*").eq("venta_id", ventaId)).data ?? [];
const ultimoNumero = async (serie: string) => (await base.from("series_comprobante").select("ultimo_numero").eq("serie", serie).single()).data!.ultimo_numero;
const hoyEnLima = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Lima" });

async function abrirDetalle(page: Page, nombre: string, rol: Rol = "duenio") {
  await entrarComo(page, rol);
  await page.goto("/ventas");
  await page.getByRole("button", { name: new RegExp(nombre) }).click();
  const hoja = page.getByRole("dialog", { name: "Detalle de la venta" });
  await expect(hoja).toBeVisible({ timeout: 15_000 });
  return hoja;
}

/** Otra persona, en su propio contexto (su propia sesión), con el mismo celular que `como`. */
async function otraPersona(browser: Browser, como: Page) {
  const contexto = await browser.newContext({ baseURL: como.url().split("/").slice(0, 3).join("/"), viewport: como.viewportSize()!, locale: "es-PE", timezoneId: "America/Lima" });
  return { contexto, pagina: await contexto.newPage() };
}

test.beforeEach(async () => {
  await controlarLucode({ limpiar: true, demoraMs: 0 });
});

test("emitir una boleta desde el detalle: queda aceptada con su número, se guarda lo que contestó el proveedor y se le mandó una sola vez", async ({ page }) => {
  const { cliente, ventaId } = await ventaAlCredito(100);
  const hoja = await abrirDetalle(page, cliente.nombre);
  await expect(hoja.getByRole("group", { name: "Comprobante" })).toHaveCount(0);

  await hoja.getByRole("button", { name: "Emitir boleta" }).click();
  const tarjeta = hoja.getByRole("group", { name: "Comprobante" });
  await expect(tarjeta).toContainText(/Boleta B001-\d{8}/, { timeout: 20_000 });
  await expect(tarjeta).toContainText("aceptada");

  // Lo que quedó en la base: un solo comprobante, aceptado, en sandbox, con la respuesta cruda y el PDF.
  const guardados = await comprobantesDe(ventaId);
  expect(guardados).toHaveLength(1);
  const c = guardados[0]!;
  expect(c).toMatchObject({ tipo: "03", serie: "B001", estado: "aceptado", ambiente: "sandbox" });
  expect(c.respuesta).toMatchObject({ estado: "aceptado" });
  expect(c.pdf_url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/pdf\/B001-\d{8}$/);
  await expect(tarjeta).toContainText(`B001-${String(c.numero).padStart(8, "0")}`);

  // Lo que le llegó al proveedor: una sola vez, con la venta tal como se guardó.
  const recibidos = (await recibidosPorLucode()).filter((p) => p.cliente.nombre === cliente.nombre);
  expect(recibidos).toHaveLength(1);
  expect(recibidos[0]).toMatchObject({
    tipo: "03",
    serie: "B001",
    numero: c.numero,
    fecha_emision: hoyEnLima(),
    moneda: "PEN",
    emisor: { ruc: "20600000001" },
    cliente: { tipo_documento: "0", numero_documento: "-" },
    totales: { gravado: 0, exonerado: 100, igv: 0, total: 100 },
  });
  expect(recibidos[0]!.items).toEqual([expect.objectContaining({ descripcion: "Mango Kent", cantidad: 1, valor_venta: 100, afectacion_igv: "20", igv: 0 })]);

  // Con comprobante ya no se ofrece anular: corresponde una nota de crédito.
  await expect(hoja.getByRole("button", { name: "Anular esta venta" })).toHaveCount(0);
  await expect(hoja.getByText("Con comprobante no se anula: corresponde una nota de crédito.")).toBeVisible();

  // Al volver a abrir la venta, el comprobante sigue ahí (sale de la base, no de la memoria de la pantalla).
  await page.reload();
  await page.getByRole("button", { name: new RegExp(cliente.nombre) }).click();
  await expect(page.getByRole("dialog", { name: "Detalle de la venta" }).getByRole("group", { name: "Comprobante" })).toContainText("aceptada", { timeout: 15_000 });
  expect(invariantes()).toBe("limpias");
});

test("el dueño y el ayudante emiten la misma venta a la vez: un solo comprobante, el mismo número para los dos, y el proveedor lo recibe una vez", async ({ page, browser }) => {
  await controlarLucode({ demoraMs: 1_500 }); // la respuesta tarda: la segunda persona llega con la primera en camino
  const { cliente, ventaId } = await ventaAlCredito(80);
  const hojaA = await abrirDetalle(page, cliente.nombre, "duenio");
  const { contexto: ctx, pagina: paginaB } = await otraPersona(browser, page);
  const hojaB = await abrirDetalle(paginaB, cliente.nombre, "ayudante");

  await Promise.all([hojaA.getByRole("button", { name: "Emitir boleta" }).click(), hojaB.getByRole("button", { name: "Emitir boleta" }).click()]);
  const tarjetaA = hojaA.getByRole("group", { name: "Comprobante" });
  const tarjetaB = hojaB.getByRole("group", { name: "Comprobante" });
  await expect(tarjetaA).toContainText(/Boleta B001-\d{8}/, { timeout: 30_000 });
  await expect(tarjetaB).toContainText(/Boleta B001-\d{8}/, { timeout: 30_000 });
  const numeroDe = async (t: typeof tarjetaA) => (await t.textContent())!.match(/B001-\d{8}/)![0];
  const numeroA = await numeroDe(tarjetaA);
  expect(await numeroDe(tarjetaB)).toBe(numeroA);
  await ctx.close();

  const guardados = await comprobantesDe(ventaId);
  expect(guardados).toHaveLength(1);
  expect(guardados[0]!.estado).toBe("aceptado");
  expect((await recibidosPorLucode()).filter((p) => p.cliente.nombre === cliente.nombre)).toHaveLength(1);
  expect(invariantes()).toBe("limpias");
});

test("treinta pedidos de número a la vez sobre la misma venta, en la base: uno gana, los demás reciben el mismo, y la serie avanza una sola vez", async () => {
  // Con solo dos pedidos la carrera casi nunca se solapa (probado quitando el bloqueo de la venta: la prueba igual pasaba): treinta sí.
  const { ventaId } = await ventaAlCredito(60);
  const antes = await ultimoNumero("B001");
  const respuestas = await Promise.all(Array.from({ length: 30 }, () => base.rpc("reservar_comprobante", { p_venta_id: ventaId, p_tipo: "03" })));
  expect(respuestas.map((r) => r.error?.message ?? null), "ningún pedido falla: se ponen en fila").toEqual(Array(30).fill(null));
  const reservas = respuestas.map((r) => r.data) as { numero: number; nuevo: boolean }[];
  expect(reservas.filter((r) => r.nuevo)).toHaveLength(1);
  expect(new Set(reservas.map((r) => r.numero)).size).toBe(1);
  expect(await comprobantesDe(ventaId)).toHaveLength(1);
  expect(await ultimoNumero("B001")).toBe(antes + 1); // solo esta reserva avanzó la serie: se prueba sin otros emitiendo (workers=1)
  expect(invariantes()).toBe("limpias");
});

test("el ayudante emite una boleta; el contador ve el comprobante pero no tiene botón para emitir", async ({ page, browser }) => {
  const { cliente, ventaId } = await ventaAlCredito(45);
  const hojaAyudante = await abrirDetalle(page, cliente.nombre, "ayudante");
  await hojaAyudante.getByRole("button", { name: "Emitir boleta" }).click();
  await expect(hojaAyudante.getByRole("group", { name: "Comprobante" })).toContainText("aceptada", { timeout: 20_000 });
  expect(await comprobantesDe(ventaId)).toHaveLength(1);

  const { contexto, pagina } = await otraPersona(browser, page);
  const hojaContador = await abrirDetalle(pagina, cliente.nombre, "contador");
  await expect(hojaContador.getByRole("group", { name: "Comprobante" })).toContainText("aceptada");
  await expect(hojaContador.getByRole("button", { name: /Emitir/ })).toHaveCount(0);
  await pagina.keyboard.press("Escape");

  // Una venta sin comprobante: el contador no ve el botón ni una tarjeta vacía.
  const otra = await ventaAlCredito(46);
  await pagina.reload();
  await pagina.getByRole("button", { name: new RegExp(otra.cliente.nombre) }).click();
  const hojaSinComprobante = pagina.getByRole("dialog", { name: "Detalle de la venta" });
  await expect(hojaSinComprobante).toBeVisible({ timeout: 15_000 });
  await expect(hojaSinComprobante.getByRole("button", { name: /Emitir/ })).toHaveCount(0);
  await expect(hojaSinComprobante.getByRole("group", { name: "Comprobante" })).toHaveCount(0);
  await contexto.close();
});

test("una boleta de más de S/ 700 pide el documento del cliente: no sale, no gasta un número, y con el DNI sí", async ({ page }) => {
  const { cliente, ventaId } = await ventaAlCredito(1_000);
  const antes = await ultimoNumero("B001");
  const hoja = await abrirDetalle(page, cliente.nombre);

  await hoja.getByRole("button", { name: "Emitir boleta" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("Una boleta de más de S/ 700 lleva el DNI del cliente. Agrégalo en su ficha.", { timeout: 20_000 });
  expect(await comprobantesDe(ventaId)).toHaveLength(0);
  expect(await ultimoNumero("B001")).toBe(antes);
  expect((await recibidosPorLucode()).filter((p) => p.cliente.nombre === cliente.nombre)).toHaveLength(0);

  // Se agrega el DNI en la ficha y se vuelve a tocar: ahora sale, con el documento del cliente en el comprobante.
  await base.from("clientes").update({ tipo_documento: "DNI", numero_documento: "40123456" }).eq("id", cliente.id);
  await hoja.getByRole("button", { name: "Emitir boleta" }).click();
  await expect(hoja.getByRole("group", { name: "Comprobante" })).toContainText("aceptada", { timeout: 20_000 });
  const recibidos = (await recibidosPorLucode()).filter((p) => p.cliente.nombre === cliente.nombre);
  expect(recibidos).toHaveLength(1);
  expect(recibidos[0]!.cliente).toMatchObject({ tipo_documento: "1", numero_documento: "40123456" });
  expect(invariantes()).toBe("limpias");
});

test("con la sesión vencida dice que hay que emitirla otra vez, y no emite nada", async ({ page, context }) => {
  const { cliente, ventaId } = await ventaAlCredito(55);
  const hoja = await abrirDetalle(page, cliente.nombre);
  await context.clearCookies();
  await hoja.getByRole("button", { name: "Emitir boleta" }).click();
  await expect(hoja.getByRole("alert")).toContainText("Tu sesión terminó. Vuelve a entrar y emite el comprobante otra vez.");
  await expect(hoja.getByRole("link", { name: "Entrar otra vez" })).toBeVisible();
  expect(await comprobantesDe(ventaId)).toHaveLength(0);
});

test("la hoja con el comprobante cabe en el celular: botón a la vista, controles de 48 px y sin desborde", async ({ page }) => {
  const { cliente } = await ventaAlCredito(40);
  const hoja = await abrirDetalle(page, cliente.nombre);
  await page.waitForTimeout(800); // que termine de subir
  const emitir = hoja.getByRole("button", { name: "Emitir boleta" });
  const caja = (await emitir.boundingBox())!;
  const { width, height } = page.viewportSize()!;
  expect(caja.height).toBeGreaterThanOrEqual(48);
  expect(caja.y + caja.height, "«Emitir boleta» a la vista, sin deslizar").toBeLessThanOrEqual(height);
  expect(caja.y + caja.height / 2, "en la mitad de abajo, al alcance del pulgar").toBeGreaterThan(height / 2);
  expect(caja.x + caja.width).toBeLessThanOrEqual(width);

  const medidas = await hoja.evaluate((raiz) => ({
    desborde: raiz.scrollWidth - raiz.clientWidth,
    chicos: [...raiz.querySelectorAll("button, a")].filter((e) => e.getBoundingClientRect().height < 48).map((e) => e.textContent?.trim()),
  }));
  expect(medidas.desborde).toBeLessThanOrEqual(0);
  expect(medidas.chicos, "controles de menos de 48 px").toEqual([]);

  await emitir.click();
  await expect(hoja.getByRole("group", { name: "Comprobante" })).toContainText("aceptada", { timeout: 20_000 });
  const despues = await hoja.evaluate((raiz) => ({ desborde: raiz.scrollWidth - raiz.clientWidth, alto: raiz.getBoundingClientRect().height }));
  expect(despues.desborde).toBeLessThanOrEqual(0);
  expect(despues.alto).toBeLessThanOrEqual(height);
});

// ---------------------------------------------------------------------------------------------------------------------
// A9.2 · La factura es solo para clientes con RUC
// ---------------------------------------------------------------------------------------------------------------------

const rucAlAzar = () => `20${String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, "0")}`;

test("un cliente con RUC: se le ofrece factura y boleta; la factura sale en la serie F001 con su RUC y su nombre", async ({ page }) => {
  const ruc = rucAlAzar();
  const { cliente, ventaId } = await ventaAlCredito(200, { tipo_documento: "RUC", numero_documento: ruc });
  const hoja = await abrirDetalle(page, cliente.nombre);
  await expect(hoja.getByRole("button", { name: "Emitir boleta" })).toBeVisible();

  await hoja.getByRole("button", { name: "Emitir factura" }).click();
  const tarjeta = hoja.getByRole("group", { name: "Comprobante" });
  await expect(tarjeta).toContainText(/Factura F001-\d{8}/, { timeout: 20_000 });
  await expect(tarjeta).toContainText("aceptada");

  const [c] = await comprobantesDe(ventaId);
  expect(c).toMatchObject({ tipo: "01", serie: "F001", estado: "aceptado" });
  const recibidos = (await recibidosPorLucode()).filter((p) => p.cliente.nombre === cliente.nombre);
  expect(recibidos).toHaveLength(1);
  expect(recibidos[0]).toMatchObject({ tipo: "01", serie: "F001", cliente: { tipo_documento: "6", numero_documento: ruc }, totales: { exonerado: 200, total: 200 } });
  expect(invariantes()).toBe("limpias"); // INV-11: una factura es de un cliente con RUC
});

test("un cliente sin documento: la factura pide el RUC, lo valida, lo guarda en su ficha y recién emite", async ({ page }) => {
  const { cliente, ventaId } = await ventaAlCredito(150);
  const hoja = await abrirDetalle(page, cliente.nombre);
  await hoja.getByRole("button", { name: "Emitir factura" }).click();

  // La hoja pide el RUC; con uno mal escrito dice cómo es y no deja seguir.
  await expect(hoja.getByRole("heading", { name: /RUC/ })).toBeVisible();
  const campo = hoja.getByLabel("RUC");
  const guardar = hoja.getByRole("button", { name: "Guardar RUC y emitir factura" });
  await campo.fill("123");
  await expect(hoja.getByText("El RUC tiene 11 números y empieza con 10 o 20.")).toBeVisible();
  await expect(guardar).toBeDisabled();
  expect(await comprobantesDe(ventaId)).toHaveLength(0);

  // «Volver a la venta» no cambia nada.
  await hoja.getByRole("button", { name: "Volver a la venta" }).click();
  await expect(hoja.getByRole("button", { name: "Emitir factura" })).toBeVisible();
  expect((await base.from("clientes").select("tipo_documento").eq("id", cliente.id).single()).data!.tipo_documento).toBeNull();

  // Con el RUC bien escrito: se guarda en el cliente y sale la factura.
  await hoja.getByRole("button", { name: "Emitir factura" }).click();
  const ruc = rucAlAzar();
  await hoja.getByLabel("RUC").fill(ruc.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, "$1 $2 $3 $4")); // con espacios: se limpian
  await guardar.click();
  await expect(hoja.getByRole("group", { name: "Comprobante" })).toContainText(/Factura F001-\d{8}/, { timeout: 20_000 });
  expect((await base.from("clientes").select("tipo_documento, numero_documento").eq("id", cliente.id).single()).data).toEqual({ tipo_documento: "RUC", numero_documento: ruc });
  expect((await recibidosPorLucode()).filter((p) => p.cliente.nombre === cliente.nombre)[0]!.cliente).toMatchObject({ tipo_documento: "6", numero_documento: ruc });
  expect(invariantes()).toBe("limpias");
});

test("el ayudante emite factura solo a un cliente que ya tiene RUC: no puede cambiar documentos, así que a los demás no se la ofrece", async ({ page, browser }) => {
  const conRuc = await ventaAlCredito(90, { tipo_documento: "RUC", numero_documento: rucAlAzar() });
  const sinDocumento = await ventaAlCredito(91);
  const hoja = await abrirDetalle(page, conRuc.cliente.nombre, "ayudante");
  await hoja.getByRole("button", { name: "Emitir factura" }).click();
  await expect(hoja.getByRole("group", { name: "Comprobante" })).toContainText(/Factura F001-\d{8}/, { timeout: 20_000 });

  const { contexto, pagina } = await otraPersona(browser, page);
  const hojaSinRuc = await abrirDetalle(pagina, sinDocumento.cliente.nombre, "ayudante");
  await expect(hojaSinRuc.getByRole("button", { name: "Emitir boleta" })).toBeVisible();
  await expect(hojaSinRuc.getByRole("button", { name: "Emitir factura" })).toHaveCount(0);
  await contexto.close();
  expect(await comprobantesDe(sinDocumento.ventaId)).toHaveLength(0);
});

test("una venta al paso y un cliente con DNI solo reciben boleta", async ({ page, browser }) => {
  const monto = 123.45;
  await venderAlPaso(monto, "plin");
  const hojaPaso = await (async () => {
    await entrarComo(page, "duenio");
    await page.goto("/ventas");
    await page.getByRole("button", { name: /Venta al paso/ }).filter({ hasText: /123\.45/ }).first().click();
    const h = page.getByRole("dialog", { name: "Detalle de la venta" });
    await expect(h).toBeVisible({ timeout: 15_000 });
    return h;
  })();
  await expect(hojaPaso.getByRole("button", { name: "Emitir boleta" })).toBeVisible();
  await expect(hojaPaso.getByRole("button", { name: "Emitir factura" })).toHaveCount(0);

  const dni = await ventaAlCredito(60, { tipo_documento: "DNI", numero_documento: "40123456" });
  const { contexto, pagina } = await otraPersona(browser, page);
  const hojaDni = await abrirDetalle(pagina, dni.cliente.nombre, "duenio");
  await expect(hojaDni.getByRole("button", { name: "Emitir boleta" })).toBeVisible();
  await expect(hojaDni.getByRole("button", { name: "Emitir factura" })).toHaveCount(0);
  await contexto.close();
});

test("la factura cabe en el celular: los dos botones lado a lado a 48 px, y la hoja del RUC sin desborde", async ({ page }) => {
  const { cliente } = await ventaAlCredito(70, { tipo_documento: "RUC", numero_documento: rucAlAzar() });
  const hoja = await abrirDetalle(page, cliente.nombre);
  await page.waitForTimeout(800);
  const { width, height } = page.viewportSize()!;
  for (const nombre of ["Emitir factura", "Emitir boleta"]) {
    const caja = (await hoja.getByRole("button", { name: nombre }).boundingBox())!;
    expect(caja.height, `alto de «${nombre}»`).toBeGreaterThanOrEqual(48);
    expect(caja.x, `«${nombre}» dentro de la pantalla`).toBeGreaterThanOrEqual(0);
    expect(caja.x + caja.width, `«${nombre}» dentro de la pantalla`).toBeLessThanOrEqual(width);
    expect(caja.y + caja.height, `«${nombre}» a la vista`).toBeLessThanOrEqual(height);
  }
  const sinDocumento = await ventaAlCredito(71);
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: new RegExp(sinDocumento.cliente.nombre) }).click();
  const hojaRuc = page.getByRole("dialog", { name: "Detalle de la venta" });
  await expect(hojaRuc).toBeVisible({ timeout: 15_000 });
  await hojaRuc.getByRole("button", { name: "Emitir factura" }).click();
  await expect(hojaRuc.getByLabel("RUC")).toBeVisible();
  await page.waitForTimeout(500);
  const medidas = await hojaRuc.evaluate((raiz) => ({
    desborde: raiz.scrollWidth - raiz.clientWidth,
    chicos: [...raiz.querySelectorAll("button, a, input")].filter((e) => e.getBoundingClientRect().height < 48).map((e) => e.textContent?.trim() || e.getAttribute("id")),
  }));
  expect(medidas.desborde).toBeLessThanOrEqual(0);
  expect(medidas.chicos, "controles de menos de 48 px").toEqual([]);
});
