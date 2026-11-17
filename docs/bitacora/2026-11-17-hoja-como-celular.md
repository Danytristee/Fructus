# 2026-11-17 · La hoja sigue al dedo y «atrás» la cierra (ADR-0023)

- **Qué cambió:** `Hoja` se arrastra con el dedo (desde la manija y el título, y desde el contenido cuando está arriba), se cierra al deslizarla o con un tirón, vuelve con resorte si se suelta a medio camino y se estira con resistencia hacia arriba. El botón atrás del Android cierra la hoja y deja a la persona en la misma pantalla; cerrarla de otra forma quita su entrada del historial.
- **Cómo se verificó:** Vitest (`lib/hoja-reglas.test.ts`), `tests/e2e/hoja-gestos.spec.ts` con toques reales a 412 y 360 px (y a 360 × 640 el traspaso del contenido a la hoja), y en el navegador: atrás, Escape y un enlace del menú dejan el historial limpio.
- **Pendiente:** probarlo en el S25 del dueño (el gesto de atrás de Android y la PWA instalada); tamaños intermedios de hoja (media pantalla que se agranda) quedan fuera.
