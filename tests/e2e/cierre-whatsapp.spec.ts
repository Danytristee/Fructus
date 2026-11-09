import { expect, test, type Page } from "@playwright/test";

import { baseLocal } from "./base";
import { cuentas, entrarComo, type Rol } from "./cuentas";
import { quieto } from "./medir";

// «Enviar por WhatsApp» en el cierre del día: el mensaje sale de las mismas cifras de la pantalla, el botón se alcanza con el pulgar
// y WhatsApp se abre con el texto escrito, sin enviar nada solo.

const base = baseLocal();
const MARCA = "PRUEBA-CIERRE-WHATSAPP";

// Un cierre sin movimientos no ofrece mandar nada (a propósito): se asegura que hoy haya al menos un gasto, que ya es un día con movimiento.
test.beforeAll(async () => {
  const desde = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10) + "T00:00:00-05:00";
  const { data: hay } = await base.from("gastos").select("id").eq("descripcion", MARCA).gte("fecha", desde).limit(1);
  if (hay?.length) return;
  const { data } = await base.auth.admin.listUsers();
  const duenio = data.users.find((u) => u.email === cuentas.duenio)!.id;
  const { error } = await base.from("gastos").insert({ categoria: "otros", monto: 1, descripcion: MARCA, registrado_por: duenio });
  if (error) throw error;
});

// Las cifras animadas traen el monto dos veces (el que se ve y el que lee el lector de pantalla): se toma el primero.
const primerMonto = (texto: string) => texto.replace(/\s/g, " ").match(/-?S\/ [\d,]+\.\d{2}/)?.[0] ?? `(sin monto en «${texto}»)`;

async function abrirCierre(page: Page, rol: Rol = "duenio") {
  await entrarComo(page, rol);
  await page.goto("/cierre");
  await expect(page.getByRole("heading", { level: 1, name: "Cierre del día" })).toBeVisible();
  const enlace = page.getByRole("link", { name: "Enviar por WhatsApp" });
  await expect(enlace).toBeVisible();
  await quieto(page);
  return enlace;
}

test("el mensaje lleva las mismas cifras que se ven en la pantalla", async ({ page }) => {
  const enlace = await abrirCierre(page);
  const href = (await enlace.getAttribute("href"))!;
  expect(href.startsWith("https://wa.me/?text=")).toBe(true);
  const mensaje = decodeURIComponent(href.slice("https://wa.me/?text=".length));

  const cifraDe = async (etiqueta: string) => primerMonto(await page.getByText(etiqueta, { exact: true }).locator("xpath=following-sibling::*[1]").innerText());
  const efectivo = primerMonto(await page.getByText("Debería haber en tu caja").locator("xpath=following-sibling::*[1]").innerText());

  expect(mensaje).toMatch(/^\*Cierre del día · \p{L}+ \d{1,2} de \p{L}+\*\n/u);
  expect(mensaje).toContain(`Efectivo que debe haber en la caja: ${efectivo}`);
  for (const [etiqueta, linea] of [
    ["Vendiste", "Vendido"],
    ["Abonos", "Abonos cobrados"],
    ["Gastos", "Gastos"],
    ["Compras", "Compras al contado"],
  ] as const) {
    expect(mensaje, etiqueta).toContain(`${linea}: ${await cifraDe(etiqueta)}`);
  }
  expect(mensaje).not.toContain(" ");
});

test("el botón se alcanza con el pulgar: 48 px o más, dentro de la pantalla, y abre WhatsApp en otra pestaña sin dar acceso a la app", async ({ page, context }) => {
  // WhatsApp de verdad no se abre en la prueba: se responde la dirección y se mira a dónde iba.
  await context.route("https://wa.me/**", (ruta) => ruta.fulfill({ contentType: "text/html", body: "<title>wa.me de prueba</title>" }));
  const enlace = await abrirCierre(page);

  const caja = (await enlace.boundingBox())!;
  const ancho = page.viewportSize()!.width;
  expect(caja.height).toBeGreaterThanOrEqual(48);
  expect(caja.x).toBeGreaterThanOrEqual(0);
  expect(caja.x + caja.width).toBeLessThanOrEqual(ancho);
  await expect(enlace).toHaveAttribute("target", "_blank");
  await expect(enlace).toHaveAttribute("rel", /noopener/);

  const [otra] = await Promise.all([context.waitForEvent("page"), enlace.click()]);
  await otra.waitForLoadState("domcontentloaded");
  expect(otra.url()).toMatch(/^https:\/\/wa\.me\/\?text=/);
  expect(await otra.evaluate(() => window.opener)).toBeNull(); // noopener: la otra página no controla esta
});

for (const rol of ["ayudante", "contador"] as const) {
  test(`el ${rol} también puede mandar el cierre (ve el cierre, así que ve el botón)`, async ({ page }) => {
    await abrirCierre(page, rol);
  });
}

test("regresión /chaos 2026-11-09: el botón flota sin tapar el final; la última fila del Excel se ve y se toca entera", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/cierre");
  const boton = page.getByRole("link", { name: /Enviar por WhatsApp/ });
  await expect(boton).toBeVisible({ timeout: 15_000 });
  await quieto(page);
  // Antes, el espacio de la píldora quedaba entre el resumen y el Excel, y al final la píldora tapaba la mitad del último mes.
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const filas = [...document.querySelectorAll("button, a")].filter((b) => /Mes completo|Hasta hoy/.test(b.textContent ?? ""));
    const ultima = filas.at(-1)!.getBoundingClientRect();
    const pildora = [...document.querySelectorAll("a")].find((a) => a.textContent?.includes("Enviar por WhatsApp"))!.getBoundingClientRect();
    return { filaAbajo: ultima.bottom, pildoraArriba: pildora.top };
  });
  expect(r.filaAbajo, "la última fila termina antes de la píldora").toBeLessThanOrEqual(r.pildoraArriba);
});
