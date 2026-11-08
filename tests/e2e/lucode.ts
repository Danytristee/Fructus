import { expect } from "@playwright/test";

// Hablarle al Lucode simulado (tests/e2e/lucode-simulado.mjs): ver qué recibió y cómo se porta.
// Corre en el puerto del servidor + 200, igual que en playwright.config.ts (3000 → 3200, `PUERTO=3100` → 3300).
const URL_LUCODE = `http://127.0.0.1:${Number(process.env.PUERTO ?? "3000") + 200}`;

export type PedidoRecibido = {
  tipo: string;
  serie: string;
  numero: number;
  fecha_emision: string;
  moneda: string;
  emisor: { ruc: string; razon_social: string };
  cliente: { tipo_documento: string; numero_documento: string; nombre: string };
  items: { descripcion: string; cantidad: number; precio_unitario: number; valor_venta: number; afectacion_igv: string; igv: number }[];
  totales: { gravado: number; exonerado: number; igv: number; total: number };
};

/** Todo lo que el proveedor simulado ha recibido desde el último «limpiar». */
export async function recibidosPorLucode(): Promise<PedidoRecibido[]> {
  const r = await fetch(`${URL_LUCODE}/recibidos`);
  expect(r.ok, "el Lucode simulado debe estar arriba (lo arranca playwright.config.ts)").toBe(true);
  return ((await r.json()) as { pedido: PedidoRecibido }[]).map((x) => x.pedido);
}

/** Cambia cómo se porta el proveedor simulado (por ahora, cuánto demora en contestar) y/o borra lo recibido. */
export async function controlarLucode(cambios: { demoraMs?: number; limpiar?: boolean }) {
  const r = await fetch(`${URL_LUCODE}/control`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cambios) });
  expect(r.ok).toBe(true);
}
