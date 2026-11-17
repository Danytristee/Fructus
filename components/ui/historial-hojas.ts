// «Atrás» cierra la hoja, como en cualquier app del celular, y no saca a la persona de la pantalla.
//
// Cómo: al abrir una hoja se agrega una entrada al historial con la misma dirección (el cuaderno gana una página en blanco encima). El botón
// atrás del Android, el gesto de atrás o la flecha del navegador quitan esa página: aquí se oye el `popstate` y se cierra la hoja. Si la
// hoja se cierra de otra forma (Confirmar, deslizarla, tocar afuera), se quita la página con `history.back()` para que el siguiente «atrás»
// vaya a donde la persona espera.
//
// Next también oye ese `popstate` (en `window` los listeners corren en el orden en que se registraron y el suyo es el primero). Como la
// dirección no cambió y Next copia su estado en cada `pushState` (lo parcha), solo «restaura» la misma pantalla: no se ve nada. Lo que sí
// importa es el orden: una restauración de Next cancela una navegación en curso, así que quien cierra una hoja y navega espera a que la
// página de la hoja se haya quitado (`despuesDeCerrarHoja`).

const CLAVE = "__fructusHoja";

type Abierta = {
  profundidad: number;
  direccion: string;
  /** La entrada del historial todavía existe (nadie la quitó con atrás). */
  enHistorial: boolean;
  cerrar: () => void;
};

const pila: Abierta[] = [];
let propiosPendientes = 0;
let alTerminar: (() => void)[] = [];
let escuchando = false;

function profundidadActual(): number {
  const p = (window.history.state as Record<string, unknown> | null)?.[CLAVE];
  return typeof p === "number" ? p : 0;
}

function terminarPropios() {
  const cola = alTerminar;
  alTerminar = [];
  for (const f of cola) f();
}

function alVolver() {
  if (propiosPendientes > 0) {
    // Lo quitamos nosotros al cerrar una hoja: la pantalla ya está bien.
    propiosPendientes--;
    if (propiosPendientes === 0) terminarPropios();
    return;
  }
  const llegada = profundidadActual();
  const porCerrar = pila.filter((h) => h.enHistorial && h.profundidad > llegada);
  if (porCerrar.length === 0) return;
  // Atrás de la persona: se cierran las hojas que quedaron por encima, de la de arriba a la de abajo.
  for (const h of porCerrar.reverse()) {
    h.enHistorial = false;
    h.cerrar();
  }
}

function escuchar() {
  if (escuchando) return;
  escuchando = true;
  window.addEventListener("popstate", alVolver);
}

/**
 * Anota una hoja que se acaba de abrir. `cerrar` se llama cuando la persona va atrás. Devuelve `soltar`, que se llama al cerrarse la hoja
 * por cualquier motivo (o al desmontarse).
 */
export function anotarHoja(cerrar: () => void): () => void {
  escuchar();
  let hoja: Abierta | null = null;
  let cancelada = false;
  // Se agrega en una microtarea: en desarrollo React monta, desmonta y vuelve a montar cada efecto, y así no quedan dos páginas.
  queueMicrotask(() => {
    if (cancelada) return;
    const profundidad = Math.max(profundidadActual(), pila.at(-1)?.profundidad ?? 0) + 1;
    hoja = { profundidad, direccion: window.location.href, enHistorial: true, cerrar };
    pila.push(hoja);
    window.history.pushState({ [CLAVE]: profundidad }, "");
  });

  return () => {
    cancelada = true;
    if (!hoja) return;
    const i = pila.indexOf(hoja);
    if (i >= 0) pila.splice(i, 1);
    if (!hoja.enHistorial) return;
    hoja.enHistorial = false;
    // Si ya se navegó a otra pantalla, la página de la hoja quedó debajo: no se toca, «atrás» desde aquí no debe volver a la anterior.
    const actual = profundidadActual();
    if (window.location.href !== hoja.direccion || actual < hoja.profundidad) return;
    // Las hojas abiertas encima de esta (si las hubiera) se van con ella.
    for (const h of pila) if (h.profundidad > hoja.profundidad) h.enHistorial = false;
    propiosPendientes++;
    window.history.go(-(actual - hoja.profundidad + 1));
    // Si el navegador no avisara (no debería), no se puede quedar tragándose el siguiente «atrás» de la persona.
    window.setTimeout(() => {
      if (propiosPendientes === 0) return;
      propiosPendientes = 0;
      terminarPropios();
    }, 800);
  };
}

/**
 * Corre `f` (por ejemplo, ir a otra pantalla) después de que la hoja que se está cerrando terminó de quitar su página del historial. Si se
 * navega antes, el `history.back()` de la hoja podría llegar tarde y sacar a la persona de la pantalla nueva.
 */
export function despuesDeCerrarHoja(f: () => void) {
  // El cierre se anota al confirmar el render (useLayoutEffect); se espera un poco para que ya esté pedido.
  window.setTimeout(() => {
    if (propiosPendientes === 0) f();
    else alTerminar.push(f);
  }, 30);
}
