// Registrar a mano lo mismo que se registra por voz (A8): la misma tarjeta de confirmación, pero llenada con lo que la
// persona toca en vez de con lo que oyó el intérprete. Una sola tarjeta por operación (una función, una pieza), así el
// guardado, el doble toque y los errores se comportan igual con la voz y sin ella. Lógica pura.
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

/** A quién ofrecer primero al elegir quién pagó: a quienes te deben, de quien más a quien menos. */
export function sugeridosParaAbono(clientes: { id: number; nombre: string; saldo: number }[], cuantos = 5): Persona[] {
  return clientes
    .filter((c) => c.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, cuantos)
    .map(({ id, nombre }) => ({ id, nombre }));
}
