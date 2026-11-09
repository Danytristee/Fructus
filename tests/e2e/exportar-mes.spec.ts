import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";

import { mesesParaExportar } from "../../lib/exportar-reglas";
import { baseLocal, invariantes } from "./base";
import { entrarComo, type Rol } from "./cuentas";
import { boletaSembrada, diasDelMes, ESPERADO, instanteDeLima, MARCA_DE_PAGINAS, MOTIVO_DE_ANULACION, sembrarMes, sembrarPaginas, serialDeLima } from "./exportar-datos";

// El Excel del mes para el contador: la tarjeta en «Cierre», la descarga, lo que dice el archivo y lo que pasa cuando algo falla.
// La tarjeta se prueba a 412 y 360 px; el contenido del archivo no depende del ancho, así que se prueba una vez.

const MESES = mesesParaExportar(new Date());
const MES_EN_CURSO = MESES[0]!.mes;
// Meses pasados que ninguna otra prueba toca (las demás escriben «ahora»), no vecinos entre sí: las ventas de borde de uno caen en los que lo rodean.
const MES_DE_DATOS = MESES[2]!.mes;
const MES_DE_PAGINAS = MESES[4]!.mes;
const PEDIDO_DEL_EXCEL = /\/api\/exportar\?/;
const HOJAS = ["Resumen", "Ventas", "Detalle de ventas", "Abonos", "Compras", "Gastos", "Mermas"];

type Fila = (string | number | undefined)[];

/** Una hoja como filas de valores; las fechas y los montos quedan como números, igual que los ve Excel. */
function filasDe(libro: XLSX.WorkBook, hoja: string): Fila[] {
  const h = libro.Sheets[hoja];
  if (!h) throw new Error(`El archivo no trae la hoja «${hoja}»`);
  return XLSX.utils.sheet_to_json<Fila>(h, { header: 1, raw: true, defval: undefined });
}

/** Una hoja de tabla sin su fila de títulos. */
const datosDe = (libro: XLSX.WorkBook, hoja: string) => filasDe(libro, hoja).slice(1);

/** El valor de una fila del resumen, buscada por su título. */
function delResumen(libro: XLSX.WorkBook, titulo: string): string | number | undefined {
  return filasDe(libro, "Resumen").find((f) => f[0] === titulo)?.[1];
}

async function bajarMes(page: Page, mes: string) {
  const respuesta = await page.request.get(`/api/exportar?mes=${mes}`);
  expect(respuesta.status(), await respuesta.text().then((t) => (t.length < 300 ? t : "(archivo)"))).toBe(200);
  return { respuesta, libro: XLSX.read(await respuesta.body(), { type: "buffer" }) };
}

// -----------------------------------------------------------------------------------------------------------------------------------
// La tarjeta en «Cierre»
// -----------------------------------------------------------------------------------------------------------------------------------

test.describe("la tarjeta del Excel en «Cierre»", () => {
  test("ofrece los últimos 6 meses con controles de 48 px, sin desborde, y baja el del mes en curso con un toque", async ({ page }) => {
    await entrarComo(page, "duenio");
    await page.goto("/cierre");
    const filas = page.getByRole("button", { name: /Descargar el Excel de/ });
    await expect(filas).toHaveCount(6);
    await expect(filas.first()).toContainText("Hasta hoy");
    await expect(filas.nth(1)).toContainText("Mes completo");

    const ancho = page.viewportSize()!.width;
    for (const fila of await filas.all()) {
      await fila.scrollIntoViewIfNeeded();
      const caja = (await fila.boundingBox())!;
      expect(caja.height, await fila.innerText()).toBeGreaterThanOrEqual(48);
      expect(caja.x, "cada fila cabe en la pantalla, con su margen").toBeGreaterThanOrEqual(0);
      expect(caja.x + caja.width, "cada fila cabe en la pantalla, con su margen").toBeLessThanOrEqual(ancho);
    }
    // Se mide la tarjeta, no toda la página: con importes de cinco cifras el resumen de arriba ya se ensancha a 360 px (pendiente aparte).
    const tarjeta = (await page.getByRole("heading", { name: /Excel para tu contador/ }).locator("xpath=ancestor::div[contains(@class,'vidrio')][1]").boundingBox())!;
    expect(tarjeta.x + tarjeta.width, "la tarjeta del Excel no se sale por la derecha").toBeLessThanOrEqual(ancho);

    const [descarga] = await Promise.all([page.waitForEvent("download"), filas.first().click()]);
    expect(descarga.suggestedFilename()).toBe(`fructus-${MES_EN_CURSO}.xlsx`);
    const libro = XLSX.read(readFileSync(await descarga.path()), { type: "buffer" });
    expect(libro.SheetNames).toEqual(HOJAS);
    await expect(page.getByRole("status").filter({ hasText: "Listo:" })).toContainText(MESES[0]!.etiqueta);
  });

  test("un doble toque baja un solo archivo", async ({ page }) => {
    await entrarComo(page, "duenio");
    await page.goto("/cierre");
    let descargas = 0;
    page.on("download", () => descargas++);
    const fila = page.getByRole("button", { name: /Descargar el Excel de/ }).first();
    await fila.dblclick();
    await expect.poll(() => descargas).toBe(1);
    await page.waitForTimeout(1500); // si hubiera un segundo pedido, ya habría llegado
    expect(descargas).toBe(1);
  });

  test("si el servidor no puede armar el archivo, lo dice en lenguaje de puesto y se puede reintentar", async ({ page }) => {
    await entrarComo(page, "duenio");
    await page.goto("/cierre");
    await page.route(PEDIDO_DEL_EXCEL, (ruta) =>
      ruta.fulfill({ status: 502, json: { error: "No pudimos armar el Excel. Revisa tu señal e inténtalo otra vez. Lo que registraste está a salvo." } }),
    );
    const fila = page.getByRole("button", { name: /Descargar el Excel de/ }).first();
    await fila.click();
    const aviso = page.getByRole("alert").filter({ hasText: "No pudimos armar el Excel" });
    await expect(aviso).toContainText("Lo que registraste está a salvo");
    await expect(fila, "queda libre para reintentar").toBeEnabled();

    await page.unroute(PEDIDO_DEL_EXCEL);
    const [descarga] = await Promise.all([page.waitForEvent("download"), fila.click()]);
    expect(descarga.suggestedFilename()).toBe(`fructus-${MES_EN_CURSO}.xlsx`);
    await expect(aviso, "el aviso del intento fallido se va").toBeHidden();
  });

  test("sin señal dice que revise la señal y no pierde nada", async ({ page, context }) => {
    await entrarComo(page, "duenio");
    await page.goto("/cierre");
    const fila = page.getByRole("button", { name: /Descargar el Excel de/ }).first();
    await context.setOffline(true);
    await fila.click();
    await expect(page.getByRole("alert").filter({ hasText: "No pudimos armar el Excel" })).toContainText("Revisa tu señal");
    await context.setOffline(false);
    await expect(fila).toBeEnabled();
  });

  test("a 360 y 412 px la tarjeta se ve completa", async ({ page }) => {
    await entrarComo(page, "duenio");
    await page.goto("/cierre");
    const titulo = page.getByRole("heading", { name: /Excel para tu contador/ });
    await titulo.scrollIntoViewIfNeeded();
    await expect(titulo).toBeVisible();
    await expect(page.getByText("Lo anulado se ve marcado y no suma.")).toBeVisible();
  });
});

// -----------------------------------------------------------------------------------------------------------------------------------
// Quién puede y qué pasa con un pedido raro
// -----------------------------------------------------------------------------------------------------------------------------------

test.describe("la ruta /api/exportar", () => {
  test("sin sesión no entrega nada: 401, en JSON, sin guardar copia", async ({ request }) => {
    const r = await request.get(`/api/exportar?mes=${MES_EN_CURSO}`);
    expect(r.status()).toBe(401);
    expect(r.headers()["content-type"]).toContain("json");
    expect(r.headers()["cache-control"]).toContain("no-store");
    expect(await r.json()).toEqual({ error: "Tu sesión terminó. Vuelve a entrar." });
  });

  // Quien puede ver el cierre puede exportar el mes (lib/permisos-reglas.ts): los cuatro roles. La RLS decide qué filas ve cada uno.
  for (const rol of ["duenio", "administrador", "ayudante", "contador"] as Rol[]) {
    test(`${rol}: baja el mes, con su nombre de archivo y sin guardar copia`, async ({ page }) => {
      await entrarComo(page, rol);
      const { respuesta, libro } = await bajarMes(page, MES_EN_CURSO);
      expect(respuesta.headers()["content-type"]).toContain("spreadsheetml.sheet");
      expect(respuesta.headers()["content-disposition"]).toContain(`filename="fructus-${MES_EN_CURSO}.xlsx"`);
      expect(respuesta.headers()["cache-control"]).toContain("no-store");
      expect(libro.SheetNames).toEqual(HOJAS);
    });
  }

  test("un mes que no existe o que todavía no llega es 400, no un archivo vacío ni un error de la base", async ({ page }) => {
    await entrarComo(page, "duenio");
    for (const mes of ["2026-13", "hola", "1999-01", "0000-01", "2999-01", ""]) {
      const r = await page.request.get(`/api/exportar?mes=${mes}`);
      expect(r.status(), `mes=«${mes}»`).toBe(400);
      expect((await r.json()).error).toBe("Ese mes no existe o todavía no llega.");
    }
    expect((await page.request.get("/api/exportar")).status(), "sin el parámetro").toBe(400);
  });
});

// -----------------------------------------------------------------------------------------------------------------------------------
// Lo que dice el archivo
// -----------------------------------------------------------------------------------------------------------------------------------

test.describe("el archivo repite lo que hay en la base", () => {
  // Un mes sembrado con datos conocidos; las pruebas comparten el archivo que baja la primera.
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "s25-412", "El contenido del archivo no depende del ancho de la pantalla.");
  });
  test.beforeAll(async ({}, testInfo) => {
    if (testInfo.project.name !== "s25-412") return;
    await sembrarMes(MES_DE_DATOS);
  });

  let libro: XLSX.WorkBook;

  test("el resumen suma lo registrado y deja fuera lo anulado, las ventas de otro mes y la compra al crédito", async ({ page }) => {
    await entrarComo(page, "duenio");
    ({ libro } = await bajarMes(page, MES_DE_DATOS));

    expect(delResumen(libro, "Ventas registradas")).toBe(ESPERADO.ventasRegistradas);
    expect(delResumen(libro, "Ventas anuladas (no cuentan)")).toBe(ESPERADO.ventasAnuladas);
    expect(delResumen(libro, "Vendido en total")).toBe(ESPERADO.vendido);
    expect(delResumen(libro, "   al contado")).toBe(ESPERADO.contado);
    expect(delResumen(libro, "   al crédito")).toBe(ESPERADO.credito);
    expect(delResumen(libro, "Abonos cobrados")).toBe(ESPERADO.abonos);
    expect(delResumen(libro, "Gastos")).toBe(ESPERADO.gastos);
    expect(delResumen(libro, "Compras al contado")).toBe(ESPERADO.comprasAlContado);
    expect(delResumen(libro, "Cajas malogradas (mermas)")).toBe(ESPERADO.cajasMalogradas);

    const medios = filasDe(libro, "Resumen");
    expect(medios.find((f) => f[0] === "Efectivo")?.slice(1)).toEqual([ESPERADO.efectivo.entro, ESPERADO.efectivo.salio, ESPERADO.efectivo.neto]);
    expect(medios.find((f) => f[0] === "Yape")?.slice(1)).toEqual([ESPERADO.yape.entro, ESPERADO.yape.salio, ESPERADO.yape.neto]);
  });

  test("las ventas salen en orden, con cliente, estado y comprobante; las de otro mes no", async () => {
    const ventas = datosDe(libro, "Ventas");
    expect(ventas, "cuatro: la de las 10, la del crédito, la anulada y la del último día; no las dos de borde").toHaveLength(4);
    const boleta = await boletaSembrada(MES_DE_DATOS);

    // [Fecha, N.º, Cliente, Condición, Medio, Total, Estado, Comprobante, Estado del comprobante, Motivo]
    expect(ventas.map((f) => f[2])).toEqual(["Cliente prueba Excel", "Cliente prueba Excel", "Sin cliente", "Sin cliente"]);
    expect(ventas[0]!.slice(3, 9)).toEqual(["Contado", "Efectivo", 500, "Registrada", boleta, "aceptada por SUNAT"]);
    expect(ventas[1]!.slice(3, 7)).toEqual(["Crédito", undefined, 230, "Registrada"]); // al crédito: sin medio de pago, sin comprobante
    expect(ventas[2]!.slice(3, 7)).toEqual(["Contado", "Yape", 100, "Anulada"]);
    expect(ventas[2]![9]).toBe(MOTIVO_DE_ANULACION);
    expect(ventas[3]!.slice(3, 7)).toEqual(["Contado", "Efectivo", 40, "Registrada"]);

    // Lo que ve el contador cuadra: la suma de lo registrado es el total del resumen.
    const suma = ventas.filter((f) => f[6] === "Registrada").reduce((s, f) => s + Number(f[5]), 0);
    expect(suma).toBe(delResumen(libro, "Vendido en total"));
  });

  test("las horas son las de Lima: la venta de las 9 p. m. del último día no se corre al mes siguiente", async () => {
    const ventas = datosDe(libro, "Ventas");
    const ultimo = diasDelMes(MES_DE_DATOS);
    expect(Number(ventas[0]![0])).toBeCloseTo(serialDeLima(MES_DE_DATOS, 10, 9), 5);
    expect(Number(ventas[3]![0])).toBeCloseTo(serialDeLima(MES_DE_DATOS, ultimo, 21), 5);
    // En la base está guardada ya en el día siguiente (UTC): el archivo no la deja ahí.
    expect(instanteDeLima(MES_DE_DATOS, ultimo, 21).slice(0, 10)).not.toBe(`${MES_DE_DATOS}-${String(ultimo).padStart(2, "0")}`);
  });

  test("el detalle trae cada línea con su fruta y cajas; abonos, compras, gastos y mermas, a quién y cuánto", async () => {
    // [Fecha, N.º, Cliente, Fruta, Cajas, Precio por caja, Descuento, Subtotal, Estado]
    expect(datosDe(libro, "Detalle de ventas").map((f) => f.slice(3, 9))).toEqual([
      ["Mango Kent", 10, 50, 0, 500, "Registrada"],
      ["Mango Edward", 4, 57.5, 0, 230, "Registrada"],
      ["Mango Kent", 2, 50, 0, 100, "Anulada"],
      ["Mango Kent", 1, 40, 0, 40, "Registrada"],
    ]);
    // [Fecha, Cliente, Monto, Medio, Nota]
    expect(datosDe(libro, "Abonos").map((f) => f.slice(1))).toEqual([["Cliente prueba Excel", 230, "Yape", "Pagó todo (prueba)"]]);
    // [Fecha, Proveedor, Condición, Medio, Comprobante del proveedor, Total]
    expect(datosDe(libro, "Compras").map((f) => f.slice(1))).toEqual([
      ["Transportes Piura Norte", "Contado", "Efectivo", "F001-55", 480],
      ["Agrícola Chao", "Crédito", undefined, undefined, 160],
    ]);
    // [Fecha, Categoría, Descripción, Monto, Medio]
    expect(datosDe(libro, "Gastos").map((f) => [f[1], f[3], f[4]])).toEqual([["Flete", 40, "Efectivo"]]);
    // [Fecha, Fruta, Cajas, Motivo]
    expect(datosDe(libro, "Mermas").map((f) => f.slice(1))).toEqual([["Mango Kent", 3, "Se malogró (prueba)"]]);
  });

  test("el mes de prueba no deja la base descuadrada", () => {
    expect(invariantes()).toBe("limpias");
  });
});

test.describe("un mes con más de 1000 filas", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "s25-412", "El contenido del archivo no depende del ancho de la pantalla.");
  });

  test("sale completo: Supabase corta cada consulta en 1000 filas y el archivo no se queda ahí", async ({ page }) => {
    await sembrarPaginas(MES_DE_PAGINAS, 1100);
    const db = baseLocal();
    const { count, error } = await db
      .from("gastos")
      .select("id", { count: "exact", head: true })
      .like("descripcion", `${MARCA_DE_PAGINAS}%`)
      .gte("fecha", instanteDeLima(MES_DE_PAGINAS, 1, 0))
      .lt("fecha", instanteDeLima(MES_DE_PAGINAS, diasDelMes(MES_DE_PAGINAS) + 1, 0));
    expect(error).toBeNull();
    expect(count, "el mes de prueba pasa del tope de una consulta").toBeGreaterThan(1000);

    await entrarComo(page, "contador"); // el contador es quien más lo va a pedir
    const { libro: pesado } = await bajarMes(page, MES_DE_PAGINAS);
    expect(datosDe(pesado, "Gastos")).toHaveLength(count!);
    expect(delResumen(pesado, "Gastos")).toBe(count); // cada gasto de prueba es de S/ 1
  });
});
