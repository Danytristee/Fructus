// Registrar a mano lo mismo que se registra por voz (A8): la misma tarjeta de confirmación, pero llenada con lo que la
// persona toca en vez de con lo que oyó el intérprete. Una sola tarjeta por operación (una función, una pieza), así el
// guardado, el doble toque y los errores se comportan igual con la voz y sin ella. Lógica pura.
import type { ItemBorrador } from "./voz/confirmar-venta-reglas";
import type { Tarjeta } from "./voz/tarjeta-reglas";

type Persona = { id: number; nombre: string };

/** Lo que se le dice a la persona si no se pudo abrir lo que iba a registrar (sin señal, o el servidor no respondió). */
export const NO_ABRIO = "No pude abrirlo. Revisa tu señal e inténtalo otra vez.";

/** Con la sesión vencida, a mano no queda nada esperando en «Hoy» (a la voz sí): hay que registrarlo otra vez. */
export const sinSesionAMano = (que: string) => `Tu sesión terminó. Vuelve a entrar y registra ${que} otra vez.`;

/** La tarjeta de un abono a mano: con el cliente ya elegido si se viene de su ficha, y sin monto (nunca se inventa). */
export function tarjetaAbonoAMano(cliente: Persona | null, sugeridos: Persona[] = []): Extract<Tarjeta, { tipo: "abono" }> {
  return {
    tipo: "abono",
    cliente: { dicho: null, elegido: cliente, opciones: cliente ? [] : sugeridos },
    monto: null,
    medio: "efectivo",
    dudas: [],
    falta: cliente ? [] : ["cliente"],
  };
}

/** La tarjeta de una merma a mano: con la fruta ya elegida si se viene de su fila, y sin cajas (0 = todavía sin poner: nunca se inventa). */
export function tarjetaMermaAMano(producto: Persona | null, sugeridos: Persona[] = []): Extract<Tarjeta, { tipo: "merma" }> {
  return {
    tipo: "merma",
    producto: { dicho: null, elegido: producto, opciones: producto ? [] : sugeridos },
    cantidad: 0,
    motivo: null,
    falta: producto ? [] : ["producto"],
  };
}

/** Qué fruta ofrecer primero al registrar una merma: las que más se están gastando, de más a menos, y que tengan stock. */
export function sugeridosParaMerma(frutas: { id: number; nombre: string; stock: number; desgaste: number }[], cuantos = 5): Persona[] {
  return frutas
    .filter((f) => f.stock > 0)
    .sort((a, b) => b.desgaste - a.desgaste)
    .slice(0, cuantos)
    .map(({ id, nombre }) => ({ id, nombre }));
}

/** Una fruta de la compra que todavía no se llena: sin fruta, sin cajas y sin costo (nunca se inventa un precio). */
export const itemCompraVacio = (): ItemBorrador => ({ productoId: null, producto: "", cantidad: 0, precio: null, sugerido: false });

/**
 * La tarjeta de una compra a mano: una fruta vacía, sin proveedor (se puede dejar así si fue en el mercado) y **sin saber si se
 * pagó**: nunca se asume contado (principio 2). Ofrece primero a los proveedores y a las frutas que más conviene reponer.
 */
export function tarjetaCompraAMano(proveedores: Persona[] = [], frutas: Persona[] = []): Extract<Tarjeta, { tipo: "compra" }> {
  return {
    tipo: "compra",
    proveedor: { dicho: null, elegido: null, opciones: proveedores },
    items: [{ producto: { dicho: null, elegido: null, opciones: frutas }, cantidad: 0, costo: { valor: null, sugerido: false } }],
    condicion: null,
    dudas: [],
    falta: ["producto", "costo", "condicion"],
  };
}

/** Qué fruta ofrecer primero al comprar: las que menos días alcanzan, y que se estén vendiendo. */
export function sugeridosParaCompra(frutas: { id: number; nombre: string; coberturaDias: number | null }[], cuantos = 5): Persona[] {
  return frutas
    .filter((f) => f.coberturaDias !== null)
    .sort((a, b) => a.coberturaDias! - b.coberturaDias!)
    .slice(0, cuantos)
    .map(({ id, nombre }) => ({ id, nombre }));
}

/** A quién ofrecer primero al elegir quién pagó: a quienes te deben, de quien más a quien menos. */
export function sugeridosParaAbono(clientes: { id: number; nombre: string; saldo: number }[], cuantos = 5): Persona[] {
  return clientes
    .filter((c) => c.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, cuantos)
    .map(({ id, nombre }) => ({ id, nombre }));
}
