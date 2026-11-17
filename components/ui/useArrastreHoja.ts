"use client";

import { useEffect } from "react";

import { decidirSoltar, duracionCierre, ejeDelGesto, opacidadVelo, resistencia, velocidadDe, type Muestra } from "@/lib/hoja-reglas";

// La hoja sigue al dedo, como en el celular: se arrastra desde la manija o el título, y desde el contenido cuando ya está arriba del todo
// (si el contenido se desliza, primero se desliza él; al llegar arriba, el mismo dedo empieza a bajar la hoja). Al soltarla, se va o vuelve
// a su sitio con un resorte (`lib/hoja-reglas.ts` decide).
//
// Se mueve con la propiedad `translate` y no con `transform`: la animación de entrada deja `transform` fijo (fill «both») y le ganaría a un
// estilo en línea. Las dos se suman, así que la bajada final de Radix arranca desde donde la dejó el dedo, sin saltos. Solo se anima
// `translate` y `opacity` (ADR-0012).

const ESCRITORIO = "(min-width: 768px)";
const NO_ARRASTRA = "input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-no-arrastra]";

type Estado = "nada" | "pendiente" | "arrastra" | "nativo" | "ignora";

export function useArrastreHoja(contenido: HTMLElement | null, abierta: boolean, cerrar: () => void) {
  useEffect(() => {
    const el = contenido;
    if (!abierta || !el) return;
    const hoja = el;

    let estado: Estado = "nada";
    let inicioX = 0;
    let inicioY = 0;
    let base = 0;
    let desplazamiento = 0;
    let alto = 0;
    let desdeAsa = false;
    let desplazable: HTMLElement = hoja;
    let muestras: Muestra[] = [];
    let ultimoY = 0;
    let quitarTransicion: (() => void) | null = null;

    const velo = () => hoja.parentElement?.querySelector<HTMLElement>("[data-slot='sheet-overlay']") ?? null;

    // Si Radix reusó el mismo elemento (se reabrió antes de terminar de bajar), arranca limpia: sin lo que dejó el último arrastre.
    for (const n of [hoja, velo()]) {
      if (!n) continue;
      n.style.translate = "";
      n.style.transition = "";
      n.style.animationDuration = "";
      n.style.opacity = "";
    }

    function empezar(x: number, y: number, objetivo: EventTarget | null) {
      if (window.matchMedia(ESCRITORIO).matches || hoja.dataset.state !== "open") return false;
      const t = objetivo instanceof Element ? objetivo : null;
      if (t?.closest(NO_ARRASTRA)) return false;
      estado = "pendiente";
      inicioX = x;
      inicioY = y;
      ultimoY = y;
      desdeAsa = !!t?.closest("[data-asa]");
      desplazable = desplazableDe(t, hoja);
      muestras = [{ y, t: performance.now() }];
      return true;
    }

    function tomar(y: number) {
      estado = "arrastra";
      alto = hoja.getBoundingClientRect().height;
      // Si todavía estaba subiendo (o volviendo a su sitio), el dedo la toma donde está, sin saltos.
      const estilo = getComputedStyle(hoja);
      const yaMovida = parseFloat(estilo.translate.split(" ")[1] ?? "0") || 0;
      const subida = hoja.getAnimations().filter((a) => a instanceof CSSAnimation && a.playState === "running");
      const visto = subida.length ? new DOMMatrix(estilo.transform).m42 : 0;
      for (const a of subida) a.finish();
      quitarTransicion?.();
      base = y - visto - yaMovida;
      const v = velo();
      // La animación del velo terminó en opacidad 1 (su valor normal): se retira para poder aclararlo con el dedo.
      if (v) for (const a of v.getAnimations()) a.cancel();
      hoja.style.transition = "none";
      if (v) v.style.transition = "none";
      hoja.style.userSelect = "none";
    }

    function mover(x: number, y: number): boolean {
      muestras.push({ y, t: performance.now() });
      if (muestras.length > 12) muestras.shift();
      const subiendo = y < ultimoY;
      ultimoY = y;

      if (estado === "pendiente") {
        const eje = ejeDelGesto(x - inicioX, y - inicioY);
        if (eje === null) return y > inicioY && arriba(desplazable); // a la espera, pero que el contenido no empiece a deslizarse
        if (eje === "horizontal") {
          estado = "ignora";
          return false;
        }
        const baja = y > inicioY;
        const sePuedeDeslizar = desplazable.scrollHeight > desplazable.clientHeight + 1;
        // Desde donde se puso el dedo, no desde donde se supo hacia dónde iba: la hoja queda pegada al dedo, sin atraso.
        if (desdeAsa || (baja && arriba(desplazable)) || (!baja && !sePuedeDeslizar)) tomar(inicioY);
        else estado = "nativo";
      } else if (estado === "nativo") {
        // El contenido llegó arriba y el dedo sigue bajando: desde aquí baja la hoja.
        if (!subiendo && arriba(desplazable) && y > inicioY) tomar(y);
        else return false;
      }
      if (estado !== "arrastra") return false;

      desplazamiento = resistencia(y - base, Math.min(alto, 400));
      hoja.style.translate = `0 ${desplazamiento}px`;
      const v = velo();
      if (v) v.style.opacity = String(opacidadVelo(desplazamiento, alto));
      return true;
    }

    function soltar() {
      const arrastraba = estado === "arrastra";
      estado = "nada";
      hoja.style.userSelect = "";
      if (!arrastraba) return;
      evitarElClic();
      const velocidad = velocidadDe(muestras);
      const decision = decidirSoltar({ desplazamiento, alto, velocidad });
      if (decision === "cerrar") {
        const ms = `${duracionCierre({ desplazamiento, alto, velocidad })}ms`;
        hoja.style.animationDuration = ms;
        const v = velo();
        if (v) v.style.animationDuration = ms;
        cerrar();
        // Si la hoja no se deja cerrar (está guardando), vuelve a su sitio.
        requestAnimationFrame(() => requestAnimationFrame(() => hoja.dataset.state === "open" && volver()));
      } else volver();
    }

    function volver() {
      hoja.style.animationDuration = "";
      const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      hoja.style.transition = `translate ${reducido ? 120 : 420}ms var(--ease-resorte)`;
      hoja.style.translate = "0 0px";
      const v = velo();
      if (v) {
        v.style.animationDuration = "";
        v.style.transition = "opacity 300ms var(--ease-salida)";
        v.style.opacity = "1";
      }
      desplazamiento = 0;
      const limpiar = () => {
        hoja.removeEventListener("transitionend", limpiar);
        quitarTransicion = null;
        hoja.style.transition = "";
        hoja.style.translate = "";
        if (v) v.style.transition = "";
      };
      quitarTransicion = limpiar;
      hoja.addEventListener("transitionend", limpiar);
    }

    // Arrastrar empezando sobre un botón no lo debe tocar: se traga el clic que llega justo al soltar.
    function evitarElClic() {
      const tragar = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      };
      window.addEventListener("click", tragar, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", tragar, { capture: true }), 350);
    }

    // Dedo: eventos táctiles, porque solo ellos dejan frenar el deslizamiento del navegador en el momento (`preventDefault` en touchmove).
    const alTocar = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        if (estado === "arrastra") soltar();
        estado = "ignora";
        return;
      }
      const d = e.touches[0]!;
      empezar(d.clientX, d.clientY, e.target);
    };
    const alMoverDedo = (e: TouchEvent) => {
      if (estado === "nada" || estado === "ignora" || e.touches.length !== 1) return;
      const d = e.touches[0]!;
      if (mover(d.clientX, d.clientY) && e.cancelable) e.preventDefault();
    };
    const alSoltarDedo = (e: TouchEvent) => {
      if (e.touches.length === 0) soltar();
    };

    // Mouse (una ventana angosta en la compu): mismo gesto con el botón apretado.
    const alApretar = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (!empezar(e.clientX, e.clientY, e.target)) return;
      window.addEventListener("pointermove", alMoverMouse);
      window.addEventListener("pointerup", alSoltarMouse, { once: true });
    };
    const alMoverMouse = (e: PointerEvent) => {
      if (mover(e.clientX, e.clientY)) e.preventDefault();
    };
    const alSoltarMouse = () => {
      window.removeEventListener("pointermove", alMoverMouse);
      soltar();
    };

    hoja.addEventListener("touchstart", alTocar, { passive: true });
    hoja.addEventListener("touchmove", alMoverDedo, { passive: false });
    hoja.addEventListener("touchend", alSoltarDedo);
    hoja.addEventListener("touchcancel", alSoltarDedo);
    hoja.addEventListener("pointerdown", alApretar);
    return () => {
      hoja.removeEventListener("touchstart", alTocar);
      hoja.removeEventListener("touchmove", alMoverDedo);
      hoja.removeEventListener("touchend", alSoltarDedo);
      hoja.removeEventListener("touchcancel", alSoltarDedo);
      hoja.removeEventListener("pointerdown", alApretar);
      window.removeEventListener("pointermove", alMoverMouse);
      window.removeEventListener("pointerup", alSoltarMouse);
    };
  }, [contenido, abierta, cerrar]);
}

function arriba(el: HTMLElement) {
  return el.scrollTop <= 0;
}

/** Lo que se desliza bajo el dedo: un listado con su propio scroll dentro de la hoja, o la hoja misma. */
function desplazableDe(t: Element | null, hoja: HTMLElement): HTMLElement {
  for (let n = t; n && n !== hoja; n = n.parentElement) {
    if (!(n instanceof HTMLElement)) continue;
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return hoja;
}
