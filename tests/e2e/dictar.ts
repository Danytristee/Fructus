import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { baseLocal, entornoLocal } from "./base";
import { CLAVE_PRUEBA, cuentas, entrarComo } from "./cuentas";

// Dictar por voz en las pruebas: la voz se simula (/api/voz responde la tarjeta que se le pase), pero el comando de voz es
// real, para que la operación pase por la base y se revise lo que quedó.

const base = baseLocal();

async function idDelDuenio() {
  const { data } = await base.auth.admin.listUsers();
  return data.users.find((u) => u.email === cuentas.duenio)!.id;
}

/** Un comando de voz pendiente, como lo deja /api/voz. */
export async function crearComando(intencion = "registrar_venta") {
  const { data, error } = await base
    .from("comandos_voz")
    .insert({ transcripcion: "prueba e2e", intencion, resultado: "pendiente", registrado_por: await idDelDuenio() })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export const comando = async (id: number) => (await base.from("comandos_voz").select("resultado, latencia_ms").eq("id", id).single()).data!;

/** Entra como dueño, simula la voz con esa tarjeta, dicta y espera la hoja con ese título. */
export async function dictar(page: Page, comandoId: number, tarjeta: object, titulo: string) {
  await entrarComo(page, "duenio");
  await page.route("/api/voz", (r) => r.fulfill({ json: { comandoId, tarjeta, latenciaMs: 900 } }));
  await page.waitForLoadState("networkidle"); // que React monte el botón antes de presionarlo
  const caja = (await page.getByRole("button", { name: "Botón de voz" }).boundingBox())!;
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  // Se cuenta desde que el micrófono graba (vibra y dice «Te escucho»), no desde el toque.
  await expect(page.locator("button[data-estado]")).toHaveAttribute("data-estado", "escuchando", { timeout: 10_000 });
  await page.waitForTimeout(900);
  await page.mouse.up();
  const hoja = page.getByRole("dialog", { name: titulo });
  // En desarrollo, la primera vez se compila la hoja (se carga en diferido).
  await expect(hoja).toBeVisible({ timeout: 15_000 });
  return hoja;
}

/** Una sesión de dueño contra la base local, para preparar datos por las mismas RPC que usa la app. */
async function comoDuenio() {
  const e = entornoLocal();
  const duenio = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { error } = await duenio.auth.signInWithPassword({ email: cuentas.duenio, password: CLAVE_PRUEBA });
  if (error) throw error;
  return duenio;
}

/** Le fía a un cliente (una venta al crédito de 1 caja de Mango Kent), para que tenga deuda que abonar. */
export async function fiar(clienteId: number, monto: number) {
  const { error } = await (await comoDuenio()).rpc("registrar_venta", {
    p: { cliente_id: clienteId, condicion: "credito", items: [{ producto_id: 1, cantidad: 1, precio_unitario: monto }] },
  });
  if (error) throw error;
}

/** Una venta al contado «al paso» (sin cliente) de 1 caja de Mango Kent, para que el historial tenga una venta sin nombre. */
export async function venderAlPaso(monto: number, medio: "efectivo" | "yape" | "plin" | "transferencia" = "efectivo") {
  const { data, error } = await (await comoDuenio()).rpc("registrar_venta", {
    p: { condicion: "contado", medio_pago: medio, items: [{ producto_id: 1, cantidad: 1, precio_unitario: monto }] },
  });
  if (error) throw error;
  return data as number;
}

/** Compra cajas de una fruta al contado, para que haya stock que mermar. */
export async function abastecer(productoId: number, cajas: number) {
  const { error } = await (await comoDuenio()).rpc("registrar_compra", {
    p: { condicion: "contado", medio_pago: "efectivo", items: [{ producto_id: productoId, cantidad: cajas, costo_unitario: 20 }] },
  });
  if (error) throw error;
}

export const stockDe = async (productoId: number) => Number((await base.from("v_stock").select("stock").eq("producto_id", productoId).single()).data!.stock);
export const saldoDe = async (clienteId: number) => Number((await base.from("v_saldo_clientes").select("saldo").eq("cliente_id", clienteId).single()).data!.saldo);
