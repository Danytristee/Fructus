import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { ErrorDeLectura, leerDatosDelMes } from "./exportar-mes";
import { rangoDelMes } from "./exportar-reglas";
import type { Database } from "./supabase/tipos-db";

const rango = rangoDelMes("2026-10", new Date("2026-11-08T15:00:00Z"))!;

/**
 * Un Supabase de mentira que contesta por páginas, como el de verdad: `tope` es el máximo de filas que devuelve cada consulta
 * (max_rows del proyecto) y `falla` es una tabla que no responde.
 */
function supabaseFalso(tablas: Record<string, unknown[]>, opciones: { tope?: number; falla?: string } = {}) {
  const pedidos: string[] = [];
  const tope = opciones.tope ?? 1000;
  const from = (tabla: string) => {
    const consulta: Record<string, unknown> = {};
    for (const metodo of ["select", "eq", "gte", "lt", "order"]) consulta[metodo] = () => consulta;
    consulta.range = (desde: number, hasta: number) => {
      pedidos.push(`${tabla}:${desde}-${hasta}`);
      if (opciones.falla === tabla) return Promise.resolve({ data: null, error: { code: "57014" } });
      const ultima = Math.min(hasta, desde + tope - 1);
      return Promise.resolve({ data: (tablas[tabla] ?? []).slice(desde, ultima + 1), error: null });
    };
    return consulta;
  };
  return { cliente: { from } as unknown as SupabaseClient<Database>, pedidos };
}

const abono = (id: number) => ({ id, fecha: "2026-10-05T14:00:00+00:00", monto: 1, medio_pago: "efectivo", nota: null, cliente_id: 1 });

describe("leerDatosDelMes (la lectura por páginas)", () => {
  it("un mes con más filas de las que Supabase devuelve por consulta sale completo", async () => {
    const { cliente, pedidos } = supabaseFalso({ abonos: Array.from({ length: 2500 }, (_, i) => abono(i + 1)) });
    const datos = await leerDatosDelMes(cliente, rango);
    expect(datos.abonos).toHaveLength(2500);
    expect(datos.abonos.map((a) => a.id)).toEqual(Array.from({ length: 2500 }, (_, i) => i + 1)); // sin saltos ni repetidas
    expect(pedidos.filter((p) => p.startsWith("abonos:"))).toEqual(["abonos:0-999", "abonos:1000-1999", "abonos:2000-2999", "abonos:2500-3499"]);
  });

  it("si el proyecto devuelve menos por consulta de lo pedido (otro max_rows), avanza por lo que llegó y no se salta filas", async () => {
    const { cliente } = supabaseFalso({ abonos: Array.from({ length: 1200 }, (_, i) => abono(i + 1)) }, { tope: 500 });
    const datos = await leerDatosDelMes(cliente, rango);
    expect(datos.abonos.map((a) => a.id)).toEqual(Array.from({ length: 1200 }, (_, i) => i + 1));
  });

  it("un mes sin movimientos da listas vacías, con una sola consulta por tabla", async () => {
    const { cliente, pedidos } = supabaseFalso({});
    const datos = await leerDatosDelMes(cliente, rango);
    expect([datos.ventas, datos.items, datos.abonos, datos.gastos, datos.compras, datos.mermas]).toEqual([[], [], [], [], [], []]);
    expect(pedidos).toHaveLength(9);
  });

  it("si una tabla no responde, no entrega un archivo a medias: falla diciendo cuál y con qué código", async () => {
    const { cliente } = supabaseFalso({}, { falla: "abonos" });
    const error = await leerDatosDelMes(cliente, rango).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDeLectura);
    expect(error).toMatchObject({ tabla: "abonos", codigo: "57014" });
    expect((error as Error).message).not.toMatch(/Luis|Rosa|S\//); // el error lleva la tabla y el código, nunca datos del puesto
  });

  it("si hay muchísimas más filas de las razonables, falla en vez de entregar un archivo recortado", async () => {
    const { cliente } = supabaseFalso({ abonos: Array.from({ length: 150_000 }, (_, i) => abono(i + 1)) });
    await expect(leerDatosDelMes(cliente, rango)).rejects.toMatchObject({ tabla: "abonos", codigo: "demasiadas-filas" });
  });

  it("los montos que llegan como texto (numeric de Postgres) pasan a número, y el ítem trae su venta", async () => {
    const venta = { fecha: "2026-10-03T14:00:00+00:00", estado: "registrada", cliente_id: null };
    const { cliente } = supabaseFalso({
      ventas: [{ id: 1, total: "230.50", fecha: venta.fecha }],
      venta_items: [{ id: 1, venta_id: 1, producto_id: 1, cantidad: "4.5", precio_unitario: "51.22", descuento: "0", subtotal: "230.50", ventas: venta }],
      movimientos_stock: [{ id: 1, cantidad: "-3", producto_id: 1, fecha: venta.fecha, motivo: null }],
    });
    const datos = await leerDatosDelMes(cliente, rango);
    expect(datos.ventas[0]?.total).toBe(230.5);
    expect(datos.items[0]).toMatchObject({ cantidad: 4.5, precio_unitario: 51.22, descuento: 0, subtotal: 230.5, venta });
    expect(datos.mermas[0]?.cantidad).toBe(-3);
  });
});
