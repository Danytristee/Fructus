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
            estado: z
              .enum(ESTADOS_LLEGADA)
              .nullable()
              .default(null)
              .describe(
                'Cómo llegó esa fruta, si lo dijo: "verde", "pintón" o "pintona" (pinton), "maduro" o "madura". Si no lo dijo, null. ' +
                  'En "manzana verde" o "plátano verde", verde es parte del nombre de la fruta: va en producto_texto y aquí null.',
              ),
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
    descripcion: 'La temperatura del puesto: "hoy hizo 29 grados", "el termómetro marca 31", "estamos a 28 grados".',
    // Hasta tres cifras: un «290» mal oído llega a la tarjeta, que lo devuelve al rango con un toque. Un número más largo no es
    // una temperatura mal oída, y la cifra rompía la tarjeta a 360 px (/chaos 2026-11-14).
    esquema: z.object({ grados: z.number().min(-99).max(999).describe('Grados Celsius que marca el termómetro, en cifras. "28 grados y medio" = 28.5.') }),
  },
  consultar: {
    descripcion: "Una pregunta sobre el negocio.",
    esquema: z.object({
      consulta: z
        .enum(["ventas_hoy", "quien_me_debe", "deuda_cliente", "stock", "stock_producto", "gastos_hoy", "resumen_dia", "que_sale_hoy"])
        .describe(
          "Qué pregunta. ventas_hoy: cuánto vendió hoy. quien_me_debe: quiénes le deben. deuda_cliente: cuánto debe un cliente. " +
            "stock: todo lo que tiene. stock_producto: cuántas cajas le quedan de UNA fruta. gastos_hoy: cuánto gastó hoy. " +
            'resumen_dia: cómo va el día ("¿cómo voy?"). que_sale_hoy: qué fruta tiene que salir hoy o se va a malograr, qué vender primero.',
        ),
      cliente_texto: z.string().nullable(),
      producto_texto: z.string().nullable(),
    }),
  },
  no_entendido: {
    descripcion: "La frase no es un comando del negocio o no se entiende.",
    esquema: z.object({ motivo: z.string() }),
  },
} as const;

/**
 * La venta que se está confirmando, en los mismos campos de registrar_venta: lo que el celular manda para corregir hablando (ADR-0020).
 * El intérprete la copia y cambia solo lo corregido; antes recibía la lectura en frases y a veces perdía al cliente (/chaos 2026-11-16).
 */
export const esquemaVentaActual = herramientasVoz.registrar_venta.esquema.omit({ dudas: true });
export type VentaActual = z.input<typeof esquemaVentaActual>;

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
