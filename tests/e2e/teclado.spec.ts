import { expect, test, type Locator, type Page } from "@playwright/test";

import { entrarComo } from "./cuentas";
import { crearComando, dictar } from "./dictar";

// Con el teclado abierto no se pierde nada: el campo donde se escribe y el botón de guardar quedan a la vista, lo escrito sigue ahí, y un
// roce (tocar afuera, deslizar, «atrás») no cierra la hoja con lo escrito adentro.
//
// Playwright no tiene teclado de verdad. Se simula como lo hace el celular con `interactive-widget=resizes-content` (app/layout.tsx): con el
// foco en el campo, la pantalla se achica lo que mide el teclado.

const TECLADO = 330;

async function conTeclado(page: Page, campo: Locator, f: () => Promise<void>) {
  const { width, height } = page.viewportSize()!;
  await campo.focus();
  await page.setViewportSize({ width, height: height - TECLADO });
  await expect(page.locator("html")).toHaveAttribute("data-teclado", "");
  await page.waitForTimeout(450); // el campo se acomoda cuando el teclado terminó de subir
  try {
    await f();
  } finally {
    await page.setViewportSize({ width, height });
  }
}

/** El campo se ve entero, dentro de la pantalla achicada, y no queda debajo del pie pegado de la hoja. */
async function aLaVista(page: Page, campo: Locator, guardar: Locator, etiqueta: string) {
  const alto = page.viewportSize()!.height;
  const c = (await campo.boundingBox())!;
  const g = (await guardar.boundingBox())!;
  expect(c.y, `«${etiqueta}» no queda arriba, fuera de la pantalla`).toBeGreaterThanOrEqual(0);
  expect(c.y + c.height, `«${etiqueta}» no queda detrás del pie con el botón`).toBeLessThanOrEqual(g.y);
  expect(g.y + g.height, `con «${etiqueta}», el botón de guardar se alcanza sin bajar el teclado`).toBeLessThanOrEqual(alto + 1);
}

/** Cada campo de la hoja, uno por uno: se escribe, sube el teclado y se revisa que todo siga a la vista y con lo escrito. */
async function revisarCampos(page: Page, hoja: Locator, guardar: Locator, valores: Record<string, string>, exact = true) {
  // Como una mano: se escribe cuando la hoja ya se acomodó (un «Más datos» recién abierto se anima 300 ms).
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity));
  for (const [etiqueta, valor] of Object.entries(valores)) {
    const campo = hoja.getByLabel(etiqueta, { exact });
    await campo.fill(valor);
    await conTeclado(page, campo, async () => {
      await aLaVista(page, campo, guardar, etiqueta);
      await page.screenshot({ path: test.info().outputPath(`teclado-${etiqueta.replace(/\W+/g, "-")}.png`) });
      await expect(campo).toHaveValue(valor);
    });
    await expect(campo, `«${etiqueta}» sigue con lo escrito al bajar el teclado`).toHaveValue(valor);
  }
  // Y nada de lo escrito antes se borró al pasar de un campo a otro.
  for (const [etiqueta, valor] of Object.entries(valores)) await expect(hoja.getByLabel(etiqueta, { exact })).toHaveValue(valor);
}

async function nuevoCliente(page: Page) {
  await entrarComo(page, "duenio");
  await page.goto("/clientes");
  await page.getByRole("button", { name: "Nuevo cliente" }).click();
  const hoja = page.getByRole("dialog", { name: "Nuevo cliente" });
  await expect(hoja).toBeVisible();
  return hoja;
}

test("el viewport le dice al celular que el teclado achique la página", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /interactive-widget=resizes-content/);
});

test("cliente nuevo: cada campo y «Guardar cliente» quedan a la vista con el teclado, y lo escrito no se pierde", async ({ page }) => {
  const hoja = await nuevoCliente(page);
  const guardar = hoja.getByRole("button", { name: "Guardar cliente" });
  await revisarCampos(page, hoja, guardar, { Nombre: "Prueba Teclado", "Apodos: cómo le dices": "la de prueba", Teléfono: "987654321" });
  // El documento se escribe después de elegir el tipo; dirección y notas, en «Más datos».
  await hoja.getByRole("button", { name: "DNI", exact: true }).click();
  await hoja.getByRole("button", { name: /Más datos/ }).click();
  await revisarCampos(page, hoja, guardar, { "Número de DNI": "45678912", Dirección: "Jr. Pizarro 123", Notas: "Paga los sábados" });
  // Lo de la primera tanda sigue ahí después de abrir «Más datos».
  await expect(hoja.getByLabel("Nombre", { exact: true })).toHaveValue("Prueba Teclado");
});

test("proveedor nuevo: cada campo y el botón de guardar quedan a la vista con el teclado", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/proveedores");
  await page.getByRole("button", { name: "Nuevo proveedor" }).click();
  const hoja = page.getByRole("dialog", { name: "Nuevo proveedor" });
  await expect(hoja).toBeVisible();
  const guardar = hoja.getByRole("button", { name: "Guardar proveedor" });
  await revisarCampos(page, hoja, guardar, {
    Nombre: "Fundo Teclado",
    "Cómo le dices (separa con comas)": "el del fundo",
    "Con quién hablas": "don Wilmer",
    Teléfono: "912345678",
    "De dónde trae la fruta": "Chao, La Libertad",
  });
  await hoja.getByRole("button", { name: /Más datos/ }).click();
  await revisarCampos(page, hoja, guardar, { RUC: "20123456789", Dirección: "Carretera a Chao km 5", Notas: "Da crédito a 15 días" });
});

test("tarjeta de voz: el precio de la caja se corrige con el teclado sin tapar «Listo»", async ({ page }) => {
  test.slow();
  const tarjeta = {
    tipo: "venta",
    cliente: { dicho: null, elegido: null, opciones: [] },
    items: [{ producto: { dicho: "mango", elegido: { id: 1, nombre: "Mango Kent" }, opciones: [] }, cantidad: 10, precio: { valor: 45, sugerido: true }, subtotal: 450 }],
    descuento: 0,
    total: 450,
    condicion: "contado",
    medio: "efectivo",
    comprobante: "ninguno",
    dudas: [],
    falta: [],
  };
  const hoja = await dictar(page, await crearComando(), tarjeta, "¿Así fue la venta?");
  await hoja.getByRole("button", { name: /10 cajas de Mango Kent/ }).click();
  // Corrigiendo la caja, el botón de abajo es «Listo»: vuelve a la venta con el precio nuevo.
  await revisarCampos(page, hoja, hoja.getByRole("button", { name: "Listo" }), { "Precio de la caja": "47,50" }, false);
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(hoja.getByText("S/ 475.00").first()).toBeVisible();
});

test("pago a un proveedor: el monto y la nota quedan a la vista con el teclado", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/proveedores");
  await page.locator('main a[href^="/proveedores/"]').first().click();
  await page.getByRole("button", { name: "Registrar pago" }).click();
  const hoja = page.getByRole("dialog", { name: /^Pago a / });
  await expect(hoja).toBeVisible({ timeout: 15_000 });
  await revisarCampos(page, hoja, hoja.getByRole("button", { name: "Confirmar pago" }), { "¿Cuánto le pagaste?": "120", "Nota (si quieres)": "a cuenta de la factura 214" });
});

test("entrar: el correo, la clave y «Entrar» quedan a la vista con el teclado", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const entrar = page.getByRole("button", { name: "Entrar" });
  for (const [etiqueta, valor] of [["Correo", "duenio@puesto.test"], ["Clave", "una-clave"]] as const) {
    const campo = page.getByLabel(etiqueta, { exact: true });
    await campo.fill(valor);
    await conTeclado(page, campo, async () => {
      await expect(campo).toBeInViewport({ ratio: 1 });
      await expect(entrar).toBeInViewport();
    });
    await expect(campo).toHaveValue(valor);
  }
});

test("con el teclado abierto se esconden la barra de abajo y los botones flotantes; al bajarlo vuelven", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/clientes");
  const barra = page.getByRole("navigation", { name: "Principal" });
  const abono = page.getByRole("button", { name: "Registrar abono" });
  await expect(barra).toBeVisible();
  const buscador = page.getByPlaceholder("Busca por nombre o apodo");
  await buscador.fill("lucho");
  await conTeclado(page, buscador, async () => {
    await expect(barra).toBeHidden();
    await expect(abono).toBeHidden();
    await expect(buscador).toBeInViewport();
  });
  await buscador.blur();
  await expect(barra).toBeVisible();
  await expect(buscador).toHaveValue("lucho");
});

test.describe("un roce no cierra la hoja con lo escrito adentro", () => {
  test("tocar afuera con el teclado abierto solo lo baja: la hoja y lo escrito siguen ahí", async ({ page }) => {
    const hoja = await nuevoCliente(page);
    const nombre = hoja.getByLabel("Nombre", { exact: true });
    await nombre.fill("Doña Prueba");
    await expect(nombre).toBeFocused();
    await page.mouse.click(200, 30); // el velo, arriba de la hoja
    await expect(hoja).toBeVisible();
    await expect(nombre).not.toBeFocused();
    await expect(nombre).toHaveValue("Doña Prueba");
  });

  test("tocar afuera, «atrás» o Escape con algo escrito preguntan; «Seguir aquí» lo conserva y «Cerrar sin guardar» cierra", async ({ page }) => {
    const hoja = await nuevoCliente(page);
    const nombre = hoja.getByLabel("Nombre", { exact: true });
    await nombre.fill("Doña Prueba");
    await nombre.blur();
    const pregunta = hoja.getByRole("alertdialog", { name: /Cierras sin guardar/ });

    await page.mouse.click(200, 30);
    await expect(pregunta).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("pregunta-antes-de-cerrar.png") });
    await hoja.getByRole("button", { name: "Seguir aquí" }).click();
    await expect(pregunta).toHaveCount(0);
    await expect(nombre).toHaveValue("Doña Prueba");

    await page.evaluate(() => history.back());
    await expect(pregunta).toBeVisible();
    await expect(page).toHaveURL("/clientes");
    await hoja.getByRole("button", { name: "Seguir aquí" }).click();

    await page.keyboard.press("Escape");
    await expect(pregunta).toBeVisible();
    await hoja.getByRole("button", { name: "Cerrar sin guardar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL("/clientes");

    // Al volver a abrirla empieza de cero y, sin nada escrito, cierra sin preguntar.
    await page.getByRole("button", { name: "Nuevo cliente" }).click();
    await expect(hoja).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("deslizarla hacia abajo con algo escrito la deja en su sitio y pregunta", async ({ page }) => {
    const hoja = await nuevoCliente(page);
    const nombre = hoja.getByLabel("Nombre", { exact: true });
    await nombre.fill("Doña Prueba");
    await nombre.blur();
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity));
    const cdp = await page.context().newCDPSession(page);
    const caja = (await hoja.locator("[data-asa]").boundingBox())!;
    const desde = { x: caja.x + caja.width / 2, y: caja.y + 12 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [desde] });
    for (let i = 1; i <= 12; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: desde.x, y: desde.y + 30 * i }] });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    await expect(hoja.getByRole("alertdialog", { name: /Cierras sin guardar/ })).toBeVisible();
    await expect.poll(() => hoja.evaluate((h) => getComputedStyle(h).translate)).toMatch(/^(none|0px( 0px)?)$/);
    await expect(nombre).toHaveValue("Doña Prueba");
  });

  test("una búsqueda no cuenta como algo escrito: la hoja cierra sin preguntar", async ({ page }) => {
    const tarjeta = {
      tipo: "venta",
      cliente: { dicho: "rosita", elegido: null, opciones: [{ id: 2, nombre: "Rosa Quispe" }, { id: 3, nombre: "Juguería El Paraíso" }] },
      items: [{ producto: { dicho: "mango", elegido: { id: 1, nombre: "Mango Kent" }, opciones: [] }, cantidad: 1, precio: { valor: 45, sugerido: true }, subtotal: 45 }],
      descuento: 0,
      total: 45,
      condicion: "contado",
      medio: "efectivo",
      comprobante: "ninguno",
      dudas: [],
      falta: [],
    };
    const hoja = await dictar(page, await crearComando(), tarjeta, "¿Así fue la venta?");
    await hoja.getByRole("button", { name: /¿rosita\?/ }).click();
    const buscar = hoja.locator('input[type="search"]').first();
    await expect(buscar).toBeVisible();
    await buscar.fill("paredes");
    await buscar.blur();
    await page.keyboard.press("Escape");
    await expect(hoja.getByRole("alertdialog")).toHaveCount(0);
  });
});
