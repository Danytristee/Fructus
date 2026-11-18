import { expect, test, type Page } from "@playwright/test";

import { baseLocal, enSoles } from "./base";
import { entrarComo } from "./cuentas";
import { comando, crearComando, dictar } from "./dictar";

// Dictar → tarjeta → Confirmar, contra la base local. La voz se simula (/api/voz), pero el comando de voz es real: la
// venta pasa por registrar_venta y se revisa lo que quedó en la base. Cada ancho usa su propio cliente para que las
// dos corridas en paralelo no se pisen las deudas.

const base = baseLocal();
const clientePorAncho = { "s25-412": { id: 1, nombre: "Luis Paredes" }, "gama-media-360": { id: 4, nombre: "Bodega Santa Ana" } } as const;
type Ancho = keyof typeof clientePorAncho;

const saldoDe = async (clienteId: number) => Number((await base.from("v_saldo_clientes").select("saldo").eq("cliente_id", clienteId).single()).data!.saldo);
const ventasDe = async (comandoId: number) => (await base.from("ventas").select("*, venta_items(*)").eq("comando_voz_id", comandoId)).data ?? [];

function tarjeta(cliente: { id: number; nombre: string } | null, cambios: Record<string, unknown> = {}) {
  return {
    tipo: "venta",
    cliente: { dicho: cliente ? cliente.nombre.toLowerCase() : null, elegido: cliente, opciones: [] },
    items: [{ producto: { dicho: "mango", elegido: { id: 1, nombre: "Mango Kent" }, opciones: [] }, cantidad: 10, precio: { valor: 45, sugerido: true }, subtotal: 450 }],
    descuento: 0,
    total: 450,
    condicion: null,
    medio: null,
    comprobante: "ninguno",
    dudas: [],
    falta: ["condicion"],
    ...cambios,
  };
}

const dictarVenta = (page: Page, comandoId: number, t: ReturnType<typeof tarjeta>) => dictar(page, comandoId, t, "¿Así fue la venta?");

test("venta a crédito: pregunta si pagó, muestra cómo queda la deuda y la guarda una vez", async ({ page }, info) => {
  test.slow();
  const cliente = clientePorAncho[info.project.name as Ancho];
  const comandoId = await crearComando();
  const antes = await saldoDe(cliente.id);
  const hoja = await dictarVenta(page, comandoId, tarjeta(cliente));

  // Nunca asume contado: falta decir si pagó, y Confirmar no guarda.
  await expect(hoja.getByRole("button", { name: "Primero: ¿pagó o lo debe?" })).toBeDisabled();

  await hoja.getByRole("button", { name: "Lo debe", exact: true }).click();
  await expect(hoja.getByText("Con esta venta te debe")).toBeVisible();
  await expect(hoja.getByText(enSoles(antes + 450))).toBeVisible();

  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText("Venta guardada")).toBeVisible();
  await expect(page.getByText(`${cliente.nombre} te debe ${enSoles(antes + 450)}`)).toBeVisible();
  await expect(hoja).toBeHidden({ timeout: 5_000 });

  // Lo que quedó en la base.
  const ventas = await ventasDe(comandoId);
  expect(ventas).toHaveLength(1);
  expect(ventas[0]).toMatchObject({ cliente_id: cliente.id, condicion: "credito", medio_pago: null, total: 450 });
  expect(await saldoDe(cliente.id)).toBe(antes + 450);
  expect(await comando(comandoId)).toEqual({ resultado: "confirmado", latencia_ms: expect.any(Number) });
});

test("venta al contado corregida en la tarjeta: medio, cajas y precio; el comando queda como corregido", async ({ page }) => {
  test.slow();
  const comandoId = await crearComando();
  const hoja = await dictarVenta(page, comandoId, tarjeta(null, { condicion: "contado", medio: "efectivo", falta: [] }));

  // Contado dicho: efectivo a la vista, y se cambia de un toque.
  await expect(hoja.getByRole("button", { name: "Efectivo" })).toHaveAttribute("aria-pressed", "true");
  await hoja.getByRole("button", { name: "Yape" }).click();

  await hoja.getByRole("button", { name: /10 cajas de Mango Kent/ }).click();
  await hoja.getByRole("button", { name: "Una caja más" }).click();
  await hoja.getByLabel("Precio de la caja").fill("47,50");
  await expect(hoja.getByText("S/ 522.50")).toBeVisible();
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(hoja.getByText("11 cajas de Mango Kent")).toBeVisible();
  await expect(hoja.getByText("sugerido")).toHaveCount(0);

  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText("Venta guardada")).toBeVisible();

  const [venta] = await ventasDe(comandoId);
  expect(venta).toMatchObject({ cliente_id: null, condicion: "contado", medio_pago: "yape", total: 522.5 });
  expect(venta!.venta_items).toMatchObject([{ producto_id: 1, cantidad: 11, precio_unitario: 47.5, descuento: 0 }]);
  expect((await comando(comandoId)).resultado).toBe("corregido");
});

test("dos toques seguidos en Confirmar guardan una sola venta", async ({ page }) => {
  test.slow();
  const comandoId = await crearComando();
  const hoja = await dictarVenta(page, comandoId, tarjeta(null, { condicion: "contado", medio: "efectivo", falta: [] }));
  const confirmar = hoja.getByRole("button", { name: "Confirmar venta" });
  await confirmar.evaluate((b: HTMLButtonElement) => {
    b.click();
    b.click();
  });
  await expect(page.getByText("Venta guardada")).toBeVisible();
  expect(await ventasDe(comandoId)).toHaveLength(1);
});

test("el cliente dudoso se elige de una lista, y descartar se puede deshacer", async ({ page }) => {
  test.slow();
  const comandoId = await crearComando();
  const dudoso = tarjeta(null, {
    cliente: {
      dicho: "rosita",
      elegido: null,
      opciones: [
        { id: 2, nombre: "Rosa Quispe" },
        { id: 3, nombre: "Juguería El Paraíso" },
      ],
    },
    condicion: "credito",
    falta: ["cliente"],
  });
  const hoja = await dictarVenta(page, comandoId, dudoso);
  await expect(hoja.getByText("Falta elegir a quién le fiaste.")).toBeVisible();
  await hoja.getByRole("button", { name: /¿rosita\?/ }).click();
  await hoja.getByRole("button", { name: "Rosa Quispe" }).click();
  await expect(hoja.getByRole("button", { name: "Confirmar venta" })).toBeEnabled();

  // Descartar no pierde nada al toque: «Deshacer» vuelve a abrir la tarjeta.
  await hoja.getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByText("No guardé esa venta.")).toBeVisible();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(hoja).toBeVisible();
  expect((await comando(comandoId)).resultado).toBe("pendiente");

  // Descartada de verdad: pasado el «Deshacer», el comando queda descartado y no hay venta.
  await hoja.getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByText("No guardé esa venta.")).toBeHidden({ timeout: 8_000 });
  await expect.poll(async () => (await comando(comandoId)).resultado).toBe("descartado");
  expect(await ventasDe(comandoId)).toHaveLength(0);
});

// --- Regresiones de /formidable y /chaos (2026-10-29) ------------------------------------------------------------------

const esAccion = (r: { method(): string; headers(): Record<string, string> }) => r.method() === "POST" && "next-action" in r.headers();

test("se ve lo que dijiste debajo del cliente, y la pregunta de pago va escrita con dos botones", async ({ page }) => {
  test.slow();
  const hoja = await dictarVenta(page, await crearComando(), tarjeta(null, { cliente: { dicho: "don lucho", elegido: { id: 1, nombre: "Luis Paredes" }, opciones: [] } }));
  await expect(hoja.getByText("dijiste «don lucho»")).toBeVisible();
  const pregunta = hoja.getByRole("group", { name: "¿Pagó o lo debe?" });
  await expect(pregunta.getByText("¿Pagó o lo debe?")).toBeVisible();
  await expect(pregunta.getByRole("button")).toHaveCount(2);
  // Con «Pagó», la deuda vieja es una línea, no una tarjeta con barra.
  await pregunta.getByRole("button", { name: "Pagó", exact: true }).click();
  await expect(hoja.getByText("Te sigue debiendo")).toBeVisible();
  await expect(hoja.getByText("Hoy no suma")).toHaveCount(0);
});

test("un precio que no es precio se rechaza con una frase, sin adivinar ni guardar", async ({ page }) => {
  test.slow();
  const hoja = await dictarVenta(page, await crearComando(), tarjeta(null, { condicion: "contado", medio: "efectivo", falta: [] }));
  await hoja.getByRole("button", { name: /10 cajas de Mango Kent/ }).click();
  const precio = hoja.getByLabel("Precio de la caja");
  for (const [texto, frase] of [
    ["-5", "El precio no puede ser negativo."],
    ["1,299", "Escribe el precio así: 45 o 47.50."],
    ["0", "El precio tiene que ser más que cero."],
    ["9999999", "demasiado"],
  ] as const) {
    await precio.fill(texto);
    await expect(hoja.getByRole("alert")).toContainText(frase);
    await expect(hoja.getByRole("button", { name: "Listo" })).toBeDisabled();
  }
  await precio.fill("47,5");
  await expect(hoja.getByRole("alert")).toHaveCount(0);
  await expect(hoja.getByText("S/ 475.00")).toBeVisible();
});

test("mientras guarda no se puede descartar, y si la red se cuelga a los 15 s la deja en el celular sin duplicar", async ({ page }) => {
  test.setTimeout(90_000);
  const comandoId = await crearComando();
  const hoja = await dictarVenta(page, comandoId, tarjeta(null, { condicion: "contado", medio: "efectivo", falta: [] }));
  let soltar: () => void = () => {};
  const colgada = new Promise<void>((r) => (soltar = r));
  await page.route("**/*", async (r) => (esAccion(r.request()) ? (await colgada, r.fallback()) : r.fallback()));
  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(hoja.getByRole("button", { name: "Descartar" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(hoja).toBeVisible();
  // A los 15 s sin respuesta queda en el celular (ADR-0019): no pide otro toque ni dice «no guardé».
  await expect(page.getByText("Quedó en el celular")).toBeVisible({ timeout: 20_000 });
  // La red vuelve: el pedido colgado llega, y el reintento de la cola devuelve la misma venta.
  soltar();
  await page.unroute("**/*");
  await expect(page.getByText("Listo: se envió lo guardado")).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await ventasDe(comandoId)).length).toBe(1);
});

test("con la sesión vencida lo dice y ofrece entrar; al volver, la venta espera y se confirma", async ({ page, context }) => {
  test.slow();
  const comandoId = await crearComando();
  const hoja = await dictarVenta(page, comandoId, tarjeta(null, { condicion: "contado", medio: "efectivo", falta: [] }));
  await context.clearCookies();
  await hoja.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(hoja.getByText("Tu sesión terminó. Vuelve a entrar: la venta te espera en «Hoy».")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Entrar otra vez" })).toBeVisible();
  expect(await ventasDe(comandoId)).toHaveLength(0);

  await entrarComo(page, "duenio");
  await page.getByRole("button", { name: "Verla", exact: true }).click(); // exacto: si no, calza con «Open issues overlay» de Next
  await page.getByRole("dialog", { name: "¿Así fue la venta?" }).getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText("Venta guardada")).toBeVisible({ timeout: 15_000 });
  expect(await ventasDe(comandoId)).toHaveLength(1);
});

test("recargar con la tarjeta abierta no pierde lo dictado", async ({ page }) => {
  test.slow();
  const comandoId = await crearComando();
  await dictarVenta(page, comandoId, tarjeta(null, { condicion: "contado", medio: "efectivo", falta: [] }));
  await page.reload();
  await expect(page.getByText("Tienes una venta sin confirmar.")).toBeVisible();
  await page.getByRole("button", { name: "Verla", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "¿Así fue la venta?" }).getByText("10 cajas de Mango Kent")).toBeVisible();
});
