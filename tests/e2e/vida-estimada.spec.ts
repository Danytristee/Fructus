import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { baseLocal, entornoLocal } from "./base";
import { entrarComo } from "./cuentas";
import { verTuStock } from "./stock";

// La vida útil que estima la IA, de punta a punta y sin salir de esta máquina (ADR-0021): la ruta del cron le pregunta al modelo de
// mentira (tests/e2e/sonnet-simulado.mjs) por las frutas que no tienen estimación, guarda lo que acepta y Stock cuenta con eso y
// dice de dónde sale. Necesita el servidor que levanta Playwright (`PUERTO=3100 pnpm e2e`): uno ya abierto le preguntaría al modelo
// de verdad. Corre una sola vez (a 412 px) y en orden: cada prueba parte de lo que dejó la anterior.

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => test.skip(info.project.name !== "s25-412", "no depende del ancho de la pantalla"));
test.setTimeout(120_000);

const base = baseLocal();
const SECRETO = entornoLocal().CRON_SECRET ?? "";
const MODELO_SIMULADO = `http://127.0.0.1:${Number(process.env.PUERTO ?? "3000") + 500}`;
const MARCA = `E2EVIDA${Date.now()}`;
const RUTA = "/api/cron/resumen-diario";
const conSecreto = { authorization: `Bearer ${SECRETO}` };
const DIA_MS = 86_400_000;
/** Las 7 a. m. de Lima (UTC−5) de hace `n` días. */
const haceDias = (n: number) => `${new Date(Date.now() - 5 * 3_600_000 - n * DIA_MS).toISOString().slice(0, 10)}T07:00:00-05:00`;

type Pedido = { modelo: string; esfuerzo?: string; formato?: string; conClave: boolean; frutas: { id: number; fruta: string; tabla: number }[] };
const pedidos = async (): Promise<Pedido[]> => (await (await fetch(`${MODELO_SIMULADO}/recibidos`)).json()) as Pedido[];
type InformeVida = { motivo: string; pedidas: number; guardadas: number; recortadas: number; codigo?: string };
const correrElCron = async (request: APIRequestContext) => ((await (await request.get(RUTA, { headers: conSecreto })).json()) as { vidaUtil: InformeVida }).vidaUtil;

const frutas: Record<"menos" | "loca" | "falla", number> = { menos: 0, loca: 0, falla: 0 };

async function crearFruta(nombre: string, marca: string): Promise<number> {
  const { data, error } = await base.from("productos").insert({ nombre, calibre: `${MARCA}-${marca}`, unidad: "caja" }).select("id").single();
  if (error) throw new Error(`No se pudo crear la fruta de prueba: ${error.message}`);
  return data.id;
}

test.beforeAll(async () => {
  await fetch(`${MODELO_SIMULADO}/recibidos`, { method: "DELETE" });
  // Una papaya (la tabla dice 5 días) que el modelo de mentira va a estimar en 4, y que llegó hace 3 días con clima normal: con la
  // tabla le queda un día; con la estimación tiene que salir hoy. La base no acepta fechas viejas al insertar: entra hoy y se mueve.
  frutas.menos = await crearFruta("Papaya", "sim-menos");
  const { data: duenio } = await base.from("perfiles").select("id").eq("rol", "duenio").limit(1).single();
  const { data: cajas, error } = await base.from("movimientos_stock").insert({ producto_id: frutas.menos, tipo: "ajuste", cantidad: 6, motivo: "prueba e2e", registrado_por: duenio!.id }).select("id").single();
  if (error) throw new Error(`No se pudieron cargar las cajas de prueba: ${error.message}`);
  await base.from("movimientos_stock").update({ fecha: haceDias(3) }).eq("id", cajas.id);
  // Y un mango al que el modelo le va a dar 400 días: la app lo mete al margen de la tabla (7 → a lo más 10).
  frutas.loca = await crearFruta("Mango", "sim-loco");
});

test.afterAll(async () => {
  // Las frutas de prueba no se borran (CLAUDE.md): quedan inactivas. Lo que «estimó» el modelo de mentira sí se quita de la base
  // local, para que quien use esta base después no vea motivos «Simulado» ni se quede sin la estimación de verdad.
  await base.from("vida_util_estimada").delete().like("motivo", "Simulado%");
  await base.from("vida_util_estimada").delete().in("producto_id", Object.values(frutas).filter(Boolean));
  await base.from("productos").update({ activo: false }).in("id", Object.values(frutas).filter(Boolean));
});

/** Abre la hoja «¿por qué?» de la llegada de esa fruta, desde su fila en «Tu stock». */
async function abrirElPorQue(page: Page, marca: string) {
  await entrarComo(page, "duenio");
  await page.goto("/stock");
  await verTuStock(page);
  // La fila de la fruta es el renglón más de adentro que nombra su calibre de marca (el grupo de su fruta también lo contiene).
  const fila = page.getByRole("listitem").filter({ hasText: marca }).last();
  await fila.getByRole("button").first().click();
  await fila.getByRole("list", { name: /^Llegadas de / }).getByRole("button").first().click();
  const hoja = page.getByRole("dialog", { name: new RegExp(marca) });
  await expect(hoja).toBeVisible({ timeout: 20_000 });
  return hoja;
}

test("antes de la primera estimación, Stock cuenta con la tabla y lo dice", async ({ page }) => {
  const hoja = await abrirElPorQue(page, `${MARCA}-sim-menos`);
  await expect(hoja).toContainText("Para estas cajas cuento unos 5 días con clima normal, según la tabla del sistema.");
});

test("el cron le pregunta al modelo solo por las frutas sin estimación, guarda lo que acepta y no vuelve a preguntar", async ({ request }) => {
  const informe = await correrElCron(request);
  expect(informe, JSON.stringify(informe)).toMatchObject({ motivo: "estimado" });
  expect(informe.guardadas).toBeGreaterThanOrEqual(2);
  expect(informe.recortadas).toBeGreaterThanOrEqual(1);

  // Lo que se le mandó: el modelo acordado, salida con esquema y, de cada fruta, solo su nombre y lo que dice la tabla.
  const [pedido, ...otros] = await pedidos();
  expect(otros, "una sola llamada por noche").toEqual([]);
  expect(pedido).toMatchObject({ modelo: "claude-sonnet-5-5", esfuerzo: "low", formato: "json_schema", conClave: true });
  expect(pedido!.frutas.find((f) => f.id === frutas.menos)).toEqual({ id: frutas.menos, fruta: `Papaya, calibre ${MARCA}-sim-menos`, tabla: 5 });

  // Lo que quedó en la base: la estimación de cada una, con su motivo y el modelo; la disparatada, metida al margen.
  const { data } = await base.from("v_vida_util").select("producto_id, dias, motivo, modelo").in("producto_id", [frutas.menos, frutas.loca]);
  expect(data!.find((f) => f.producto_id === frutas.menos)).toMatchObject({ dias: 4, motivo: "Simulado: llega más madura y se pasa antes.", modelo: "claude-sonnet-5-5" });
  expect(data!.find((f) => f.producto_id === frutas.loca)).toMatchObject({ dias: 10 });

  // Si el cron corre otra vez, no hay nada nuevo que preguntar: ni llama al modelo ni duplica filas.
  expect(await correrElCron(request)).toMatchObject({ motivo: "sin-novedad", pedidas: 0 });
  expect(await pedidos()).toHaveLength(1);
  const { count } = await base.from("vida_util_estimada").select("id", { count: "exact", head: true }).eq("producto_id", frutas.menos);
  expect(count).toBe(1);
});

test("Stock cuenta con la estimación, y la hoja dice quién lo estimó, cuándo y por qué", async ({ page }) => {
  const hoja = await abrirElPorQue(page, `${MARCA}-sim-menos`);
  // Con 4 días en vez de 5, la papaya que llegó hace 3 ya gastó los suyos (con el calor de la semilla, incluso antes).
  await expect(hoja.getByText(/^(Tiene que salir hoy|Revísala antes de vender)$/)).toBeVisible();
  await expect(hoja).toContainText("Para estas cajas cuento unos 4 días con clima normal. Lo estimó la IA hoy: Simulado: llega más madura y se pasa antes.");
  await expect(hoja).toContainText("Es un cálculo aproximado. Mira la fruta antes de decidir.");
});

test("si el modelo falla, el cron contesta igual y la fruta nueva sigue con la tabla", async ({ request }) => {
  frutas.falla = await crearFruta("Chirimoya", "sim-falla");
  const respuesta = await request.get(RUTA, { headers: conSecreto });
  expect(respuesta.status(), "el aviso de la noche no depende del modelo").toBeLessThan(500);
  const { vidaUtil } = (await respuesta.json()) as { vidaUtil: InformeVida };
  expect(vidaUtil).toMatchObject({ motivo: "fallo", pedidas: 1, guardadas: 0, codigo: "InternalServerError" });
  const { count } = await base.from("vida_util_estimada").select("id", { count: "exact", head: true }).eq("producto_id", frutas.falla);
  expect(count).toBe(0);
});
