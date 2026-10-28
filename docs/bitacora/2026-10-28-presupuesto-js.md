# 2026-10-28 · Presupuesto de JavaScript medido

**Qué cambió:**
- ADR-0006: se sigue con Next 16; mandan LCP e INP en un Android real, y el tope de JS de «Hoy» pasa de 120 a 180 KB brotli. «Hoy» no carga supabase-js en el navegador y el service worker se escribe a mano.
- `scripts/medir-js.mjs` y `pnpm medir:js [ruta] [tope]`: levanta `next start`, mide los scripts de la ruta con brotli y sale con error si pasa el tope.
- `CLAUDE.md` (regla 9 de «Celular primero») y `docs/PROMPT-INICIAL.md` (A11) al día.

**Cómo se verificó:**
- `pnpm medir:js / 180`: 146.8 KB, sale 0. Con tope 120 sale 1. Comparación hecha con una app mínima de Vite + React 19 + React Router (82 KB) y con supabase-js (126 KB).

**Pendiente:**
- `medir:js` sobre «Hoy» necesita sesión (`MEDIR_COOKIE`) cuando A2 ponga el login; se agrega al CI en A11.
- Medir LCP e INP en un Android de gama media real, no solo bytes.
