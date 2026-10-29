import { expect, test, type Page } from "@playwright/test";

import { baseLocal, enSoles } from "./base";
import { cuentas, entrarComo } from "./cuentas";

// Dictar → tarjeta → Confirmar, contra la base local. La voz se simula (/api/voz), pero el comando de voz es real: la
// venta pasa por registrar_venta y se revisa lo que quedó en la base. Cada ancho usa su propio cliente para que las
// dos corridas en paralelo no se pisen las deudas.

const base = baseLocal();
const clientePorAncho = { "s25-412": { id: 1, nombre: "Luis Paredes" }, "gama-media-360": { id: 4, nombre: "Bodega Santa Ana" } } as const;
type Ancho = keyof typeof clientePorAncho;

async function idDelDuenio() {
  const { data } = await base.auth.admin.listUsers();
  return data.users.find((u) => u.email === cuentas.duenio)!.id;
}

/** Un comando de voz pendiente, como lo deja /api/voz. */
async function crearComando() {
  const { data, error } = await base
    .from("comandos_voz")
    .insert({ transcripcion: "prueba e2e", intencion: "registrar_venta", resultado: "pendiente", registrado_por: await idDelDuenio() })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const saldoDe = async (clienteId: number) => Number((await base.from("v_saldo_clientes").select("saldo").eq("cliente_id", clienteId).single()).data!.saldo);
const ventasDe = async (comandoId: number) => (await base.from("ventas").select("*, venta_items(*)").eq("comando_voz_id", comandoId)).data ?? [];
const comando = async (id: number) => (await base.from("comandos_voz").select("resultado, latencia_ms").eq("id", id).single()).data!;

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

/** Entra, simula la voz con esa tarjeta, dicta y espera la hoja. */
async function dictarVenta(page: Page, comandoId: number, t: ReturnType<typeof tarjeta>) {
  await entrarComo(page, "duenio");
  await page.route("/api/voz", (r) => r.fulfill({ json: { comandoId, tarjeta: t, latenciaMs: 900 } }));
  await page.waitForLoadState("networkidle"); // que React monte el botón antes de presionarlo
  const caja = (await page.getByRole("button", { name: "Botón de voz" }).boundingBox())!;
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  // Se cuenta desde que el micrófono graba (vibra y dice «Te escucho»), no desde el toque.
  await expect(page.locator("button[data-estado]")).toHaveAttribute("data-estado", "escuchando", { timeout: 10_000 });
  await page.waitForTimeout(900);
  await page.mouse.up();
  const hoja = page.getByRole("dialog", { name: "¿Así fue la venta?" });
  // En desarrollo, la primera vez se compila la hoja (se carga en diferido).
  await expect(hoja).toBeVisible({ timeout: 15_000 });
  return hoja;
}

test("venta a crédito: pregunta si pagó, muestra cómo queda la deuda y la guarda una vez", async ({ page }, info) => {
  test.slow();
  const cliente = clientePorAncho[info.project.name as Ancho];
  const comandoId = await crearComando();
  const antes = await saldoDe(cliente.id);
  const hoja = await dictarVenta(page, comandoId, tarjeta(cliente));

  // Nunca asume contado: falta decir si pagó, y Confirmar no guarda.
  await expect(hoja.getByText("Falta elegir si pagó o lo debe.")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Confirmar venta" })).toBeDisabled();

  await hoja.getByRole("button", { name: "Lo debe" }).click();
  await expect(hoja.getByText(`Con esta venta, ${cliente.nombre} te debe`)).toBeVisible();
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
