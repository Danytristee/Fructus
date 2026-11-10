import "server-only";

// Lo que se pregunta por voz → los datos de la base → la respuesta (lib/voz/consultas-reglas.ts). Solo lee: la RLS deja
// leer a todo el que tiene sesión. Lo usan /api/voz (para que la respuesta llegue con la tarjeta, sin otra vuelta) y la
// acción responderConsulta (cuando hay que elegir antes de responder).
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/tipos-db";
import { leerResumen } from "../hoy-reglas";
import {
  respuestaDeudaCliente,
  respuestaGastosHoy,
  respuestaQuienMeDebe,
  respuestaResumenDia,
  respuestaStock,
  respuestaStockProducto,
  respuestaVentasHoy,
  type Respuesta,
} from "./consultas-reglas";
import type { Tarjeta } from "./tarjeta-reglas";
import { nombreProducto, type PartesProducto } from "../productos-reglas";

type Cliente = SupabaseClient<Database>;
type Consulta = Extract<Tarjeta, { tipo: "consulta" }>;

export type PedidoConsulta = { consulta: Consulta["consulta"]; clienteId: number | null; productoId: number | null };

/** La respuesta, o null si le falta elegir el cliente o la fruta. */
export async function responderConsulta(supabase: Cliente, p: PedidoConsulta): Promise<Respuesta | null> {
  switch (p.consulta) {
    case "quien_me_debe": {
      const { data, error } = await supabase.from("v_saldo_clientes").select("cliente_id, nombre, saldo").gt("saldo", 0);
      if (error) throw new Error(`v_saldo_clientes (${error.code})`);
      return respuestaQuienMeDebe((data ?? []).map((c) => ({ id: c.cliente_id, nombre: c.nombre, saldo: Number(c.saldo) })));
    }
    case "deuda_cliente": {
      if (p.clienteId === null) return null; // falta elegir de quién
      const [{ data: cliente, error: e1 }, { data: saldo, error: e2 }] = await Promise.all([
        supabase.from("clientes").select("id, nombre").eq("id", p.clienteId).single(),
        supabase.from("v_saldo_clientes").select("saldo").eq("cliente_id", p.clienteId).maybeSingle(),
      ]);
      if (e1 || e2) throw new Error(`deuda_cliente (${e1?.code ?? e2?.code})`);
      return respuestaDeudaCliente({ id: cliente.id, nombre: cliente.nombre, saldo: Number(saldo?.saldo ?? 0) });
    }
    case "stock_producto": {
      if (p.productoId === null) return null; // falta elegir qué fruta
      const { data, error } = await supabase.from("v_stock").select("producto_id, nombre, variedad, seleccion, calibre, stock").eq("producto_id", p.productoId).single();
      if (error) throw new Error(`stock_producto (${error.code})`);
      return respuestaStockProducto({ id: data.producto_id, nombre: nombreFruta(data), stock: Number(data.stock ?? 0) });
    }
    case "ventas_hoy":
    case "gastos_hoy":
    case "resumen_dia": {
      // El mismo resumen_dia() que «Hoy»: lo que se dice y lo que se ve en pantalla cuadran.
      const { data, error } = await supabase.rpc("resumen_dia");
      if (error) throw new Error(`resumen_dia (${error.code})`);
      const dia = leerResumen(data);
      return p.consulta === "ventas_hoy" ? respuestaVentasHoy(dia) : p.consulta === "gastos_hoy" ? respuestaGastosHoy(dia) : respuestaResumenDia(dia);
    }
    case "stock": {
      const { data, error } = await supabase.from("v_stock").select("producto_id, nombre, variedad, seleccion, calibre, stock");
      if (error) throw new Error(`stock (${error.code})`);
      return respuestaStock((data ?? []).map((x) => ({ id: x.producto_id, nombre: nombreFruta(x), stock: Number(x.stock ?? 0) })));
    }
  }
}

const nombreFruta = (p: PartesProducto) => nombreProducto(p);

/** El pedido que sale de la tarjeta de consulta: lo que se preguntó y lo que se eligió solo. */
export const pedidoDe = (t: Consulta): PedidoConsulta => ({
  consulta: t.consulta,
  clienteId: t.cliente?.elegido?.id ?? null,
  productoId: t.producto?.elegido?.id ?? null,
});
