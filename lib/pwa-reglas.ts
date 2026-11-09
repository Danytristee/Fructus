// Instalar la app en el teléfono (PWA): qué se le ofrece a cada quien. Lógica pura: no toca el navegador (eso lo hace lib/pwa/instalacion.ts).
//
// El problema: cada teléfono instala distinto. Chrome, Edge y Samsung Internet dejan abrir el diálogo de instalación desde un botón
// (`beforeinstallprompt`). Safari en iPhone no: solo se instala desde su botón Compartir, y la app puede decir cómo, pero no hacerlo.
// Mal hecho: un botón «Instalar» que en iPhone no hace nada.

// El color de fondo de la app, para lo que vive fuera del CSS: la barra del navegador (theme-color) y la pantalla de arranque del manifest.
// Es el mismo valor de --fondo en app/globals.css: lib/pwa-reglas.test.ts falla si se separan.
export const COLOR_DE_FONDO = "#f7f5ee";

export type Sistema = "ios" | "android" | "otro";

/**
 * De qué teléfono se abre. Un iPad nuevo se presenta como una Mac: se distingue porque tiene pantalla táctil, y una Mac de verdad no.
 */
export function sistemaDe(userAgent: string, puntosTactiles: number): Sistema {
  if (/iPhone|iPad|iPod/.test(userAgent)) return "ios";
  if (/Macintosh/.test(userAgent) && puntosTactiles > 1) return "ios";
  if (/Android/.test(userAgent)) return "android";
  return "otro";
}

export type ManeraDeInstalar = "instalada" | "pedir" | "pasos-ios" | "pasos-menu";

/** Qué se le ofrece a quien abre el menú: nada (ya la tiene), un botón que abre el diálogo, o los pasos que debe seguir él mismo. */
export function maneraDeInstalar(e: { instalada: boolean; puedePedir: boolean; sistema: Sistema }): ManeraDeInstalar {
  if (e.instalada) return "instalada";
  if (e.puedePedir) return "pedir";
  return e.sistema === "ios" ? "pasos-ios" : "pasos-menu";
}

const PASOS = {
  "pasos-ios": [
    "Toca Compartir: el cuadro con una flecha hacia arriba, en la barra del navegador.",
    "Baja y elige «Añadir a pantalla de inicio».",
    "Toca «Añadir». Fructus queda en tu pantalla, como cualquier app.",
  ],
  "pasos-menu": [
    "Abre el menú del navegador (los tres puntos).",
    "Elige «Instalar app» o «Añadir a pantalla de inicio».",
    "Confirma. Fructus queda en tu pantalla, como cualquier app.",
  ],
} as const;

export function pasosParaInstalar(manera: "pasos-ios" | "pasos-menu"): readonly string[] {
  return PASOS[manera];
}
