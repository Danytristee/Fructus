import { expect, test, type Page } from "@playwright/test";

import { baseLocal } from "./base";
import { entrarComo, type Rol } from "./cuentas";

// Alta y edición de un cliente a mano (A8): lo que se ve en la hoja es lo que queda en la base, un reintento no duplica, y solo
// el dueño y el administrador la ven. Todos los clientes de estas pruebas se llaman «Alta de prueba …» y se quitan al terminar.

test.setTimeout(90_000);
const base = baseLocal();
const PREFIJO = "Alta de prueba";

const nombreUnico = () => `${PREFIJO} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
const clientesDe = async (nombre: string) =>
  (await base.from("clientes").select("id, nombre, alias, tipo_documento, numero_documento, telefono, direccion, notas").eq("nombre", nombre)).data ?? [];

test.afterAll(async () => {
  await base.from("clientes").delete().like("nombre", `${PREFIJO}%`);
});

async function abrirNuevo(page: Page, rol: Rol = "duenio") {
  await entrarComo(page, rol);
  await page.goto("/clientes");
  await page.getByRole("button", { name: "Nuevo cliente" }).click();
  const hoja = page.getByRole("dialog", { name: "Nuevo cliente" });
  await expect(hoja).toBeVisible({ timeout: 20_000 });
  return hoja;
}

test("el dueño da de alta a un cliente con apodos, teléfono y documento, y se abre su ficha", async ({ page }) => {
  const nombre = nombreUnico();
  const hoja = await abrirNuevo(page);

  // Sin nombre no se guarda, y lo dice como instrucción (no en rojo).
  await expect(hoja.getByText("Escribe cómo se llama.")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Guardar cliente" })).toBeDisabled();

  await hoja.getByLabel("Nombre", { exact: true }).fill(nombre);
  // Un apodo se agrega con Enter y queda como un chip en minúscula, que se quita con un toque.
  await hoja.getByLabel("Apodos: cómo le dices").fill("Don Prueba");
  await hoja.getByLabel("Apodos: cómo le dices").press("Enter");
  await expect(hoja.getByRole("button", { name: "Quitar «don prueba»" })).toBeVisible();
  await hoja.getByLabel("Apodos: cómo le dices").fill("Se quita");
  await hoja.getByRole("button", { name: "Agregar apodo" }).click();
  await hoja.getByRole("button", { name: "Quitar «se quita»" }).click();
  await expect(hoja.getByRole("button", { name: "Quitar «se quita»" })).toHaveCount(0);
  // Un apodo escrito y no agregado se agrega solo al guardar: no se pierde en silencio.
  await hoja.getByLabel("Apodos: cómo le dices").fill("el nuevo");

  await hoja.getByLabel("Teléfono").fill("987 654 321");
  await hoja.getByRole("button", { name: "DNI", exact: true }).click();
  await hoja.getByLabel("Número de DNI").fill("40123456");

  await hoja.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(page.getByText("Cliente guardado")).toBeVisible();
  await expect(page).toHaveURL(/\/clientes\/\d+$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1, name: nombre })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sus datos" })).toContainText("DNI 40123456");

  // Lo que quedó en la base: un solo cliente, limpio.
  const filas = await clientesDe(nombre);
  expect(filas).toEqual([
    { id: expect.any(Number), nombre, alias: ["don prueba", "el nuevo"], tipo_documento: "DNI", numero_documento: "40123456", telefono: "987 654 321", direccion: null, notas: null },
  ]);
  await expect(page).toHaveURL(`/clientes/${filas[0]!.id}`);
});

test("un documento o un teléfono mal escritos no se guardan y dicen cómo escribirlos", async ({ page }) => {
  const nombre = nombreUnico();
  const hoja = await abrirNuevo(page);
  await hoja.getByLabel("Nombre", { exact: true }).fill(nombre);
  const guardar = hoja.getByRole("button", { name: "Guardar cliente" });
  await expect(guardar).toBeEnabled();

  await hoja.getByRole("button", { name: "DNI", exact: true }).click();
  await expect(guardar).toBeDisabled(); // elegir el tipo pide el número
  await hoja.getByLabel("Número de DNI").fill("1234567");
  await hoja.getByLabel("Teléfono").click(); // al salir del campo, el error se ve junto a él
  await expect(hoja.getByText("El DNI tiene 8 números.").first()).toBeVisible();
  await expect(guardar).toBeDisabled();

  await hoja.getByRole("button", { name: "RUC", exact: true }).click();
  await hoja.getByLabel("Número de RUC").fill("30601234567");
  await hoja.getByLabel("Teléfono").click();
  await expect(hoja.getByText("El RUC tiene 11 números y empieza con 10 o 20.").first()).toBeVisible();

  await hoja.getByLabel("Número de RUC").fill("20601234567");
  await hoja.getByLabel("Teléfono").fill("llamar tarde");
  await hoja.getByLabel("Nombre", { exact: true }).click();
  await expect(hoja.getByText("Escribe el teléfono solo con números, por ejemplo 987 654 321.").first()).toBeVisible();
  await expect(guardar).toBeDisabled();

  await hoja.getByLabel("Teléfono").fill("");
  await expect(guardar).toBeEnabled();
  await hoja.getByRole("button", { name: "Ninguno" }).click();
  await expect(hoja.getByLabel("Número de RUC")).toHaveCount(0);
  expect(await clientesDe(nombre)).toEqual([]);
});

test("respuesta perdida al guardar: no se crea otro cliente, y al reintentar es el mismo", async ({ page }) => {
  const nombre = nombreUnico();
  const hoja = await abrirNuevo(page);
  await hoja.getByLabel("Nombre", { exact: true }).fill(nombre);
  await hoja.getByLabel("Teléfono").fill("987 111 222");
  await page.waitForTimeout(600); // que termine la búsqueda de parecidos y no se cruce con el guardado

  // El pedido llega al servidor y se guarda, pero la respuesta se pierde en el camino.
  await page.route("**/*", async (r) => (r.request().method() === "POST" && r.request().headers()["next-action"] ? (await r.fetch(), r.abort()) : r.fallback()));
  await hoja.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("La señal no respondió y no sé si se guardó. Toca Guardar cliente otra vez: no se va a repetir.");
  expect(await clientesDe(nombre)).toHaveLength(1);

  // La persona toca otra vez, como le dice la hoja: el servidor ve que es el mismo cliente y responde con él.
  await page.unrouteAll();
  await hoja.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(page.getByText("Cliente guardado")).toBeVisible();
  const filas = await clientesDe(nombre);
  expect(filas).toHaveLength(1);
  await expect(page).toHaveURL(`/clientes/${filas[0]!.id}`, { timeout: 15_000 });
});

test("otro cliente con el mismo nombre no se crea: dice cómo distinguirlos", async ({ page }) => {
  const nombre = nombreUnico();
  await base.from("clientes").insert({ nombre, telefono: "999 000 111" });
  const hoja = await abrirNuevo(page);
  await hoja.getByLabel("Nombre", { exact: true }).fill(nombre.toUpperCase().replace("ALTA DE PRUEBA", "Alta de prueba"));
  await hoja.getByLabel("Teléfono").fill("987 654 321"); // otro teléfono: no es un reintento, es otra persona
  await page.waitForTimeout(600);
  await hoja.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(hoja.getByRole("alert")).toContainText("Ya tienes un cliente con ese nombre.");
  await expect(hoja.getByRole("alert")).toContainText("Juan Pérez (puesto 12)");
  expect(await clientesDe(nombre)).toHaveLength(1);
});

test("un nombre que se parece a un cliente avisa antes de duplicar a «don Lucho»", async ({ page }) => {
  const hoja = await abrirNuevo(page);
  const nombre = hoja.getByLabel("Nombre", { exact: true });
  await nombre.fill("Luis Paredez");
  const aviso = hoja.getByRole("note");
  await expect(aviso).toContainText("Ya tienes a Luis Paredes («don lucho»). ¿Es el mismo?");
  await expect(aviso.getByRole("link", { name: "Ver ficha" })).toHaveAttribute("href", /\/clientes\/\d+$/);
  // Con otro nombre, el aviso se va; y no impide guardar a quien de verdad es otro.
  await nombre.fill(`${PREFIJO} sin parecido ${Date.now()}`);
  await expect(aviso).toHaveCount(0);
  await expect(hoja.getByRole("button", { name: "Guardar cliente" })).toBeEnabled();
});

test("desde la ficha se edita: no deja guardar sin cambios, y los cambios quedan en la base y en la pantalla", async ({ page }) => {
  const nombre = nombreUnico();
  const { data } = await base.from("clientes").insert({ nombre, alias: ["el viejo"], telefono: "987 000 000" }).select("id").single();
  await entrarComo(page, "duenio");
  await page.goto(`/clientes/${data!.id}`);
  await page.getByRole("button", { name: "Editar" }).click();
  const hoja = page.getByRole("dialog", { name: "Editar cliente" });
  await expect(hoja).toBeVisible({ timeout: 20_000 });

  // Trae lo que ya había; sin tocar nada no se puede guardar.
  await expect(hoja.getByLabel("Nombre", { exact: true })).toHaveValue(nombre);
  await expect(hoja.getByLabel("Teléfono")).toHaveValue("987 000 000");
  await expect(hoja.getByRole("button", { name: "Quitar «el viejo»" })).toBeVisible();
  await expect(hoja.getByText("Todavía no cambiaste nada.")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Guardar cliente" })).toBeDisabled();

  await hoja.getByLabel("Teléfono").fill("987 654 321");
  await hoja.getByLabel("Apodos: cómo le dices").fill("el nuevo");
  await hoja.getByRole("button", { name: "Agregar apodo" }).click();
  await hoja.getByRole("button", { name: "Quitar «el viejo»" }).click();
  await hoja.getByRole("button", { name: /Más datos/ }).click();
  await hoja.getByLabel("Notas").fill("Paga los viernes");
  await hoja.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();
  await expect(hoja).toBeHidden({ timeout: 6_000 });

  // La ficha se rearmó sola con lo nuevo; el nombre no cambió y se quedó en la misma ficha.
  await expect(page).toHaveURL(`/clientes/${data!.id}`);
  await expect(page.getByRole("region", { name: "Sus datos" })).toContainText("987 654 321");
  await expect(page.getByRole("region", { name: "Sus datos" })).toContainText("Paga los viernes");
  expect(await clientesDe(nombre)).toEqual([
    { id: data!.id, nombre, alias: ["el nuevo"], tipo_documento: null, numero_documento: null, telefono: "987 654 321", direccion: null, notas: "Paga los viernes" },
  ]);
});

test("editar el nombre de un cliente por el de otro no se deja", async ({ page }) => {
  const nombre = nombreUnico();
  const { data } = await base.from("clientes").insert({ nombre }).select("id").single();
  await entrarComo(page, "duenio");
  await page.goto(`/clientes/${data!.id}`);
  await page.getByRole("button", { name: "Editar" }).click();
  const hoja = page.getByRole("dialog", { name: "Editar cliente" });
  await expect(hoja).toBeVisible({ timeout: 20_000 });
  await hoja.getByLabel("Nombre", { exact: true }).fill("Luis Paredes");
  await page.waitForTimeout(600);
  await hoja.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(hoja.getByRole("alert")).toContainText("Ya tienes un cliente con ese nombre.");
  expect(await clientesDe(nombre)).toHaveLength(1);
  expect(await clientesDe("Luis Paredes")).toHaveLength(1);
});

test("la hoja cabe en la pantalla, con controles de 48 px y «Guardar» a la vista", async ({ page }) => {
  const hoja = await abrirNuevo(page);
  await hoja.getByLabel("Nombre", { exact: true }).fill(nombreUnico());
  await hoja.getByRole("button", { name: "RUC", exact: true }).click();
  await hoja.getByRole("button", { name: /Más datos/ }).click();
  await page.waitForTimeout(800); // que terminen las animaciones de entrada
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
  const guardar = await hoja.getByRole("button", { name: "Guardar cliente" }).boundingBox();
  expect(guardar!.y + guardar!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});

for (const rol of ["ayudante", "contador"] as const) {
  test(`el ${rol} no ve «Nuevo cliente» ni «Editar»`, async ({ page }) => {
    const nombre = nombreUnico();
    const { data } = await base.from("clientes").insert({ nombre, telefono: "987 654 321" }).select("id").single();
    await entrarComo(page, rol);
    await page.goto("/clientes");
    await expect(page.getByRole("heading", { level: 1, name: "Clientes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nuevo cliente" })).toHaveCount(0);
    await page.goto(`/clientes/${data!.id}`);
    await expect(page.getByRole("region", { name: "Sus datos" })).toContainText("987 654 321");
    await expect(page.getByRole("button", { name: "Editar" })).toHaveCount(0);
  });
}

// ---- Lo que cambió con el OK del 2026-11-05 (cada prueba falló antes del cambio) ----

test("regresión /chaos: dos personas editan campos distintos del mismo cliente a la vez, y los dos cambios quedan", async ({ page, browser, baseURL }) => {
  const nombre = nombreUnico();
  const { data } = await base.from("clientes").insert({ nombre, telefono: "987 000 000" }).select("id").single();
  const abrirEdicion = async (p: Page, rol: Rol) => {
    await entrarComo(p, rol);
    await p.goto(`/clientes/${data!.id}`);
    await p.getByRole("button", { name: "Editar" }).click();
    const hoja = p.getByRole("dialog", { name: "Editar cliente" });
    await expect(hoja).toBeVisible({ timeout: 20_000 });
    return hoja;
  };
  const hojaA = await abrirEdicion(page, "duenio");
  const contexto = await browser.newContext({ baseURL, viewport: page.viewportSize()!, locale: "es-PE", timezoneId: "America/Lima" });
  const paginaB = await contexto.newPage();
  const hojaB = await abrirEdicion(paginaB, "administrador");

  // Una cambia el teléfono; la otra agrega un apodo. Las dos guardan al mismo tiempo.
  await hojaA.getByLabel("Teléfono").fill("987 111 111");
  await hojaB.getByLabel("Apodos: cómo le dices").fill("el otro");
  await hojaB.getByRole("button", { name: "Agregar apodo" }).click();
  await Promise.all([hojaA.getByRole("button", { name: "Guardar cliente" }).click(), hojaB.getByRole("button", { name: "Guardar cliente" }).click()]);
  await expect(page.getByText("Cambios guardados")).toBeVisible();
  await expect(paginaB.getByText("Cambios guardados")).toBeVisible();
  await contexto.close();

  const filas = await clientesDe(nombre);
  expect(filas).toEqual([expect.objectContaining({ telefono: "987 111 111", alias: ["el otro"] })]);
});

test("con la pantalla de lado, «Guardar cliente» queda a la vista y no hay que deslizar la hoja", async ({ page }) => {
  const hoja = await abrirNuevo(page);
  await hoja.getByLabel("Nombre", { exact: true }).fill(nombreUnico());
  await page.setViewportSize({ width: 915, height: 412 }); // el celular girado
  await page.waitForTimeout(700);
  const guardar = await hoja.getByRole("button", { name: "Guardar cliente" }).boundingBox();
  expect(guardar!.y).toBeGreaterThanOrEqual(0);
  expect(guardar!.y + guardar!.height).toBeLessThanOrEqual(412);
});

test("en escritorio, con el formulario largo, «Guardar cliente» queda a la vista", async ({ browser, baseURL }) => {
  const contexto = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 }, locale: "es-PE", timezoneId: "America/Lima" });
  const pagina = await contexto.newPage();
  const hoja = await abrirNuevo(pagina);
  await hoja.getByLabel("Nombre", { exact: true }).fill("Luis Paredez");
  await hoja.getByLabel("Apodos: cómo le dices").fill("don prueba");
  await hoja.getByRole("button", { name: "Agregar apodo" }).click();
  await hoja.getByRole("button", { name: "RUC", exact: true }).click();
  await hoja.getByLabel("Número de RUC").fill("2060123456");
  await hoja.getByRole("button", { name: /Más datos/ }).click();
  await pagina.waitForTimeout(900);
  const guardar = await hoja.getByRole("button", { name: "Guardar cliente" }).boundingBox();
  await contexto.close();
  expect(guardar!.y + guardar!.height).toBeLessThanOrEqual(800);
});
