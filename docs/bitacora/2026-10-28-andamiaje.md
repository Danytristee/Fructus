# 2026-10-28 · A0 Andamiaje

**Qué cambió:**
- App de Next.js 16.4 (App Router, Turbopack) con React 19.3, TypeScript estricto (`noUncheckedIndexedAccess`), Tailwind 4, ESLint 9, Vitest 4, Playwright (412 y 360 px) y Knip. pnpm 10 fijado con `packageManager`.
- Clientes de Supabase en `lib/supabase/` (servidor con `server-only` y navegador) y tipos generados en `tipos-db.ts`. Scripts `db:invariantes` y `db:tipos`.
- CLI de Supabase 2.122 como dependencia, la misma versión en el CI: la 2.109 que había en la máquina no leía `config.toml` (`orioledb_version`).
- Puertos locales movidos a 563xx: los 543xx los ocupa otro proyecto en la misma máquina. El CI usa los mismos.
- `.env.development.local` (fuera de git) apunta el desarrollo a la base local; `.env.local` guarda las del proyecto alojado y las claves.

**Cómo se verificó:**
- `supabase start` aplica las 3 migraciones y el seed. **pgTAP real por primera vez: 14/14.** `pnpm db:invariantes` limpio, y una excepción sale con código 1.
- `typecheck`, `lint`, `knip`, `test` y `build` en verde. `pnpm e2e`: 2/2 (412 y 360 px), sin scroll horizontal.

**Pendiente:**
- `GEMINI_API_KEY` todavía vacía en `.env.local` (respaldo del intérprete, A4). Lucode queda para A9.
- ESLint 9 ya figura como deprecado en npm (hay 10); se queda en 9 por `CLAUDE.md` hasta un ADR.
- Mejoras aprobadas el 2026-10-28, cada migración con su OK antes de aplicarse:
  1. Clave de operación única contra el doble toque y el reintento (A5, ADR-0004).
  2. Libro cerrado: sin `delete`/`update` en libros, ayudante solo por RPC, anular abono/gasto/compra (A5, A6 y A8, ADR-0005). Hoy `*_gestion` da `for all` (`supabase/migrations/20261026165046_esquema_inicial.sql:581`) y el ayudante inserta directo en `movimientos_stock` (`:597`).
  3. Stock negativo: permitir y avisar en la tarjeta, salvo que se decida otra cosa antes de A5; conteo de stock inicial en A8.
  4. 40 casos o más en `tests/interprete/casos.json` y 25–30 audios reales del puesto durante A4.
  5. Una sola RPC de lectura para resolver el comando, vocabulario en caché y medir la región de Vercel (A4).
  6. Cierre con efectivo esperado en caja (A10). Las compras al crédito hoy cuentan como salida de plata y no hay libro de proveedores.
