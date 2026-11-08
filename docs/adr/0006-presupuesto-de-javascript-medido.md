# ADR-0006 — Presupuesto de JavaScript medido, y LCP e INP mandan

**Fecha:** 2026-10-28 · **Estado:** aceptado

## Contexto

`CLAUDE.md` fijaba **120 KB o menos de JavaScript comprimido** en la primera carga de «Hoy». Con A0 terminado se midió por primera vez
(`pnpm medir:js`, brotli como lo sirve Vercel):

| Base | KB brotli |
|---|---|
| Next 16, página casi vacía, sin un solo componente de cliente | 147 |
| Vite + React 19 + React Router | 82 |
| Vite + React 19 + React Router + supabase-js | 126 |

El tope de 120 KB no se cumple ni con la página vacía, y una SPA con React tampoco lo cumple en cuanto carga sus datos. Se evaluó
cambiar a Vite + `vite-plugin-pwa` (mejor PWA sin conexión) y a Next 16 + Serwist. Se sigue con Next 16: lo que la demo necesita de
una PWA (instalarse, Web Push, franja sin conexión, conservar el último audio) son APIs del navegador que no dependen del framework, y la
guía oficial de Next 16 (`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`) cubre manifest y push.

## Decisión

1. **Mandan LCP e INP**, medidos en un Android de gama media en 4G (o Lighthouse móvil con su limitación de CPU y red): LCP menor a
   2.5 s e INP menor a 200 ms. Si se cumplen, la pantalla pasa aunque el JavaScript esté cerca del tope.
2. **El tope de JavaScript de «Hoy» es 180 KB brotli**: los 147 KB del piso de Next más unos 33 KB para el botón de voz y la tarjeta. Se
   mide con `pnpm build && pnpm medir:js / 180`, que sale con error si se pasa.
3. **En «Hoy» el navegador no carga supabase-js** (46 KB brotli): el resumen llega del servidor y el botón de voz solo envía el audio a
   `/api/voz`. Confirmar la tarjeta va por una server action.
4. **El service worker se escribe a mano** en `public/sw.js`, siguiendo la guía oficial: una página de respaldo sin conexión, la cola del
   último audio y Web Push. Sin Serwist ni `next-pwa`.

## Alternativas descartadas

- **Vite + React Router + `vite-plugin-pwa`, con funciones en Supabase:** la mejor PWA (abre sin señal) y unos 20 KB menos en «Hoy»,
  pero obliga a rehacer A0 y a sumar una pieza para proteger las claves. La app que abre sin señal es la cola completa de la fase 2.
- **Next 16 + Serwist:** arma solo la lista de archivos a guardar, pero con Turbopack necesita `esbuild-wasm` y una ruta extra, y su
  soporte para Next 16 no está confirmado oficialmente.
- **SvelteKit:** cabe en 120 KB, pero se pierde React, shadcn/ui y lo aprendido en CAYLA Retail.

## Consecuencias

- `CLAUDE.md` (regla 9 de «Celular primero») y `docs/PROMPT-INICIAL.md` (A11) cambian el tope a 180 KB y dicen cómo se mide.
- Si en la fase 2 la cola completa sin conexión se vuelve central, o si LCP o INP fallan en un Android real, se reabre la alternativa de
  Vite con un ADR nuevo.

## Nota del 2026-11-08 (ADR-0012)

`pnpm medir:js` ahora cuenta lo que baja un teléfono: deja fuera los scripts `nomodule` (los polyfills de navegadores de hace una década, 34 KB), que el HTML
trae pero ningún Android actual descarga, y los muestra aparte. El tope sigue en 180 KB. «Hoy» pesa 144.9 KB (179.3 KB con los polyfills, la cifra que
se medía antes). El service worker de la decisión 4 quedó escrito a mano en `public/sw.js`, con lo mínimo (ADR-0011).
