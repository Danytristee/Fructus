// Las 8 herramientas del intérprete (docs/interprete-voz.md, sección 3), escritas una sola vez en Zod.
// De aquí salen dos cosas: la validación de lo que devuelve el modelo y el JSON Schema que se le manda a Groq.
// Así nunca hay dos versiones distintas de una herramienta. Lógica pura: no importa React ni Supabase.
import { z } from "zod";

import { ESTADOS_LLEGADA } from "../vida-util-reglas";

const medio = z.enum(["efectivo", "yape", "plin", "transferencia"]);
const condicion = z.enum(["contado", "credito"]);
const dudas = z.array(z.string()).default([]).describe("Dudas cortas, en español, para mostrar en la tarjeta.");
const cantidad = z.number().positive().describe("Cajas.");
const dinero = z.number().nonnegative();

const herramientasVoz = {
  registrar_venta: {
    descripcion: "El usuario vendió fruta a un cliente.",
    esquema: z.object({
      cliente_texto: z.string().nullable().describe("Cliente tal como lo nombró. null si no lo dijo."),
      items: z
        .array(
          z.object({
            producto_texto: z.string().min(1),
            cantidad,
            precio_unitario: dinero.nullable().describe("Precio por caja. null si no lo dijo."),
          }),
        )
        .min(1),
      descuento_total: dinero.nullable().default(null),
      condicion: condicion.nullable().describe("null si no dijo si pagó o si lo debe."),
      medio_pago: medio.nullable(),
      comprobante: z.enum(["ninguno", "boleta", "factura"]).default("ninguno"),
      dudas,
    }),
  },
  registrar_abono: {
    descripcion: "Un cliente pagó parte o todo lo que debe.",
    esquema: z.object({
      cliente_texto: z.string().min(1),
      monto: z.number().positive(),
      medio_pago: medio,
      dudas,
    }),
  },
  registrar_compra: {
    descripcion: "Le llegó fruta de un proveedor (entra stock y es un egreso).",
    esquema: z.object({
      proveedor_texto: z.string().nullable(),
      items: z
        .array(
          z.object({
            producto_texto: z.string().min(1),
            cantidad,
            costo_unitario: dinero.nullable(),
            estado: z.enum(ESTADOS_LLEGADA).nullable().default(null).describe("Cómo llegó la fruta: verde, pintón o maduro. null si no lo dijo."),
          }),
        )
        .min(1),
      condicion: condicion.nullable(),
      dudas,
    }),
  },
  registrar_merma: {
    descripcion: "Fruta que se malogró y sale del stock sin venderse.",
    esquema: z.object({ producto_texto: z.string().min(1), cantidad, motivo: z.string().nullable() }),
  },
  registrar_gasto: {
    descripcion: "Un gasto que no es compra de fruta.",
    esquema: z.object({
      categoria: z.enum(["flete", "alquiler", "servicios", "personal", "otros"]),
      monto: z.number().positive(),
      descripcion: z.string().nullable(),
      medio_pago: medio.default("efectivo"),
    }),
  },
  registrar_temperatura: {
    descripcion: "La temperatura que marca el termómetro del puesto.",
    esquema: z.object({ grados: z.number().describe("Grados Celsius que marca el termómetro.") }),
  },
  consultar: {
    descripcion: "Una pregunta sobre el negocio.",
    esquema: z.object({
      consulta: z.enum(["ventas_hoy", "quien_me_debe", "deuda_cliente", "stock", "stock_producto", "gastos_hoy", "resumen_dia"]),
      cliente_texto: z.string().nullable(),
      producto_texto: z.string().nullable(),
    }),
  },
  no_entendido: {
    descripcion: "La frase no es un comando del negocio o no se entiende.",
    esquema: z.object({ motivo: z.string() }),
  },
} as const;

type NombreHerramienta = keyof typeof herramientasVoz;
type Datos<N extends NombreHerramienta> = z.output<(typeof herramientasVoz)[N]["esquema"]>;

/** Lo que entendió el intérprete, ya validado: el nombre de la herramienta y sus datos. */
export type Interpretacion = { [N in NombreHerramienta]: { herramienta: N; datos: Datos<N> } }[NombreHerramienta];

const nombres = Object.keys(herramientasVoz) as NombreHerramienta[];
const esNombre = (n: string): n is NombreHerramienta => (nombres as string[]).includes(n);

/** Las herramientas en el formato de Groq/OpenAI (tool calling), generadas desde los esquemas. */
export function herramientasParaElModelo() {
  return nombres.map((nombre) => {
    const { descripcion, esquema } = herramientasVoz[nombre];
    // «input»: los campos con valor por defecto no son obligatorios para el modelo.
    const parametros: Record<string, unknown> = { ...z.toJSONSchema(esquema, { io: "input" }) };
    delete parametros.$schema; // la versión del esquema no le sirve al modelo
    return { type: "function" as const, function: { name: nombre, description: descripcion, parameters: parametros } };
  });
}

export type ResultadoLectura = { ok: true; interpretacion: Interpretacion } | { ok: false; motivo: string };

/** Valida la llamada a herramienta que devolvió el modelo. Si no calza con el esquema, no se usa: no se adivina. */
export function leerInterpretacion(nombre: string, argumentos: unknown): ResultadoLectura {
  if (!esNombre(nombre)) return { ok: false, motivo: `herramienta desconocida: ${nombre}` };
  let datos = argumentos;
  if (typeof datos === "string") {
    try {
      datos = JSON.parse(datos);
    } catch {
      return { ok: false, motivo: "los argumentos no son JSON" };
    }
  }
  const leido = herramientasVoz[nombre].esquema.safeParse(datos);
  if (!leido.success) return { ok: false, motivo: z.prettifyError(leido.error) };
  return { ok: true, interpretacion: { herramienta: nombre, datos: leido.data } as Interpretacion };
}
