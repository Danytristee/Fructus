// Qué voz del celular usa Fructus para hablar (components/voz/hablar.ts). Se queda con la voz del celular, no con una de internet:
// tiene que sonar al instante y sin señal (se descartó la de Gemini el 2026-11-17: cada lectura iría y volvería por la red). Lo
// que se puede mejorar es cuál se elige y cómo se oye. Lógica pura: recibe las voces ya leídas del navegador.

/** Una voz del celular, como la entrega speechSynthesis.getVoices(), sin lo que no se usa. */
export type Voz = { uri: string; nombre: string; lang: string; local: boolean };

/**
 * Cómo se oye: un pelo más rápida y más aguda que la de fábrica, que suena lenta y plana. Más que esto ya suena apurada o de
 * caricatura, y los montos se entienden peor con el ruido del puesto.
 */
export const RITMO = { velocidad: 1.05, tono: 1.05 } as const;

/** Lo que dice al elegir una voz, para oírla con lo que de verdad va a leer. */
export const FRASE_DE_PRUEBA = "Hola, soy Fructus. 10 cajas de mango Kent, a 45 la caja. Total, 450 soles. ¿Confirmo?";

// Perú primero; después el español de Latinoamérica, que se le parece más; España al final.
const ORDEN_PAIS = ["es-PE", "es-US", "es-419", "es-MX", "es-CO"];
const PAISES: Record<string, string> = {
  "es-PE": "Perú",
  "es-US": "Estados Unidos",
  "es-419": "Latinoamérica",
  "es-MX": "México",
  "es-CO": "Colombia",
  "es-AR": "Argentina",
  "es-CL": "Chile",
  "es-ES": "España",
};
// Las voces de más calidad se anuncian así en Android, macOS, iOS y Windows.
const MEJORADA = /natural|neural|enhanced|mejorada|premium|wavenet/i;
// Las voces «de personaje» de Apple (macOS, iOS): suenan más robóticas que cualquier otra, y vienen primero en la lista.
const DE_JUGUETE = /^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;
const calidad = (v: Voz) => (MEJORADA.test(v.nombre) ? 1 : DE_JUGUETE.test(v.nombre) ? -1 : 0);
// Android nombra sus voces con un código: «es-us-x-sfb-local».
const CODIGO_ANDROID = /^[a-z]{2,3}[-_][a-z]{2,4}-x-([a-z0-9]+)-(?:local|network)$/i;

const lang = (v: Voz) => {
  const [idioma = "", pais] = v.lang.replace("_", "-").split("-");
  return pais ? `${idioma.toLowerCase()}-${pais.toUpperCase()}` : idioma.toLowerCase();
};
const esEspanol = (v: Voz) => lang(v).startsWith("es");

function rangoPais(v: Voz): number {
  const l = lang(v);
  const i = ORDEN_PAIS.indexOf(l);
  if (i >= 0) return i;
  return l === "es-ES" ? ORDEN_PAIS.length + 1 : ORDEN_PAIS.length;
}

/** Las voces en español, de la mejor a la peor: por país, luego la que no necesita internet, luego la de más calidad (las de juguete, al final). */
export function vocesEnEspanol(voces: Voz[]): Voz[] {
  return voces
    .filter(esEspanol)
    .map((v, i) => ({ v, i }))
    .sort(
      (a, b) =>
        rangoPais(a.v) - rangoPais(b.v) ||
        Number(b.v.local) - Number(a.v.local) ||
        calidad(b.v) - calidad(a.v) ||
        a.i - b.i,
    )
    .map(({ v }) => v);
}

/**
 * La voz con que habla Fructus: la que eligió la persona en este celular, si sigue ahí y es en español; si no, la mejor que haya.
 * undefined si el celular no tiene ninguna en español (o todavía no las cargó): el navegador usa la suya, con el idioma es-PE.
 */
export function elegirVoz(voces: Voz[], guardada: string | null): Voz | undefined {
  const buenas = vocesEnEspanol(voces);
  return buenas.find((v) => v.uri === guardada) ?? buenas[0];
}

/** Cómo se muestra una voz en la lista: «Paulina», «México · mejorada». */
export function etiquetaVoz(v: Voz): { nombre: string; detalle: string } {
  const codigo = v.nombre.match(CODIGO_ANDROID);
  let nombre: string;
  if (codigo?.[1]) nombre = `Voz ${codigo[1].toUpperCase()}`;
  else if (/^google\b/i.test(v.nombre)) nombre = "Google";
  else
    nombre =
      v.nombre
        .replace(/^microsoft\s+/i, "")
        .replace(/\s+-\s+.*$/, "")
        .replace(/\s+online\b/i, "")
        // Desde el primer paréntesis: macOS dice «Eddy (español (México))», con uno dentro de otro.
        .replace(/\s*\(.*$/, "")
        .trim() || v.nombre;
  const detalle = [PAISES[lang(v)] ?? "Español", MEJORADA.test(v.nombre) && "mejorada", !v.local && "necesita internet"]
    .filter(Boolean)
    .join(" · ");
  return { nombre, detalle };
}
