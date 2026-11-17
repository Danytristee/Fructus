# 2026-11-17 · La hoja sigue al dedo y «atrás» la cierra (ADR-0023)

- **Qué cambió:** `Hoja` se arrastra con el dedo (desde la manija y el título, y desde el contenido cuando está arriba), se cierra al deslizarla o con un tirón, vuelve con resorte si se suelta a medio camino y se estira con resistencia hacia arriba. El botón atrás del Android cierra la hoja y deja a la persona en la misma pantalla; cerrarla de otra forma quita su entrada del historial.
- **Cómo se verificó:** Vitest (`lib/hoja-reglas.test.ts`), `tests/e2e/hoja-gestos.spec.ts` con toques reales a 412 y 360 px (y a 360 × 640 el traspaso del contenido a la hoja), y en el navegador: atrás, Escape y un enlace del menú dejan el historial limpio.
- **Pendiente:** probarlo en el S25 del dueño (el gesto de atrás de Android y la PWA instalada); tamaños intermedios de hoja (media pantalla que se agranda) quedan fuera.

## Después: el teclado no tapa ni borra (ADR-0024)

- **Qué cambió:** el teclado achica la página (`interactive-widget=resizes-content`); con él abierto se esconden la barra de abajo, los botones flotantes y el ícono de entrar; el campo con el foco queda a la vista sobre el pie de la hoja; tocar afuera solo baja el teclado; y una hoja con algo escrito pregunta antes de cerrarse por un roce.
- **Cómo se verificó:** `tests/e2e/teclado.spec.ts` a 412 y 360 px recorre cada campo de cliente nuevo, proveedor nuevo, pago a proveedor, precio en la tarjeta de voz y entrar, con el teclado simulado. Encontró «Entrar» fuera de la pantalla a 360 px, ya corregido.
- **Pendiente:** el teclado de verdad en el S25 y en gama media; lo escrito si Android cierra la app en segundo plano.

## Después: gestos de celular, primer grupo (ADR-0025)

- **Qué cambió:** con «Hola Fructus» prendido la pantalla no se apaga sola; la ficha del cliente tiene «WhatsApp» (con el recordatorio de su cuenta) y «Llamar», con la misma pieza que el proveedor; tocar la pestaña en la que estás sube al inicio; «+/−» repite al mantenerlo y vibra; al tocar un monto se selecciona.
- **Cómo se verificó:** `gestos-celular.spec.ts`, `voz-hola-fructus.spec.ts` (pantalla encendida) y `clientes-ficha.spec.ts` a 412 y 360 px, más las reglas en Vitest.
- **Pendiente:** sentir la vibración y la pantalla encendida en el S25; el segundo grupo del inventario.
