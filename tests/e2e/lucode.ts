import { expect } from "@playwright/test";

// Hablarle al Lucode simulado (tests/e2e/lucode-simulado.mjs): ver qué recibió, decirle cómo portarse con una venta y hacer que SUNAT
// conteste. Corre en el puerto del servidor + 200, igual que en playwright.config.ts (3000 → 3200, `PUERTO=3100` → 3300).
const URL_LUCODE = `http://127.0.0.1:${Number(process.env.PUERTO ?? "3000") + 200}`;

export type Escenario = {
  /** aceptado (por defecto) | rechazado | enviado | caido (503) | invalido (200 con basura) | token (401) */
  modo?: "aceptado" | "rechazado" | "enviado" | "caido" | "invalido" | "token";
  /** «largo»: un rechazo con un motivo de unas 200 letras, como los de SUNAT. */
  motivo?: "largo";
  /** Cuánto tarda en contestar. Si pasa el tope de la app (LUCODE_TOPE_MS), la respuesta se pierde pero el proveedor igual lo guardó. */
  demoraMs?: number;
};

const MARCA = /\s*\[lucode:[^\]]*\]\s*$/;

/** El nombre sin la marca: es lo que se busca en la lista (los corchetes de la marca significarían otra cosa dentro de una expresión regular). */
export const sinMarca = (nombre: string) => nombre.replace(MARCA, "");

/** El nombre de un cliente de prueba con su marca de escenario: el simulador lee la marca del pedido, así no hay un interruptor global. */
export function conEscenario(nombre: string, { modo, demoraMs, motivo }: Escenario): string {
  const partes = [modo ? `modo=${modo}` : null, demoraMs ? `demora=${demoraMs}` : null, motivo ? `motivo=${motivo}` : null].filter(Boolean);
  return `${sinMarca(nombre)} [lucode:${partes.join(";")}]`;
}

/** Todos los pedidos que el proveedor simulado ha recibido de un cliente (uno por intento), o de todos. */
export async function recibidosPorLucode(nombreDelCliente?: string) {
  const r = await fetch(`${URL_LUCODE}/recibidos`);
  expect(r.ok, "el Lucode simulado debe estar arriba (lo arranca playwright.config.ts)").toBe(true);
  const pedidos = ((await r.json()) as { pedido: PedidoRecibido }[]).map((x) => x.pedido);
  return nombreDelCliente === undefined ? pedidos : pedidos.filter((p) => p.cliente.nombre === nombreDelCliente);
}

/** Los números por los que se le preguntó al proveedor (una entrada por pregunta): sirve para esperar a que una consulta ya haya llegado. */
export async function consultasAlProveedor(): Promise<string[]> {
  const r = await fetch(`${URL_LUCODE}/consultas`);
  expect(r.ok).toBe(true);
  return (await r.json()) as string[];
}

/** SUNAT contestó: lo que el proveedor tenía «enviado» pasa a «aceptado». */
export async function sunatContesto(serie: string, numero: number) {
  const r = await fetch(`${URL_LUCODE}/sunat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ numero: `${serie}-${String(numero).padStart(8, "0")}` }) });
  expect(r.ok).toBe(true);
}

type PedidoRecibido = {
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
