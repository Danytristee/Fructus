// Lo que el navegador deja hacer para instalar la app. Solo se usa desde componentes de cliente.
//
// Chrome, Edge y Samsung Internet avisan con `beforeinstallprompt` cuando la app se puede instalar, y ese aviso llega temprano (a los
// pocos segundos de abrir): se guarda aquí desde que carga la página, no desde que se abre el menú. Un solo uso: después del diálogo el
// navegador no lo vuelve a ofrecer hasta que pase un rato. Safari en iPhone no lo tiene (ver lib/pwa-reglas.ts).

type EventoDeInstalacion = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let guardado: EventoDeInstalacion | null = null;
let instalada = false;
let escuchando = false;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((oyente) => oyente());

/** ¿La app ya se abre como app (desde el ícono de la pantalla de inicio) y no desde el navegador? */
function seAbreComoApp(): boolean {
  const modos = ["standalone", "minimal-ui", "fullscreen"];
  return modos.some((m) => window.matchMedia(`(display-mode: ${m})`).matches) || (navigator as { standalone?: boolean }).standalone === true;
}

/** Empieza a escuchar. Se llama una vez, al cargar la página. */
export function escucharInstalacion() {
  if (escuchando) return;
  escuchando = true;
  instalada = seAbreComoApp();
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // el navegador no muestra su barrita: se ofrece desde el menú, cuando la persona lo pide
    guardado = e as EventoDeInstalacion;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    guardado = null;
    instalada = true;
    avisar();
  });
  window.matchMedia("(display-mode: standalone)").addEventListener("change", () => {
    instalada = seAbreComoApp();
    avisar();
  });
}

export function suscribirInstalacion(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export const puedePedirInstalacion = () => guardado !== null;
export const estaInstalada = () => instalada;

/** Abre el diálogo de instalación del navegador. `no-disponible`: el navegador no lo ofreció (se dicen los pasos a mano). */
export async function pedirInstalacion(): Promise<"aceptada" | "descartada" | "no-disponible"> {
  const evento = guardado;
  if (!evento) return "no-disponible";
  guardado = null; // se usa una sola vez
  avisar();
  try {
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    return outcome === "accepted" ? "aceptada" : "descartada";
  } catch (error) {
    console.error("pwa: no se pudo abrir el diálogo de instalación", { error: error instanceof Error ? error.name : "desconocido" });
    return "no-disponible";
  }
}
