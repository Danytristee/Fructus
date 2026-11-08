import { expect, test, type Browser, type Page } from "@playwright/test";

import { baseLocal, invariantes } from "./base";
import { entrarComo, type Rol } from "./cuentas";
import { fiar, venderAlPaso } from "./dictar";
import { conEscenario, consultasAlProveedor, recibidosPorLucode, sinMarca, sunatContesto, type Escenario } from "./lucode";

// Emitir una boleta desde el detalle de la venta (A9). El proveedor es un Lucode simulado (tests/e2e/lucode-simulado.mjs): la
// prueba mira lo que le llegó, no solo lo que dice la pantalla. Cada prueba crea su propio cliente y su propia venta.

test.setTimeout(90_000);
const base = baseLocal();

async function clienteNuevo(documento?: { tipo_documento: "DNI" | "RUC"; numero_documento: string }, escenario?: Escenario, telefono?: string) {
  const nombreBase = `Cliente de comprobantes ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const nombre = escenario ? conEscenario(nombreBase, escenario) : nombreBase;
  const { data, error } = await base.from("clientes").insert({ nombre, ...documento, ...(telefono ? { telefono } : {}) }).select("id, nombre").single();
  if (error || !data) throw new Error(`No se pudo crear el cliente: ${error?.message}`);
  return data;
}

async function ventaAlCredito(monto: number, documento?: { tipo_documento: "DNI" | "RUC"; numero_documento: string }, escenario?: Escenario, telefono?: string) {
  const cliente = await clienteNuevo(documento, escenario, telefono);
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
  await page.getByRole("button", { name: new RegExp(sinMarca(nombre)) }).click();
  const hoja = page.getByRole("dialog", { name: "Detalle de la venta" });
  await expect(hoja).toBeVisible({ timeout: 15_000 });
  return hoja;
}

/** Otra persona, en su propio contexto (su propia sesión), con el mismo celular que `como`. */
async function otraPersona(browser: Browser, como: Page) {
  const contexto = await browser.newContext({ baseURL: como.url().split("/").slice(0, 3).join("/"), viewport: como.viewportSize()!, locale: "es-PE", timezoneId: "America/Lima" });
  return { contexto, pagina: await contexto.newPage() };
}

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
  // La respuesta tarda un poco (menos que el tope): la segunda persona llega con la primera en camino.
  const { cliente, ventaId } = await ventaAlCredito(80, undefined, { demoraMs: 1_200 });
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

// ---------------------------------------------------------------------------------------------------------------------
// A9.3 · Cuando el proveedor falla: nunca dos números, nunca un éxito inventado, y siempre se dice qué pasó
// ---------------------------------------------------------------------------------------------------------------------

/** Quita la marca de escenario del cliente: es como si el proveedor «se hubiera arreglado» para el siguiente intento. */
async function arreglarProveedor(clienteId: number, nuevo?: Escenario) {
  const { data } = await base.from("clientes").select("nombre").eq("id", clienteId).single();
  const limpio = sinMarca(data!.nombre);
  await base.from("clientes").update({ nombre: nuevo ? conEscenario(limpio, nuevo) : limpio }).eq("id", clienteId);
  return limpio;
}

const intentosDe = async (nombreBase: string) => (await recibidosPorLucode()).filter((p) => p.cliente.nombre.startsWith(nombreBase));
const tarjeta = (hoja: Awaited<ReturnType<typeof abrirDetalle>>) => hoja.getByRole("group", { name: "Comprobante" });

test("el proveedor rechaza: se dice por qué, queda guardado el rechazo, y se puede emitir otro con otro número", async ({ page }) => {
  const { cliente, ventaId } = await ventaAlCredito(120, undefined, { modo: "rechazado" });
  const hoja = await abrirDetalle(page, cliente.nombre);
  await hoja.getByRole("button", { name: "Emitir boleta" }).click();

  // El rechazo se dice en la tarjeta, con su motivo; no se repite en una alerta aparte.
  await expect(tarjeta(hoja)).toContainText("rechazada", { timeout: 20_000 });
  await expect(tarjeta(hoja)).toContainText("El RUC del cliente no existe");
  await expect(hoja.getByRole("alert")).toHaveCount(0);
  await expect(hoja.getByRole("button", { name: "Emitir boleta" })).toBeVisible(); // se puede volver a emitir
  await expect(hoja.getByRole("button", { name: "Anular esta venta" })).toBeVisible(); // sin comprobante vigente, anular vuelve a ser posible
  const [rechazado] = await comprobantesDe(ventaId);
  expect(rechazado).toMatchObject({ estado: "rechazado", tipo: "03" });
  expect(rechazado!.respuesta).toMatchObject({ estado: "rechazado", mensaje: "El RUC del cliente no existe" });

  // Se corrige y se emite de nuevo: sale con otro número, y el rechazado queda de historia.
  await arreglarProveedor(cliente.id);
  await hoja.getByRole("button", { name: "Emitir boleta" }).click();
  await expect(tarjeta(hoja)).toContainText("aceptada", { timeout: 20_000 });
  const todos = (await comprobantesDe(ventaId)).sort((a, b) => a.id - b.id);
  expect(todos.map((c) => c.estado)).toEqual(["rechazado", "aceptado"]);
  expect(todos[1]!.numero).not.toBe(todos[0]!.numero);
  expect(invariantes()).toBe("limpias"); // INV-08: una sola vigente

  await page.reload();
  await page.getByRole("button", { name: new RegExp(sinMarca(cliente.nombre)) }).click();
  await expect(tarjeta(page.getByRole("dialog", { name: "Detalle de la venta" }))).toContainText("aceptada", { timeout: 15_000 });
});

test("el proveedor está caído: el comprobante queda pendiente con su número, se dice qué hacer, y Reintentar manda ese mismo número", async ({ page, browser }) => {
  const { cliente, ventaId } = await ventaAlCredito(130, undefined, { modo: "caido" });
  const hoja = await abrirDetalle(page, cliente.nombre);
  await hoja.getByRole("button", { name: "Emitir boleta" }).click();

  await expect(tarjeta(hoja)).toContainText("en proceso", { timeout: 20_000 });
  await expect(tarjeta(hoja)).toContainText("No hubo respuesta del proveedor. Reintenta: lleva el mismo número y no se repite.");
  const [pendiente] = await comprobantesDe(ventaId);
  expect(pendiente).toMatchObject({ estado: "pendiente", respuesta: null, pdf_url: null });
  await expect(hoja.getByRole("button", { name: "Anular esta venta" })).toHaveCount(0); // en proceso: no se anula (podría quedar aceptado)
  await expect(hoja.getByText("El comprobante está en proceso: espera a que termine para anular.")).toBeVisible();

  // El contador ve en qué quedó, pero no puede reintentar.
  const { contexto, pagina } = await otraPersona(browser, page);
  const hojaContador = await abrirDetalle(pagina, cliente.nombre, "contador");
  await expect(tarjeta(hojaContador)).toContainText("en proceso");
  await expect(hojaContador.getByRole("button", { name: "Reintentar" })).toHaveCount(0);
  await contexto.close();

  // Se arregla el proveedor y se reintenta: el MISMO comprobante y el MISMO número; nada nuevo se reserva.
  const nombreBase = await arreglarProveedor(cliente.id);
  await hoja.getByRole("button", { name: "Reintentar" }).click();
  await expect(tarjeta(hoja)).toContainText("aceptada", { timeout: 20_000 });
  const despues = await comprobantesDe(ventaId);
  expect(despues).toHaveLength(1);
  expect(despues[0]).toMatchObject({ id: pendiente!.id, numero: pendiente!.numero, estado: "aceptado" });
  const intentos = await intentosDe(nombreBase);
  expect(intentos.map((p) => p.numero)).toEqual([pendiente!.numero, pendiente!.numero]); // dos intentos, un solo número
  expect(invariantes()).toBe("limpias");
});

test("la respuesta se pierde (pasa el tope de espera) pero el proveedor sí lo guardó: al reintentar dice «ya existe», se le pregunta cómo quedó y no se repite", async ({ page }) => {
  const { cliente, ventaId } = await ventaAlCredito(140, undefined, { demoraMs: 5_000 }); // más que el tope de 2 s de las pruebas
  const hoja = await abrirDetalle(page, cliente.nombre);
  await hoja.getByRole("button", { name: "Emitir boleta" }).click();
  await expect(tarjeta(hoja)).toContainText("en proceso", { timeout: 20_000 });
  const [pendiente] = await comprobantesDe(ventaId);
  expect(pendiente!.estado).toBe("pendiente");

  const nombreBase = await arreglarProveedor(cliente.id); // el siguiente intento contesta al toque
  await hoja.getByRole("button", { name: "Reintentar" }).click();
  await expect(tarjeta(hoja)).toContainText("aceptada", { timeout: 20_000 });
  const [aceptado] = await comprobantesDe(ventaId);
  expect(aceptado).toMatchObject({ id: pendiente!.id, numero: pendiente!.numero, estado: "aceptado" });
  expect(aceptado!.pdf_url).toMatch(/\/pdf\/B001-\d{8}$/); // el PDF vino de la consulta
  expect(await comprobantesDe(ventaId)).toHaveLength(1);
  expect((await intentosDe(nombreBase)).map((p) => p.numero)).toEqual([pendiente!.numero, pendiente!.numero]);
  expect(invariantes()).toBe("limpias");
});

test("«enviado»: SUNAT todavía no contesta; «Ver cómo va» pregunta sin repetir nada, y cuando contesta queda aceptado", async ({ page }) => {
  const { cliente, ventaId } = await ventaAlCredito(150, undefined, { modo: "enviado" });
  const hoja = await abrirDetalle(page, cliente.nombre);
  await hoja.getByRole("button", { name: "Emitir boleta" }).click();
  await expect(tarjeta(hoja)).toContainText("enviada, esperando a SUNAT", { timeout: 20_000 });
  const [enviado] = await comprobantesDe(ventaId);
  expect(enviado).toMatchObject({ estado: "enviado", pdf_url: null });
  await expect(hoja.getByText("Con comprobante no se anula: corresponde una nota de crédito.")).toBeVisible();

  // «SUNAT todavía no contesta» ya está en pantalla antes de preguntar: se espera a que la pregunta haya llegado al proveedor, y recién
  // entonces SUNAT contesta (si no, la primera consulta podría ya encontrarla aceptada y la prueba dependería del ritmo).
  const numero = `${enviado!.serie}-${String(enviado!.numero).padStart(8, "0")}`;
  const consultasDe = async () => (await consultasAlProveedor()).filter((n) => n === numero).length;
  await hoja.getByRole("button", { name: "Ver cómo va" }).click();
  await expect.poll(consultasDe, { timeout: 20_000 }).toBe(1);
  await expect(tarjeta(hoja)).toContainText("SUNAT todavía no contesta.");
  expect((await comprobantesDe(ventaId))[0]!.estado).toBe("enviado");

  await sunatContesto(enviado!.serie, enviado!.numero);
  await hoja.getByRole("button", { name: "Ver cómo va" }).click(); // espera a que termine la consulta anterior: el botón vuelve cuando acaba
  await expect.poll(consultasDe, { timeout: 20_000 }).toBe(2);
  await expect(tarjeta(hoja)).toContainText("aceptada", { timeout: 20_000 });
  expect((await comprobantesDe(ventaId))[0]).toMatchObject({ estado: "aceptado" });
  expect((await comprobantesDe(ventaId))[0]!.pdf_url).toMatch(/\/pdf\/B001-\d{8}$/);
  expect((await intentosDe(cliente.nombre)).length, "preguntar no reenvía el comprobante").toBe(1);
});

for (const escenario of [
  { modo: "invalido" as const, que: "contesta algo que no se entiende" },
  { modo: "token" as const, que: "no acepta la clave (401)" },
]) {
  test(`el proveedor ${escenario.que}: NO se toma por un rechazo ni por un éxito, queda pendiente con su número`, async ({ page }) => {
    const { cliente, ventaId } = await ventaAlCredito(95, undefined, { modo: escenario.modo });
    const hoja = await abrirDetalle(page, cliente.nombre);
    await hoja.getByRole("button", { name: "Emitir boleta" }).click();
    await expect(tarjeta(hoja)).toContainText("en proceso", { timeout: 20_000 });
    await expect(hoja.getByRole("button", { name: "Reintentar" })).toBeVisible();
    const guardados = await comprobantesDe(ventaId);
    expect(guardados).toHaveLength(1);
    expect(guardados[0]).toMatchObject({ estado: "pendiente", respuesta: null });
  });
}

test("dos personas reintentan a la vez el mismo comprobante pendiente: queda uno solo, aceptado, con el mismo número", async ({ page, browser }) => {
  const { cliente, ventaId } = await ventaAlCredito(85, undefined, { modo: "caido" });
  const hojaA = await abrirDetalle(page, cliente.nombre, "duenio");
  await hojaA.getByRole("button", { name: "Emitir boleta" }).click();
  await expect(tarjeta(hojaA)).toContainText("en proceso", { timeout: 20_000 });
  const [pendiente] = await comprobantesDe(ventaId);

  const { contexto, pagina } = await otraPersona(browser, page);
  const hojaB = await abrirDetalle(pagina, cliente.nombre, "ayudante");
  await expect(tarjeta(hojaB)).toContainText("en proceso");
  const nombreBase = await arreglarProveedor(cliente.id, { demoraMs: 1_000 }); // contesta, pero tarda: los dos pedidos se cruzan
  await Promise.all([hojaA.getByRole("button", { name: "Reintentar" }).click(), hojaB.getByRole("button", { name: "Reintentar" }).click()]);
  await expect(tarjeta(hojaA)).toContainText("aceptada", { timeout: 30_000 });
  await expect(tarjeta(hojaB)).toContainText("aceptada", { timeout: 30_000 });
  await contexto.close();

  const despues = await comprobantesDe(ventaId);
  expect(despues).toHaveLength(1);
  expect(despues[0]).toMatchObject({ id: pendiente!.id, numero: pendiente!.numero, estado: "aceptado" });
  expect(new Set((await intentosDe(nombreBase)).map((p) => p.numero)).size, "todos los intentos fueron del mismo número").toBe(1);
  expect(invariantes()).toBe("limpias");
});

test("el comprobante pendiente y el rechazado caben en el celular: botón de 48 px a la vista y texto sin desborde", async ({ page }) => {
  const pendiente = await ventaAlCredito(75, undefined, { modo: "caido" });
  const hoja = await abrirDetalle(page, pendiente.cliente.nombre);
  await hoja.getByRole("button", { name: "Emitir boleta" }).click();
  await expect(tarjeta(hoja)).toContainText("en proceso", { timeout: 20_000 });
  await page.waitForTimeout(800);
  const { width, height } = page.viewportSize()!;
  const boton = (await hoja.getByRole("button", { name: "Reintentar" }).boundingBox())!;
  expect(boton.height).toBeGreaterThanOrEqual(48);
  expect(boton.y + boton.height, "«Reintentar» a la vista").toBeLessThanOrEqual(height);
  expect(boton.x + boton.width).toBeLessThanOrEqual(width);
  const medidas = await hoja.evaluate((raiz) => ({
    desborde: raiz.scrollWidth - raiz.clientWidth,
    chicos: [...raiz.querySelectorAll("button, a")].filter((e) => e.getBoundingClientRect().height < 48).map((e) => e.textContent?.trim()),
  }));
  expect(medidas.desborde).toBeLessThanOrEqual(0);
  expect(medidas.chicos, "controles de menos de 48 px").toEqual([]);

  const rechazado = await ventaAlCredito(76, undefined, { modo: "rechazado" });
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: new RegExp(sinMarca(rechazado.cliente.nombre)) }).click();
  const hojaRechazo = page.getByRole("dialog", { name: "Detalle de la venta" });
  await expect(hojaRechazo).toBeVisible({ timeout: 15_000 });
  await hojaRechazo.getByRole("button", { name: "Emitir boleta" }).click();
  await expect(tarjeta(hojaRechazo)).toContainText("rechazada", { timeout: 20_000 });
  await page.waitForTimeout(500);
  const despues = await hojaRechazo.evaluate((raiz) => ({ desborde: raiz.scrollWidth - raiz.clientWidth, alto: raiz.getBoundingClientRect().height }));
  expect(despues.desborde).toBeLessThanOrEqual(0);
  expect(despues.alto).toBeLessThanOrEqual(height);
});

// ---------------------------------------------------------------------------------------------------------------------
// A9.5 · El PDF y «Enviar por WhatsApp»
// ---------------------------------------------------------------------------------------------------------------------

const textoDe = (enlace: string) => decodeURIComponent(enlace.split("?text=")[1]!);

test("la boleta aceptada ofrece «Ver PDF» (abre de verdad) y «Enviar por WhatsApp» al celular del cliente, con el mensaje escrito", async ({ page }) => {
  const { cliente, ventaId } = await ventaAlCredito(100, undefined, undefined, "987 654 321");
  const hoja = await abrirDetalle(page, cliente.nombre);
  // Antes de emitir no hay nada que ver ni que mandar.
  await expect(hoja.getByRole("link", { name: "Ver PDF" })).toHaveCount(0);
  await expect(hoja.getByRole("link", { name: "Enviar por WhatsApp" })).toHaveCount(0);

  await hoja.getByRole("button", { name: "Emitir boleta" }).click();
  await expect(tarjeta(hoja)).toContainText("aceptada", { timeout: 20_000 });
  const [c] = await comprobantesDe(ventaId);

  const pdf = hoja.getByRole("link", { name: "Ver PDF" });
  await expect(pdf).toHaveAttribute("href", c!.pdf_url!);
  await expect(pdf).toHaveAttribute("target", "_blank");
  await expect(pdf).toHaveAttribute("rel", /noopener/);
  // El PDF abre de verdad: es el que guardó el proveedor, no un enlace roto.
  const respuesta = await page.request.get(c!.pdf_url!);
  expect(respuesta.status()).toBe(200);
  expect(respuesta.headers()["content-type"]).toContain("application/pdf");
  // Se abre en otra pestaña (el Chromium de las pruebas, sin pantalla, descarga los PDF en vez de mostrarlos: no se puede mirar su dirección;
  // que el PDF existe y es un PDF ya lo dijo la petición de arriba).
  const [nueva] = await Promise.all([page.context().waitForEvent("page"), pdf.click()]);
  await nueva.close();

  const whatsapp = hoja.getByRole("link", { name: "Enviar por WhatsApp" });
  const enlace = (await whatsapp.getAttribute("href"))!;
  expect(enlace.startsWith("https://wa.me/51987654321?text=")).toBe(true);
  expect(textoDe(enlace)).toBe(`Hola ${cliente.nombre}, te envío tu boleta B001-${String(c!.numero).padStart(8, "0")} por S/ 100.00: ${c!.pdf_url}`);
  await expect(whatsapp).toHaveAttribute("target", "_blank");
});

test("sin celular del cliente, WhatsApp se abre para elegir a quién; una venta al paso no inventa un nombre", async ({ page }) => {
  const sinCelular = await ventaAlCredito(110);
  const hoja = await abrirDetalle(page, sinCelular.cliente.nombre);
  await hoja.getByRole("button", { name: "Emitir boleta" }).click();
  await expect(tarjeta(hoja)).toContainText("aceptada", { timeout: 20_000 });
  const enlace = (await hoja.getByRole("link", { name: "Enviar por WhatsApp" }).getAttribute("href"))!;
  expect(enlace.startsWith("https://wa.me/?text=")).toBe(true);

  // Un teléfono fijo no es de WhatsApp: tampoco se usa.
  const fijo = await ventaAlCredito(111, undefined, undefined, "(044) 234567");
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: new RegExp(sinMarca(fijo.cliente.nombre)) }).click();
  const hojaFijo = page.getByRole("dialog", { name: "Detalle de la venta" });
  await expect(hojaFijo).toBeVisible({ timeout: 15_000 });
  await hojaFijo.getByRole("button", { name: "Emitir boleta" }).click();
  await expect(tarjeta(hojaFijo)).toContainText("aceptada", { timeout: 20_000 });
  expect((await hojaFijo.getByRole("link", { name: "Enviar por WhatsApp" }).getAttribute("href"))!.startsWith("https://wa.me/?text=")).toBe(true);

  // Venta al paso (sin cliente): el saludo es «Hola,» a secas.
  await venderAlPaso(321.54, "efectivo");
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: /Venta al paso/ }).filter({ hasText: /321\.54/ }).first().click();
  const hojaPaso = page.getByRole("dialog", { name: "Detalle de la venta" });
  await expect(hojaPaso).toBeVisible({ timeout: 15_000 });
  await hojaPaso.getByRole("button", { name: "Emitir boleta" }).click();
  await expect(tarjeta(hojaPaso)).toContainText("aceptada", { timeout: 20_000 });
  expect(textoDe((await hojaPaso.getByRole("link", { name: "Enviar por WhatsApp" }).getAttribute("href"))!)).toMatch(/^Hola, te envío tu boleta B001-\d{8} por S\/ 321\.54: http/);
});

test("el PDF y WhatsApp solo salen con el comprobante aceptado: en proceso, enviado o rechazado no hay nada que mandar", async ({ page }) => {
  for (const modo of ["caido", "enviado", "rechazado"] as const) {
    const { cliente } = await ventaAlCredito(120, undefined, { modo }, "987 654 321");
    const hoja = await abrirDetalle(page, cliente.nombre);
    await hoja.getByRole("button", { name: "Emitir boleta" }).click();
    await expect(tarjeta(hoja)).toContainText(modo === "caido" ? "en proceso" : modo === "enviado" ? "enviada" : "rechazada", { timeout: 20_000 });
    await expect(hoja.getByRole("link", { name: "Ver PDF" })).toHaveCount(0);
    await expect(hoja.getByRole("link", { name: "Enviar por WhatsApp" })).toHaveCount(0);
    await page.context().clearCookies(); // otra persona entra para el siguiente caso
  }
});

test("el contador, que solo lee, también puede ver el PDF y mandarlo por WhatsApp", async ({ page, browser }) => {
  const { cliente } = await ventaAlCredito(130, undefined, undefined, "987 654 321");
  const hoja = await abrirDetalle(page, cliente.nombre);
  await hoja.getByRole("button", { name: "Emitir boleta" }).click();
  await expect(tarjeta(hoja)).toContainText("aceptada", { timeout: 20_000 });

  const { contexto, pagina } = await otraPersona(browser, page);
  const hojaContador = await abrirDetalle(pagina, cliente.nombre, "contador");
  await expect(hojaContador.getByRole("link", { name: "Ver PDF" })).toBeVisible();
  await expect(hojaContador.getByRole("link", { name: "Enviar por WhatsApp" })).toBeVisible();
  await expect(hojaContador.getByRole("button", { name: /Emitir|Reintentar/ })).toHaveCount(0);
  await contexto.close();
});

test("los enlaces caben en el celular: lado a lado, de 48 px, dentro de la pantalla, y «Cerrar» sigue al alcance", async ({ page }) => {
  const { cliente } = await ventaAlCredito(140, undefined, undefined, "987 654 321");
  const hoja = await abrirDetalle(page, cliente.nombre);
  await hoja.getByRole("button", { name: "Emitir boleta" }).click();
  await expect(tarjeta(hoja)).toContainText("aceptada", { timeout: 20_000 });
  await page.waitForTimeout(800);
  const { width, height } = page.viewportSize()!;
  for (const nombre of ["Ver PDF", "Enviar por WhatsApp"]) {
    const caja = (await hoja.getByRole("link", { name: nombre }).boundingBox())!;
    expect(caja.height, `alto de «${nombre}»`).toBeGreaterThanOrEqual(48);
    expect(caja.x).toBeGreaterThanOrEqual(0);
    expect(caja.x + caja.width, `«${nombre}» dentro de la pantalla`).toBeLessThanOrEqual(width);
  }
  const medidas = await hoja.evaluate((raiz) => ({
    desborde: raiz.scrollWidth - raiz.clientWidth,
    chicos: [...raiz.querySelectorAll("button, a")].filter((e) => e.getBoundingClientRect().height < 48).map((e) => e.textContent?.trim()),
  }));
  expect(medidas.desborde).toBeLessThanOrEqual(0);
  expect(medidas.chicos, "controles de 48 px").toEqual([]);
  // «Cerrar» se alcanza: o está a la vista o la hoja se desliza hasta él (nunca queda fuera de la hoja).
  const cerrar = hoja.getByRole("button", { name: "Cerrar", exact: true });
  await cerrar.scrollIntoViewIfNeeded();
  const caja = (await cerrar.boundingBox())!;
  expect(caja.y + caja.height).toBeLessThanOrEqual(height);
});
