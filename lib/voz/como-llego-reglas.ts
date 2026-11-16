// «Manzana verde» y «plátano verde» son nombres de fruta: ahí «verde» no dice cómo llegó. Lógica pura.
//
// El problema: el modelo no tiene el catálogo, así que a veces toma la palabra por las dos cosas: pone «manzana verde» en el
// nombre y además estado = "verde". Con el plátano importa: «llegó verde» le suma días de vida que esa caja no tiene.
// Cómo se decide: contando, no preguntándole al modelo. Si el nombre de la fruta ya trae la palabra y la frase no la dijo más
// veces que eso, esa vez era el nombre. Es como el cajero que lee «naranja» en la etiqueta: sabe que es la fruta, no el color.
// Mal hecho: una regla más en el prompt general. La que hubo hizo que el modelo dejara de entender otras frases
// (/voz-precision 2026-11-16).
import type { EstadoLlegada } from "../vida-util-reglas";

const PALABRA: Record<EstadoLlegada, RegExp> = {
  verde: /\bverdes?\b/g,
  pinton: /\bpinton(a|es|as)?\b/g,
  maduro: /\bmadur[oa]s?\b/g,
};

const plano = (texto: string) => texto.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
const veces = (texto: string, estado: EstadoLlegada) => (plano(texto).match(PALABRA[estado]) ?? []).length;

/**
 * Los ítems de una compra, sin el estado que en realidad era parte del nombre de la fruta. Lo que la frase dijo de más (la
 * palabra que no está en ningún nombre) se queda primero con los ítems que no la llevan en el nombre.
 */
export function sinEstadoQueEsNombre<T extends { producto_texto: string; estado: EstadoLlegada | null }>(transcripcion: string, items: readonly T[]): T[] {
  const libres = new Map<EstadoLlegada, number>();
  for (const estado of Object.keys(PALABRA) as EstadoLlegada[]) {
    const enNombres = items.reduce((s, i) => s + veces(i.producto_texto, estado), 0);
    const sinLaPalabraEnElNombre = items.filter((i) => i.estado === estado && veces(i.producto_texto, estado) === 0).length;
    libres.set(estado, veces(transcripcion, estado) - enNombres - sinLaPalabraEnElNombre);
  }
  return items.map((i) => {
    if (i.estado === null || veces(i.producto_texto, i.estado) === 0) return i;
    const quedan = libres.get(i.estado) ?? 0;
    if (quedan > 0) {
      libres.set(i.estado, quedan - 1);
      return i;
    }
    return { ...i, estado: null };
  });
}
