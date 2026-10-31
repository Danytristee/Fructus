import { expect, test, type Page } from "@playwright/test";
import { baseLocal } from "./base";
import { entrarComo } from "./cuentas";
import { crearComando, dictar } from "./dictar";

// /chaos de las tarjetas de A6, semilla 31. Temporal: no se versiona.
const base = baseLocal();
const log = (...x: unknown[]) => console.log("CHAOS", ...x);
const filas = async (tabla: string, comandoId: number, extra = "") => {
  let q = base.from(tabla).select("*", { count: "exact", head: true }).eq("comando_voz_id", comandoId);
  if (extra) q = q.eq("tipo", extra);
  return (await q).count;
};
const T = {
  abono: { i: "registrar_abono", tit: "¿Así fue el abono?", tabla: "abonos", t: { tipo: "abono", cliente: { dicho: "don lucho", elegido: { id: 1, nombre: "Luis Paredes" }, opciones: [] }, monto: 10, medio: "efectivo", dudas: [], falta: [] }, boton: "Confirmar abono" },
  merma: { i: "registrar_merma", tit: "¿Así fue la merma?", tabla: "movimientos_stock", t: { tipo: "merma", producto: { dicho: "papaya", elegido: { id: 5, nombre: "Papaya" }, opciones: [] }, cantidad: 1, motivo: "se pasó", falta: [] }, boton: "Confirmar merma" },
  gasto: { i: "registrar_gasto", tit: "¿Así fue el gasto?", tabla: "gastos", t: { tipo: "gasto", categoria: "otros", monto: 5, descripcion: "bolsas", medio: "efectivo" }, boton: "Confirmar gasto" },
  compra: { i: "registrar_compra", tit: "¿Así fue la compra?", tabla: "compras", t: { tipo: "compra", proveedor: { dicho: "chao", elegido: { id: 2, nombre: "Agrícola Chao" }, opciones: [] }, items: [{ producto: { dicho: "papaya", elegido: { id: 5, nombre: "Papaya" }, opciones: [] }, cantidad: 2, costo: { valor: 20, sugerido: false } }], condicion: "contado", dudas: [], falta: [] }, boton: "Confirmar compra" },
} as const;
type K = keyof typeof T;
const contar = (k: K, id: number) => filas(T[k].tabla, id, k === "merma" ? "merma" : "");
const esAccion = (r: { method(): string; headers(): Record<string, string> }) => r.method() === "POST" && !!r.headers()["next-action"];

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => test.skip(info.project.name !== "s25-412"));

for (const k of Object.keys(T) as K[]) {
  test(`N1 cinco toques en el mismo tick: ${k}`, async ({ page }) => {
    test.slow();
    const id = await crearComando(T[k].i);
    const hoja = await dictar(page, id, T[k].t, T[k].tit);
    await hoja.getByRole("button", { name: T[k].boton }).evaluate((b: HTMLButtonElement) => { for (let n = 0; n < 5; n++) b.click(); });
    await expect(page.getByText(/guardad[oa]/)).toBeVisible({ timeout: 15_000 });
    log("N1", k, "filas", await contar(k, id));
  });
}

test("N2 red cortada al confirmar (gasto): falla, no guarda; reintento guarda una vez", async ({ page }) => {
  test.slow();
  const id = await crearComando(T.gasto.i);
  const hoja = await dictar(page, id, T.gasto.t, T.gasto.tit);
  await page.route("**/*", (r) => (esAccion(r.request()) ? r.abort() : r.fallback()));
  await hoja.getByRole("button", { name: T.gasto.boton }).click();
  await page.waitForTimeout(1500);
  log("N2 aviso", await hoja.getByRole("alert").textContent().catch(() => "(sin aviso)"), "filas", await contar("gasto", id));
  await page.unrouteAll();
  await hoja.getByRole("button", { name: T.gasto.boton }).click();
  await expect(page.getByText("Gasto guardado")).toBeVisible();
  log("N2 tras reintento filas", await contar("gasto", id));
});

for (const k of ["abono", "compra"] as const) {
  test(`N2b respuesta perdida (${k}): la base guardó pero el celular no supo`, async ({ page }) => {
    test.slow();
    const id = await crearComando(T[k].i);
    const hoja = await dictar(page, id, T[k].t, T[k].tit);
    await page.route("**/*", async (r) => (esAccion(r.request()) ? (await r.fetch(), r.abort()) : r.fallback()));
    await hoja.getByRole("button", { name: T[k].boton }).click();
    await page.waitForTimeout(2500);
    log("N2b", k, "aviso:", await hoja.getByRole("alert").textContent().catch(() => "(sin aviso)"), "filas en base:", await contar(k, id));
    await page.unrouteAll();
    // Qué ve la persona si en vez de reintentar descarta.
    await hoja.getByRole("button", { name: "Descartar" }).click();
    log("N2b", k, "aviso al descartar:", await page.getByRole("status").allTextContents().catch(() => []), await page.locator("body").innerText().then((t) => t.match(/(No guardé[^\n]*|L[ao] descarté[^\n]*)/)?.[0]));
  });
}

test("N3 voz ambigua (compra sin fruta clara, sin costo ni condición): no deja confirmar", async ({ page }) => {
  test.slow();
  const id = await crearComando(T.compra.i);
  const t = { ...T.compra.t, items: [{ producto: { dicho: "la amarilla", elegido: null, opciones: [{ id: 4, nombre: "Plátano isla" }, { id: 5, nombre: "Papaya" }] }, cantidad: 3, costo: { valor: null, sugerido: false } }], condicion: null, falta: ["producto", "costo", "condicion"] };
  const hoja = await dictar(page, id, t, T.compra.tit);
  log("N3 boton habilitado:", await hoja.getByRole("button", { name: /Primero|Confirmar compra/ }).isEnabled(), "aviso:", await hoja.locator("p.text-deuda").first().textContent());
});

for (const [nombre, texto] of [["N4 coma", "1,299.50"], ["N4 coma europea", "1.299,50"], ["A1 negativo", "-50"], ["A3 diez dígitos", "1234567890"]] as const) {
  test(`${nombre} en el monto del abono`, async ({ page }) => {
    test.slow();
    const id = await crearComando(T.abono.i);
    const hoja = await dictar(page, id, T.abono.t, T.abono.tit);
    await hoja.getByRole("button", { name: /Toca para cambiar el monto/ }).click();
    await hoja.getByLabel("¿Cuánto te dio?").fill(texto);
    log(nombre, texto, "aviso:", await hoja.getByRole("alert").textContent().catch(() => "(sin aviso)"), "Listo habilitado:", await hoja.getByRole("button", { name: "Listo" }).isEnabled());
  });
}

test("A1/A3 en el costo de la compra: -50 y 1234567890", async ({ page }) => {
  test.slow();
  const id = await crearComando(T.compra.i);
  const hoja = await dictar(page, id, T.compra.t, T.compra.tit);
  await hoja.getByRole("button", { name: /2 cajas de Papaya/ }).click();
  for (const x of ["-50", "1234567890"]) {
    await hoja.getByLabel("Costo de la caja").fill(x);
    log("costo", x, await hoja.getByRole("alert").textContent().catch(() => "(sin aviso)"), "Listo:", await hoja.getByRole("button", { name: "Listo" }).isEnabled());
  }
});

test("A2 recargar con la tarjeta abierta (merma)", async ({ page }) => {
  test.slow();
  const id = await crearComando(T.merma.i);
  await dictar(page, id, T.merma.t, T.merma.tit);
  await page.reload();
  await page.waitForLoadState("networkidle");
  const aviso = page.getByText(/sin confirmar/);
  log("A2 aviso tras recargar:", await aviso.textContent({ timeout: 8000 }).catch(() => "(ninguno)"));
  await page.getByRole("button", { name: "Verla" }).click();
  await page.getByRole("dialog", { name: T.merma.tit }).getByRole("button", { name: T.merma.boton }).click();
  await expect(page.getByText("Merma guardada")).toBeVisible();
  log("A2 filas", await contar("merma", id));
});

test("A4 sesión vencida al confirmar (abono)", async ({ page }) => {
  test.slow();
  const id = await crearComando(T.abono.i);
  const hoja = await dictar(page, id, T.abono.t, T.abono.tit);
  await page.context().clearCookies();
  await hoja.getByRole("button", { name: T.abono.boton }).click();
  await page.waitForTimeout(2000);
  log("A4 aviso:", await hoja.getByRole("alert").textContent().catch(() => "(sin aviso)"), "boton entrar:", await hoja.getByRole("button", { name: "Entrar otra vez" }).isVisible(), "filas", await contar("abono", id));
  await entrarComo(page, "duenio");
  log("A4 al volver:", await page.getByText(/sin confirmar/).textContent({ timeout: 8000 }).catch(() => "(ninguno)"));
});

test("X1 (fuera del sorteo) motivo de merma y descripción de gasto muy largos", async ({ page }) => {
  test.slow();
  const largo = "se cayó la ruma y ".repeat(20).trim();
  const id = await crearComando(T.merma.i);
  let hoja = await dictar(page, id, { ...T.merma.t, motivo: largo }, T.merma.tit);
  await hoja.getByRole("button", { name: T.merma.boton }).click();
  await page.waitForTimeout(2000);
  log("X1 merma aviso:", await hoja.getByRole("alert").textContent().catch(() => "(sin aviso)"), "filas", await contar("merma", id));
  await page.context().clearCookies();
  const id2 = await crearComando(T.gasto.i);
  hoja = await dictar(page, id2, { ...T.gasto.t, descripcion: largo }, T.gasto.tit);
  await hoja.getByRole("button", { name: T.gasto.boton }).click();
  await page.waitForTimeout(2000);
  log("X1 gasto aviso:", await hoja.getByRole("alert").textContent().catch(() => "(sin aviso)"), "filas", await contar("gasto", id2));
});
