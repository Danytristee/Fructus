import { expect, test, type Page } from "@playwright/test";

import { baseLocal, enSoles } from "./base";
import { comando, crearComando, dictar } from "./dictar";

// Preguntar por voz → respuesta en pantalla y dicha en voz alta (A7). La voz se simula; la respuesta sale de la base
// local por la acción responderConsulta. speechSynthesis se reemplaza por una grabadora para ver qué se dijo.

const base = baseLocal();

async function grabarLoDicho(page: Page) {
  await page.addInitScript(() => {
    const dicho: string[] = [];
    Object.assign(window, { __dicho: dicho });
    window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => void dicho.push(u.text);
  });
}
const loDicho = (page: Page) => page.evaluate(() => (window as unknown as { __dicho: string[] }).__dicho);

/** Lo que te deben ahora, según la base: total y cuántos clientes. */
async function deudas() {
  const { data } = await base.from("v_saldo_clientes").select("saldo").gt("saldo", 0);
  return { total: (data ?? []).reduce((s, c) => s + Math.round(Number(c.saldo) * 100), 0) / 100, clientes: (data ?? []).length };
}

const consulta = (consulta: string, cambios: Record<string, unknown> = {}) => ({ tipo: "consulta", consulta, cliente: null, producto: null, respuesta: null, ...cambios });

test("«¿quién me debe?»: el total en grande, los que más deben y dicho en voz alta", async ({ page }) => {
  test.slow();
  await grabarLoDicho(page);
  const antes = await deudas();
  const comandoId = await crearComando("consultar");
  const hoja = await dictar(page, comandoId, consulta("quien_me_debe"), "Quién te debe");

  // En desarrollo, la primera vez se compila la acción que responde: hasta 15 s, como la hoja (dictar()).
  await expect(hoja.getByText("Te deben")).toBeVisible({ timeout: 15_000 });
  const despues = await deudas();
  // Las otras pruebas abonan y fían en paralelo: vale el total de antes o el de después.
  const totales = [enSoles(antes.total), enSoles(despues.total)];
  await expect(hoja.getByText(new RegExp(totales.map((t) => t.replace(/[.$()]/g, "\\$&")).join("|"))).first()).toBeVisible();
  await expect(hoja.getByText(/entre \d+ clientes/)).toBeVisible();
  await expect(hoja.getByRole("listitem").first()).toBeVisible();

  // Se dijo apenas llegó, con los montos en palabras; «Escuchar» lo repite. (En desarrollo, React monta dos veces y
  // la frase se corta y vuelve a empezar: se cuenta lo último que se dijo, no cuántas veces.)
  await expect.poll(async () => (await loDicho(page)).at(-1)).toMatch(/^Te deben .* soles/);
  const veces = (await loDicho(page)).length;
  await hoja.getByRole("button", { name: "Escuchar" }).click();
  await expect.poll(async () => (await loDicho(page)).length).toBeGreaterThan(veces);

  // Listo cierra sin aviso de «No guardé»: no había nada que guardar. El comando queda confirmado.
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(hoja).toBeHidden();
  await expect(page.getByText(/No guardé/)).toHaveCount(0);
  expect((await comando(comandoId)).resultado).toBe("confirmado");
});

test("la respuesta que llega con la tarjeta se muestra sin pedirla otra vez, y recargar no deja nada «sin confirmar»", async ({ page }) => {
  test.slow();
  await grabarLoDicho(page);
  const respuesta = {
    titulo: "Quién te debe",
    etiqueta: "Nadie te debe",
    cifra: null,
    detalle: "Tu cuaderno está al día",
    filas: [],
    mas: 0,
    enlace: { texto: "Ver todo el cuaderno", href: "/clientes" },
    hablado: "Nadie te debe. Tu cuaderno está al día.",
  };
  // Solo cuentan las acciones que se piden después de dictar (entrar también usa una acción).
  let dicto = false;
  let pidio = false;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/voz")) dicto = true;
    else if (dicto && r.method() === "POST" && r.headers()["next-action"]) pidio = true;
  });
  const hoja = await dictar(page, await crearComando("consultar"), consulta("quien_me_debe", { respuesta }), "Quién te debe");
  await expect(hoja.getByText("Nadie te debe")).toBeVisible();
  await expect.poll(async () => (await loDicho(page)).at(-1)).toBe("Nadie te debe. Tu cuaderno está al día.");
  expect(pidio).toBe(false);

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/sin confirmar/)).toHaveCount(0);
});

test("una pregunta que todavía no se responde lo dice, y se cierra sin aviso", async ({ page }) => {
  test.slow();
  const hoja = await dictar(page, await crearComando("consultar"), consulta("stock"), "Tu stock");
  await expect(hoja.getByText("Esa pregunta todavía no la sé responder.", { exact: false })).toBeVisible({ timeout: 15_000 });
  await hoja.getByRole("button", { name: "Entendido" }).click();
  await expect(page.getByText(/No guardé/)).toHaveCount(0);
});
