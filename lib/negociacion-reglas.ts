// El análisis de un proveedor dicho en lenguaje de puesto: un veredicto y sus porqués (ley 3: la complejidad se traduce).
import { FRUTA_IMPORTANTE, type AnalisisProveedor, type Posicion } from "./proveedores-reglas";

const porcentaje = (n: number) => `${Math.round(n * 100)} %`;
const soles = (n: number) => `S/ ${Math.round(n).toLocaleString("es-PE")}`;

export const TITULOS: Record<Posicion, string> = {
  riesgo: "Busca otra opción",
  socio: "Socio: negocia volumen",
  ventaja: "Pide mejor precio",
  ocasional: "Ocasional",
  enfriado: "Se enfrió",
};

/** «Mango Kent, uva y 2 más». */
export function listarFrutas(frutas: string[], tope = 2): string {
  if (frutas.length <= tope) return frutas.join(" y ");
  const resto = frutas.length - tope;
  return `${frutas.slice(0, tope).join(", ")} y ${resto} más`;
}

function frecuencia(cadaDias: number | null): string {
  if (cadaDias === null) return "pocas veces";
  const n = Math.max(1, Math.round(cadaDias));
  return n === 1 ? "todos los días" : `cada ${n} días`;
}

function antiguedad(dias: number | null): string {
  if (dias === null || dias < 45) return "hace poco";
  const meses = Math.round(dias / 30);
  return `hace ${meses} meses`;
}

/** Por qué tiene esa posición, en una frase. */
export function porQue(a: AnalisisProveedor): string {
  const unicas = a.frutas.filter((f) => f.unicaFuente && f.pesoEnTusCompras >= FRUTA_IMPORTANTE).map((f) => f.fruta);
  switch (a.posicion) {
    case "enfriado":
      return `Hace ${a.diasSinComprar} días que no le compras.`;
    case "riesgo":
      return unicas.length > 0
        ? `Es el único que te trae ${listarFrutas(unicas)}. Si te falla, te quedas sin eso.`
        : `Se lleva el ${porcentaje(a.participacion)} de tus compras y no eres su cliente fijo.`;
    case "socio":
      return `Se lleva el ${porcentaje(a.participacion)} de tus compras y le compras ${frecuencia(a.cadaDias)}: se necesitan los dos.`;
    case "ventaja":
      return `Le compras ${frecuencia(a.cadaDias)} desde ${antiguedad(a.antiguedadDias)} y tienes otras opciones: eres su cliente fijo.`;
    case "ocasional":
      return a.total > 0 ? `Le compras ${frecuencia(a.cadaDias)}; pesa el ${porcentaje(a.participacion)} de tus compras.` : "Todavía no le compras nada.";
  }
}

export type Palanca = { tipo: "ahorro" | "subio" | "unica" | "deuda"; texto: string };

/** Lo que puedes usar para negociar con él, lo más fuerte primero. */
export function palancas(a: AnalisisProveedor, nombreDe: (id: number) => string): Palanca[] {
  const lista: Palanca[] = [];
  const caras = a.frutas.filter((f) => f.diferencia > 0 && f.mejorOtro).sort((x, y) => y.diferencia * y.cajas - x.diferencia * x.cajas);
  for (const f of caras.slice(0, 2)) {
    lista.push({
      tipo: "ahorro",
      texto: `${nombreDe(f.mejorOtro!.proveedorId)} te deja ${f.fruta} a ${soles(f.diferencia)} menos por caja.`,
    });
  }
  if (a.ahorroMensual > 0) lista.push({ tipo: "ahorro", texto: `Si iguala el mejor precio, ahorras unos ${soles(a.ahorroMensual)} al mes.` });
  const subidas = a.frutas.filter((f) => f.subio >= 0.04).sort((x, y) => y.subio - x.subio);
  if (subidas[0]) lista.push({ tipo: "subio", texto: `Te subió ${subidas[0].fruta}: su último precio está ${porcentaje(subidas[0].subio)} sobre su promedio.` });
  const unicas = a.frutas.filter((f) => f.unicaFuente).map((f) => f.fruta);
  if (unicas.length > 0 && a.posicion !== "riesgo") lista.push({ tipo: "unica", texto: `Solo él te trae ${listarFrutas(unicas)}: busca un segundo proveedor.` });
  if (a.saldo > 0) lista.push({ tipo: "deuda", texto: `Le debes ${soles(a.saldo)}: pagar a tiempo te da pie para pedir rebaja.` });
  return lista;
}
