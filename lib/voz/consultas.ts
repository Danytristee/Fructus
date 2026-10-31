import "server-only";

// Lo que se pregunta por voz → los datos de la base → la respuesta (lib/voz/consultas-reglas.ts). Solo lee: la RLS deja
// leer a todo el que tiene sesión. Lo usan /api/voz (para que la respuesta llegue con la tarjeta, sin otra vuelta) y la
// acción responderConsulta (cuando hay que elegir antes de responder).
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/tipos-db";
import { respuestaQuienMeDebe, type Respuesta } from "./consultas-reglas";
import type { Tarjeta } from "./tarjeta-reglas";

type Cliente = SupabaseClient<Database>;
type Consulta = Extract<Tarjeta, { tipo: "consulta" }>;

export type PedidoConsulta = { consulta: Consulta["consulta"]; clienteId: number | null; productoId: number | null };

/** La respuesta, o null si esa pregunta todavía no se responde (o le falta elegir el cliente o la fruta). */
export async function responderConsulta(supabase: Cliente, p: PedidoConsulta): Promise<Respuesta | null> {
  switch (p.consulta) {
    case "quien_me_debe": {
      const { data, error } = await supabase.from("v_saldo_clientes").select("cliente_id, nombre, saldo").gt("saldo", 0);
      if (error) throw new Error(`v_saldo_clientes (${error.code})`);
      return respuestaQuienMeDebe((data ?? []).map((c) => ({ id: c.cliente_id, nombre: c.nombre, saldo: Number(c.saldo) })));
    }
    default:
      return null;
  }
}

/** El pedido que sale de la tarjeta de consulta: lo que se preguntó y lo que se eligió solo. */
export const pedidoDe = (t: Consulta): PedidoConsulta => ({
  consulta: t.consulta,
  clienteId: t.cliente?.elegido?.id ?? null,
  productoId: t.producto?.elegido?.id ?? null,
});
