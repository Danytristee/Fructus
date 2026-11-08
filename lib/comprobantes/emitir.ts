import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { leerDocumento } from "@/lib/cliente-reglas";
import { diaDeLima } from "@/lib/formato";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import type { Database, Json } from "@/lib/supabase/tipos-db";
import { armarPedido, type CodigoTipo, type ComprobanteVista, type DatosDeVenta } from "./comprobante-reglas";
import { enviarAlProveedor, leerConfiguracion } from "./lucode";

// Emitir una boleta o una factura de una venta (A9). El orden importa y es siempre el mismo (CLAUDE.md, «Comprobantes»):
//   1. se reserva el número en la base y el comprobante queda «pendiente» ANTES de hablar con el proveedor;
//   2. solo quien reservó el número lo envía (si ya había uno vigente, se devuelve ese: un segundo toque no repite nada);
//   3. se guarda lo que contestó el proveedor, tal cual, y el estado sale de ahí.
// Si el proveedor no contesta, el comprobante se queda pendiente: nunca se da por aceptado ni se pierde el número.

export type ResultadoEmision = { ok: true; comprobante: ComprobanteVista; aviso?: string } | { ok: false; error: string };

const CODIGO: Record<"boleta" | "factura", CodigoTipo> = { boleta: "03", factura: "01" };

const SIN_SENAL = "No se pudo emitir. Revisa tu señal e inténtalo otra vez.";
const NO_CONFIGURADO = "Los comprobantes todavía no están configurados. Avísale a quien administra el sistema.";

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
  if (codigo === "P0002") return "No encontré esa venta: puede que ya no esté en tu historial.";
  return SIN_SENAL;
}

type ClienteUsuario = SupabaseClient<Database>;

export async function emitirComprobanteDeVenta(args: { supabase: ClienteUsuario; ventaId: number; tipo: "boleta" | "factura"; ruc?: string }): Promise<ResultadoEmision> {
  const { supabase, ventaId, tipo } = args;

  // Sin proveedor configurado no se reserva ningún número: no se gasta un correlativo que no se puede enviar.
  const config = leerConfiguracion();
  if (!config.ok) {
    console.error("comprobantes: falta configurar el proveedor", { faltan: config.faltan });
    return { ok: false, error: NO_CONFIGURADO };
  }

  // La venta se lee con la sesión de la persona (la RLS decide qué ve), no con la llave de servicio.
  const { data: venta, error: errorVenta } = await supabase
    .from("ventas")
    .select(
      "id, total, estado, cliente:clientes(id, nombre, tipo_documento, numero_documento), items:venta_items(cantidad, precio_unitario, descuento, subtotal, producto:productos(nombre, variedad, afectacion_igv))",
    )
    .eq("id", ventaId)
    .maybeSingle();
  if (errorVenta) {
    console.error("comprobantes: no se pudo leer la venta", { ventaId, codigo: errorVenta.code });
    return { ok: false, error: SIN_SENAL };
  }
  if (!venta) return { ok: false, error: "No encontré esa venta: puede que ya no esté en tu historial." };
  if (venta.estado !== "registrada") return { ok: false, error: "Esa venta está anulada: no se le emite comprobante." };

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
  const vista = (estado: string, pdfUrl: string | null): ComprobanteVista => ({ id: r.id, tipo: r.tipo, serie: r.serie, numero: r.numero, estado, pdfUrl });

  // Ya había uno vigente (otro toque, otra persona, o un intento anterior): ese es. Quien no reservó el número no lo envía.
  if (!r.nuevo) return { ok: true, comprobante: vista(r.estado, r.pdf_url) };

  const datos: DatosDeVenta = {
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

  const respuesta = await enviarAlProveedor(config.configuracion, armarPedido({ tipo: r.tipo, serie: r.serie, numero: r.numero }, datos, config.configuracion.emisor));

  if (respuesta.tipo === "sin-respuesta") {
    // No se sabe si lo recibió: se queda pendiente, con su número, para reintentar sin duplicar.
    return { ok: true, comprobante: vista("pendiente", null), aviso: "No hubo respuesta del proveedor. El comprobante quedó en proceso." };
  }

  const nuevo =
    respuesta.tipo === "aceptado"
      ? { estado: "aceptado" as const, respuesta: respuesta.cruda, pdf_url: respuesta.pdfUrl, xml_url: respuesta.xmlUrl }
      : respuesta.tipo === "rechazado"
        ? { estado: "rechazado" as const, respuesta: respuesta.cruda, pdf_url: null, xml_url: null }
        : { estado: "enviado" as const, respuesta: respuesta.cruda, pdf_url: null, xml_url: null };

  // Solo si seguía pendiente: una respuesta tardía no pisa lo que otro ya dejó.
  const { error: errorGuardar } = await servicio
    .from("comprobantes")
    .update({ ...nuevo, respuesta: nuevo.respuesta as Json, actualizado_en: new Date().toISOString() })
    .eq("id", r.id)
    .eq("estado", "pendiente");
  if (errorGuardar) {
    console.error("comprobantes: no se pudo guardar la respuesta", { comprobanteId: r.id, codigo: errorGuardar.code });
    return { ok: true, comprobante: vista("pendiente", null), aviso: "El proveedor contestó, pero no pude guardar la respuesta. El comprobante quedó en proceso." };
  }

  if (respuesta.tipo === "rechazado") return { ok: false, error: `El proveedor rechazó el comprobante: ${respuesta.mensaje}` };
  return { ok: true, comprobante: vista(nuevo.estado, nuevo.pdf_url) };
}
