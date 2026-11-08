# ADR-0012 — Movimiento que no repinta, y el vidrio solo desenfoca lo que flota

**Fecha:** 2026-11-08 · **Estado:** aceptado (corrige detalles de ADR-0007; la identidad «Aurora» no cambia)

## Contexto

Se pidió que la app sea fluida y gaste poco. Se midió antes de tocar nada (Chromium sin pantalla, CPU 4 veces más lenta, 412 × 915):
a 60 cuadros por segundo la app ya iba bien, pero **con «Hoy» abierta y sin tocarla, el navegador repintaba la pantalla unas 60 veces por segundo**
(en 5 s: 805 pintados, 505 tareas de rasterizado, 300 recálculos de estilos y de diseño). Eso es batería y calor en un teléfono que el dueño deja
abierto todo el día. Las causas eran tres animaciones que no se pueden dejar al teléfono: el giro del orbe animaba una **variable** del degradado
(`--giro`), su resplandor animaba una **sombra**, y el punto «ahora» del gráfico era un **elemento SVG**. Además, deslizar una lista gastaba más de
la mitad de su CPU en el desenfoque del vidrio (`backdrop-filter`), que se recalcula en cada cuadro y por cada tarjeta.

## Decisión

1. **Lo que se mueve en bucle (o a menudo) solo anima `transform` y `opacity`**, en un elemento HTML: el teléfono lo mueve sin repintar.
   Nunca variables de degradado, sombras, `left` o `width`, ni transformaciones de elementos SVG.
2. **El orbe de voz:** el degradado cónico es una capa propia (`::before`) que **gira con transform**; el brillo y el filo (`::after`) quedan quietos;
   el resplandor que respira es otro elemento (`.halo`) cuyo `opacity` sube y baja (la sombra ya está dibujada). El punto de «ahora» es un círculo
   HTML sobre el SVG; el pulso del aviso de stock es un círculo que crece y se desvanece; el fondo de la barra de abajo se desliza con `translateX`.
3. **`vidrio` ya no desenfoca.** Las tarjetas van sobre el fondo suave y quieto de Aurora y no se nota la diferencia. **`vidrio-desenfocado`**
   (con 16 px, antes 22) solo para lo que flota sobre contenido que se desliza: la barra de abajo, la etiqueta del orbe y los avisos de voz; sin
   desenfoque, el texto de debajo se transparenta. Los velos de las hojas y de «Guardando» ya no desenfocan 2 px.
4. **Entrada de las pantallas:** `subir` pasa de 0.7 a 0.5 s (igual que las piezas de la tarjeta de voz): se siente más inmediata.
5. **Cada pantalla de la barra tiene su `loading.tsx`**: el esqueleto se ve al instante al tocar el enlace, antes de que el servidor conteste.
   Next precarga el `loading.tsx` del segmento al que se va; el de una carpeta de arriba no alcanza para un enlace hermano.
6. **Las ilustraciones de fruta cargan sin esperar** (`loading="eager"`: pesan menos de 1 KB) y `/frutas` e `/icons` se guardan una semana en el teléfono.
7. **El presupuesto de JavaScript (ADR-0006) cuenta lo que baja un teléfono:** `pnpm medir:js` deja fuera los polyfills `nomodule` (34 KB, solo los
   bajan navegadores de hace una década) y los muestra aparte. «Hoy» pesa 144.9 KB; con los polyfills, 179.3 KB.
8. **Cómo se mide** (en el repo, para repetirlo): `pnpm build:local` y luego `pnpm medir:pintura` (cuánto repinta en reposo), `pnpm medir:cpu` (CPU de todos los
   procesos al deslizar) y `pnpm medir:fluidez` (cuadros, tareas largas, carga por pantalla). Se compara alternando la versión anterior y la nueva, varias veces:
   la máquina no está siempre igual de libre.

## Medido (antes → después, la misma máquina, alternando)

| | Antes | Después |
|---|---|---|
| «Hoy» en reposo, 5 s (a los 2.5 s de abrir): pintados / rasterizado / diseño | 805 / 93 ms / 300 | 2 / 0.5 ms / 1 |
| Lo mismo, a los 9 s de abrir (ya sin animaciones de entrada) | — | 0 / 0 ms / 0 |
| «Hoy» en reposo: hilo principal ocupado | 9.4 % | 3 % |
| Abrir una hoja: cuadros por segundo / cuadros lentos | 42 / ~20 | 57 / ~2 |
| Deslizar «Ventas» (3 s): CPU de todos los procesos | 0.385 s | 0.19 s |
| Deslizar «Clientes» (3 s): CPU de todos los procesos | 0.40 s | 0.196 s |

## Consecuencias

- Una animación nueva en bucle se escribe con `transform` u `opacity`, o no se escribe. `pnpm medir:pintura` lo comprueba: en reposo tiene que dar cero pintados.
- Un componente nuevo que flota sobre contenido usa `vidrio-desenfocado`; una tarjeta en el flujo de la página usa `vidrio`.
- Los números de arriba son del Chromium sin pantalla (pinta por software); en un teléfono real la GPU hace el desenfoque más barato, pero la proporción se mantiene.
  No se midió en un Android de verdad: queda pendiente para la demo.
