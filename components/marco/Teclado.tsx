"use client";

import { useEffect } from "react";

import { abreTeclado, tecladoAbierto } from "@/lib/teclado-reglas";

// Con el teclado abierto, la pantalla se porta como una app: marca `data-teclado` en <html> para que la barra de abajo y los botones
// flotantes se escondan (encima del teclado solo tapaban lo que se escribe) y, apenas el teclado termina de subir, el campo con el foco queda
// a la vista, sobre el pie pegado de la hoja (que reserva su lugar con `scroll-padding`). El viewport achica la página con el teclado
// (`interactive-widget=resizes-content` en app/layout.tsx): sin eso, Chrome en Android dejaba la hoja fija abajo, detrás del teclado.
// No dibuja nada.
export function Teclado() {
  useEffect(() => {
    const vista = window.visualViewport;
    let ancho = window.innerWidth;
    let altoMaximo = alto();
    let abierto = false;

    function alto() {
      return vista?.height ?? window.innerHeight;
    }

    function escribiendo() {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement)) return false;
      return abreTeclado({
        etiqueta: el.tagName,
        tipo: el.getAttribute("type"),
        soloLectura: el.hasAttribute("readonly"),
        editable: el.isContentEditable,
      });
    }

    function revisar() {
      if (window.innerWidth !== ancho) {
        // Giró el celular: se vuelve a medir desde cero.
        ancho = window.innerWidth;
        altoMaximo = alto();
      }
      altoMaximo = Math.max(altoMaximo, alto());
      const ahora = tecladoAbierto({ altoMaximo, altoActual: alto(), escribiendo: escribiendo() });
      if (ahora === abierto) return;
      abierto = ahora;
      if (ahora) {
        document.documentElement.dataset.teclado = "";
        // Después del cambio de tamaño: que el campo quede a la vista, no detrás del pie de la hoja. Otra vez cuando terminó de subir el
        // teclado y de acomodarse lo que se estaba animando (un «Más datos» que se abre): lo que crece mueve el campo.
        const acomodar = () => {
          const el = document.activeElement;
          if (abierto && el instanceof HTMLElement) el.scrollIntoView({ block: "nearest" });
        };
        requestAnimationFrame(acomodar);
        window.setTimeout(acomodar, 350);
      } else delete document.documentElement.dataset.teclado;
    }

    const blandos = { passive: true } as const;
    vista?.addEventListener("resize", revisar, blandos);
    window.addEventListener("resize", revisar, blandos);
    // El foco cambia sin que cambie el tamaño (de un campo a otro, o a un botón con el teclado ya cerrándose).
    document.addEventListener("focusin", revisar);
    const alSalir = () => requestAnimationFrame(revisar);
    document.addEventListener("focusout", alSalir);
    return () => {
      vista?.removeEventListener("resize", revisar);
      window.removeEventListener("resize", revisar);
      document.removeEventListener("focusin", revisar);
      document.removeEventListener("focusout", alSalir);
      delete document.documentElement.dataset.teclado;
    };
  }, []);
  return null;
}
