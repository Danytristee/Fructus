import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { leerDocumento } from "@/lib/cliente-reglas";
import { diaDeLima } from "@/lib/formato";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import type { Database, Json } from "@/lib/supabase/tipos-db";
import {
  armarPedido,
  mensajeDeRespuesta,
  type CodigoTipo,
  type ComprobanteVista,
  type ConsultaDelProveedor,
  type DatosDeVenta,
  type PedidoLucode,
  type RespuestaDelProveedor,
} from "./comprobante-reglas";
import { consultarEnProveedor, enviarAlProveedor, leerConfiguracion, type ConfiguracionLucode } from "./lucode";

// Emitir una boleta o una factura de una venta, y reintentar las que no terminaron (A9). El orden importa y es siempre el mismo
// (CLAUDE.md, «Comprobantes»):
//   1. se reserva el número en la base y el comprobante queda «pendiente» ANTES de hablar con el proveedor;
//   2. solo quien reservó el número lo envía (si ya había uno vigente, se devuelve ese: un segundo toque no repite nada);
//   3. se guarda lo que contestó el proveedor, tal cual, y el estado sale de ahí;
//   4. si no contestó, se queda pendiente CON SU NÚMERO: reintentar reenvía ese mismo número, nunca toma otro; y si el proveedor
//      dice que ya lo tiene, se le pregunta cómo quedó y se toma esa respuesta.
// Nunca se da por aceptado ni por rechazado algo que no se entendió.

export type ResultadoEmision =
  | { ok: true; comprobante: ComprobanteVista; aviso?: string }
  /** `comprobante` dice cómo quedó si el fallo cambió su estado (un rechazo): la pantalla lo muestra en vez de dejarlo en «en proceso». */
  | { ok: false; error: string; comprobante?: ComprobanteVista };

const CODIGO: Record<"boleta" | "factura", CodigoTipo> = { boleta: "03", factura: "01" };

const SIN_SENAL = "No se pudo emitir. Revisa tu señal e inténtalo otra vez.";
const NO_CONFIGURADO = "Los comprobantes todavía no están configurados. Avísale a quien administra el sistema.";
const YA_NO_ESTA = "No encontré esa venta: puede que ya no esté en tu historial.";

const reserva = z.object({
  id: z.number(),
  tipo: z.enum(["01", "03"]),
  serie: z.string(),
  numero: z.number(),
  estado: z.string(),
  pdf_url: z.string().nullable(),
  nuevo: z.boolean(),
});

/** Lo que la base dice cuando no deja reservar el número, en palabras de puesto. */
function fraseDeLaReserva(codigo: string | undefined, mensaje: string): string {
  if (mensaje.includes("factura va a un cliente con RUC")) return "Una factura va a un cliente con RUC. Agrégale el RUC en su ficha.";
  if (mensaje.includes("boleta de más de S/ 700")) return "Una boleta de más de S/ 700 lleva el DNI del cliente. Agrégalo en su ficha.";
  if (mensaje.includes("está anulada")) return "Esa venta está anulada: no se le emite comprobante.";
  if (codigo === "P0002") return YA_NO_ESTA;
  return SIN_SENAL;
}

type ClienteUsuario = SupabaseClient<Database>;
type ClienteServicio = ReturnType<typeof crearClienteServicio>;

/** El comprobante de una fila de la base, tal como lo ve la pantalla (con el motivo si lo rechazaron). */
function vistaDe(f: { id: number; tipo: string; serie: string; numero: number; estado: string; pdf_url: string | null; respuesta?: Json | null }): ComprobanteVista {
  return {
    id: f.id,
    tipo: f.tipo === "01" ? "01" : "03",
    serie: f.serie,
    numero: f.numero,
    estado: f.estado,
    pdfUrl: f.pdf_url,
    motivo: f.estado === "rechazado" ? mensajeDeRespuesta(f.respuesta) : null,
  };
}

const SELECT_VENTA =
  "id, total, estado, cliente:clientes(id, nombre, tipo_documento, numero_documento), items:venta_items(cantidad, precio_unitario, descuento, subtotal, producto:productos(nombre, variedad, afectacion_igv))";

/** La venta se lee con la sesión de la persona (la RLS decide qué ve), no con la llave de servicio. */
async function leerVenta(supabase: ClienteUsuario, ventaId: number) {
  const { data, error } = await supabase.from("ventas").select(SELECT_VENTA).eq("id", ventaId).maybeSingle();
  if (error) {
    console.error("comprobantes: no se pudo leer la venta", { ventaId, codigo: error.code });
    return { ok: false as const, error: SIN_SENAL };
  }
  if (!data) return { ok: false as const, error: YA_NO_ESTA };
  if (data.estado !== "registrada") return { ok: false as const, error: "Esa venta está anulada: no se le emite comprobante." };
  return { ok: true as const, venta: data };
}

type VentaLeida = Extract<Awaited<ReturnType<typeof leerVenta>>, { ok: true }>["venta"];
type ClienteDeVenta = NonNullable<VentaLeida["cliente"]>;

function datosDeVenta(venta: VentaLeida, cliente: ClienteDeVenta | null): DatosDeVenta {
  return {
    fecha: diaDeLima(new Date()),
    total: Number(venta.total),
    cliente: cliente
      ? {
          tipoDocumento: cliente.tipo_documento === "RUC" || cliente.tipo_documento === "DNI" ? cliente.tipo_documento : null,
          numeroDocumento: cliente.numero_documento,
          nombre: cliente.nombre,
        }
      : null,
    items: venta.items.map((i) => ({
      descripcion: [i.producto?.nombre, i.producto?.variedad].filter(Boolean).join(" ") || "Fruta",
      cantidad: Number(i.cantidad),
      precioUnitario: Number(i.precio_unitario),
      descuento: Number(i.descuento),
      subtotal: Number(i.subtotal),
      afectacionIgv: i.producto?.afectacion_igv ?? "20",
    })),
  };
}

type Fila = { id: number; tipo: CodigoTipo; serie: string; numero: number };

/**
 * Guarda lo que dijo el proveedor en el comprobante. Solo si sigue en el estado que se esperaba (`esperado`): una respuesta tardía
 * no pisa lo que otra persona ya dejó; si otra persona llegó primero, se devuelve cómo quedó. Sin respuesta (o sin entender) no se
 * toca nada: el comprobante sigue como estaba, con su número.
 */
async function guardarRespuesta(servicio: ClienteServicio, fila: Fila, respuesta: RespuestaDelProveedor | ConsultaDelProveedor, esperado: "pendiente" | "enviado"): Promise<ResultadoEmision> {
  const vistaSinCambios = (aviso?: string): ResultadoEmision => ({ ok: true, comprobante: vistaDe({ ...fila, estado: esperado, pdf_url: null }), ...(aviso ? { aviso } : {}) });

  if (respuesta.tipo === "sin-respuesta") {
    // Emitiendo, «en proceso» ya lo dice el estado (y qué hacer, la ayuda de la pantalla). Preguntando, sí se avisa que no se pudo.
    return vistaSinCambios(esperado === "pendiente" ? undefined : "No pude preguntarle al proveedor. Inténtalo de nuevo.");
  }
  if (respuesta.tipo === "no-existe" || respuesta.tipo === "ya-existe") {
    return vistaSinCambios("El proveedor no confirma ese número todavía. Inténtalo de nuevo en un momento.");
  }

  const cambios =
    respuesta.tipo === "aceptado"
      ? { estado: "aceptado" as const, respuesta: respuesta.cruda, pdf_url: respuesta.pdfUrl, xml_url: respuesta.xmlUrl }
      : respuesta.tipo === "rechazado"
        ? { estado: "rechazado" as const, respuesta: respuesta.cruda, pdf_url: null, xml_url: null }
        : { estado: "enviado" as const, respuesta: respuesta.cruda, pdf_url: null, xml_url: null };

  const { data: guardado, error } = await servicio
    .from("comprobantes")
    .update({ ...cambios, respuesta: cambios.respuesta as Json, actualizado_en: new Date().toISOString() })
    .eq("id", fila.id)
    .eq("estado", esperado)
    .select("id, tipo, serie, numero, estado, pdf_url, respuesta")
    .maybeSingle();
  if (error) {
    console.error("comprobantes: no se pudo guardar la respuesta", { comprobanteId: fila.id, codigo: error.code });
    return vistaSinCambios("El proveedor contestó, pero no pude guardar la respuesta. Inténtalo de nuevo.");
  }

  // Otra persona terminó este comprobante antes: se muestra cómo quedó, sin pisarlo.
  const quedo = guardado ?? (await servicio.from("comprobantes").select("id, tipo, serie, numero, estado, pdf_url, respuesta").eq("id", fila.id).maybeSingle()).data;
  if (!quedo) return { ok: false, error: SIN_SENAL };
  const vista = vistaDe(quedo);

  if (vista.estado === "rechazado") {
    return { ok: false, error: `El proveedor rechazó el comprobante${vista.motivo ? `: ${vista.motivo}` : "."}`, comprobante: vista };
  }
  return { ok: true, comprobante: vista };
}

/**
 * Manda el comprobante al proveedor y guarda lo que contestó. Si dice que ese número ya lo tiene (se lo mandamos antes y no supimos
 * cómo quedó), no se repite: se le pregunta cómo quedó y se toma esa respuesta.
 */
async function resolverConProveedor(servicio: ClienteServicio, config: ConfiguracionLucode, fila: Fila, pedido: PedidoLucode, esperado: "pendiente" | "enviado"): Promise<ResultadoEmision> {
  let respuesta: RespuestaDelProveedor | ConsultaDelProveedor = await enviarAlProveedor(config, pedido);
  if (respuesta.tipo === "ya-existe") respuesta = await consultarEnProveedor(config, fila.serie, fila.numero);
  return guardarRespuesta(servicio, fila, respuesta, esperado);
}

/** Emite el comprobante de una venta (boleta o factura). Si la venta ya tenía uno vigente, devuelve ese. */
export async function emitirComprobanteDeVenta(args: { supabase: ClienteUsuario; ventaId: number; tipo: "boleta" | "factura"; ruc?: string }): Promise<ResultadoEmision> {
  const { supabase, ventaId, tipo } = args;

  // Sin proveedor configurado no se reserva ningún número: no se gasta un correlativo que no se puede enviar.
  const config = leerConfiguracion();
  if (!config.ok) {
    console.error("comprobantes: falta configurar el proveedor", { faltan: config.faltan });
    return { ok: false, error: NO_CONFIGURADO };
  }

  const leida = await leerVenta(supabase, ventaId);
  if (!leida.ok) return leida;
  const venta = leida.venta;

  // Una factura a un cliente que todavía no tiene documento lleva el RUC que se acaba de pedir. Se guarda con la sesión de la persona,
  // no con la llave de servicio: la RLS decide quién edita clientes (dueño y administrador), aunque alguien salte la pantalla.
  let cliente = venta.cliente;
  if (tipo === "factura" && cliente && cliente.tipo_documento === null) {
    const lectura = leerDocumento("RUC", args.ruc ?? "");
    if (!lectura.ok || lectura.numero === null) return { ok: false, error: lectura.ok ? "Escribe el RUC: son 11 números." : lectura.error };
    const { data: puesto, error: errorRuc } = await supabase
      .from("clientes")
      .update({ tipo_documento: "RUC", numero_documento: lectura.numero })
      .eq("id", cliente.id)
      .is("tipo_documento", null) // solo si sigue sin documento: otra persona pudo ponérselo mientras tanto
      .select("id")
      .maybeSingle();
    if (errorRuc) {
      console.error("comprobantes: no se pudo guardar el RUC del cliente", { clienteId: cliente.id, codigo: errorRuc.code });
      return { ok: false, error: errorRuc.code === "23514" ? "Ese RUC no es válido." : SIN_SENAL };
    }
    if (puesto) cliente = { ...cliente, tipo_documento: "RUC", numero_documento: lectura.numero };
    else {
      // No se tocó ninguna fila: o no tiene permiso (la RLS), o alguien ya le puso un documento. Se mira cuál.
      const { data: actual } = await supabase.from("clientes").select("tipo_documento, numero_documento").eq("id", cliente.id).maybeSingle();
      if (actual?.tipo_documento !== "RUC") return { ok: false, error: "Solo el dueño o el administrador pueden agregar el RUC de un cliente." };
      cliente = { ...cliente, tipo_documento: actual.tipo_documento, numero_documento: actual.numero_documento };
    }
  }

  const servicio = crearClienteServicio();
  const { data: reservado, error: errorReserva } = await servicio.rpc("reservar_comprobante", { p_venta_id: ventaId, p_tipo: CODIGO[tipo] });
  if (errorReserva) {
    console.error("comprobantes: no se pudo reservar el número", { ventaId, codigo: errorReserva.code });
    return { ok: false, error: fraseDeLaReserva(errorReserva.code, errorReserva.message) };
  }
  const leido = reserva.safeParse(reservado);
  if (!leido.success) {
    console.error("comprobantes: la reserva volvió con una forma inesperada", { ventaId });
    return { ok: false, error: SIN_SENAL };
  }
  const r = leido.data;

  // Ya había uno vigente (otro toque, otra persona, o un intento anterior): ese es. Quien no reservó el número no lo envía.
  if (!r.nuevo) return { ok: true, comprobante: vistaDe({ ...r, pdf_url: r.pdf_url }) };

  const fila: Fila = { id: r.id, tipo: r.tipo, serie: r.serie, numero: r.numero };
  const pedido = armarPedido({ tipo: r.tipo, serie: r.serie, numero: r.numero }, datosDeVenta(venta, cliente), config.configuracion.emisor);
  return resolverConProveedor(servicio, config.configuracion, fila, pedido, "pendiente");
}

/**
 * Reintenta un comprobante que no terminó. Pendiente (no hubo respuesta): se reenvía **el mismo número**, nunca se toma otro; y si el
 * proveedor ya lo tenía, se le pregunta cómo quedó. Enviado (esperando a SUNAT): solo se pregunta cómo va. Lo ya aceptado se devuelve
 * tal cual; lo rechazado o anulado ya no se reintenta (se emite uno nuevo).
 */
export async function reintentarComprobanteDeVenta(args: { supabase: ClienteUsuario; comprobanteId: number }): Promise<ResultadoEmision> {
  const { supabase, comprobanteId } = args;
  const config = leerConfiguracion();
  if (!config.ok) {
    console.error("comprobantes: falta configurar el proveedor", { faltan: config.faltan });
    return { ok: false, error: NO_CONFIGURADO };
  }

  const { data: fila, error } = await supabase
    .from("comprobantes")
    .select("id, venta_id, tipo, serie, numero, estado, pdf_url, respuesta")
    .eq("id", comprobanteId)
    .maybeSingle();
  if (error) {
    console.error("comprobantes: no se pudo leer el comprobante", { comprobanteId, codigo: error.code });
    return { ok: false, error: SIN_SENAL };
  }
  if (!fila) return { ok: false, error: "No encontré ese comprobante." };
  const vista = vistaDe(fila);
  if (fila.estado === "aceptado") return { ok: true, comprobante: vista };
  if (fila.estado !== "pendiente" && fila.estado !== "enviado") {
    return { ok: false, error: "Ese comprobante ya no está vigente: emite uno nuevo.", comprobante: vista };
  }

  const servicio = crearClienteServicio();
  const referencia: Fila = { id: fila.id, tipo: vista.tipo, serie: fila.serie, numero: fila.numero };

  if (fila.estado === "enviado") {
    return guardarRespuesta(servicio, referencia, await consultarEnProveedor(config.configuracion, fila.serie, fila.numero), "enviado");
  }

  const leida = await leerVenta(supabase, fila.venta_id);
  if (!leida.ok) return leida;
  const pedido = armarPedido(referencia, datosDeVenta(leida.venta, leida.venta.cliente), config.configuracion.emisor);
  return resolverConProveedor(servicio, config.configuracion, referencia, pedido, "pendiente");
}
