# 2026-10-26 · Reglas del proyecto y flujo de trabajo

**Qué cambió:**
- `CLAUDE.md` completo: principios, stack, estructura, celular primero, diseño, voz, base, calidad y flujo.
- Siete skills del proyecto, cinco adaptadas de CAYLA Retail y dos nuevas.
- Hook de pre-commit, CI en dos trabajos, trabajo que mantiene despierta la base y plantilla de PR.
- `scripts/invariantes.sql` con 12 invariantes.
- Primera prueba pgTAP.
- Casos del intérprete en `tests/interprete/casos.json`.
- ADR-0001 a 0003.
- `docs/PROMPT-INICIAL.md` para arrancar el desarrollo en Claude Code.
- `supabase/config.toml`, generado con `supabase init`.
- La migración `20261026165117` envuelve el `revoke` de `rls_auto_enable()` en un `if exists`. Esa función solo existe en el proyecto alojado, y sin el `if exists` la migración rompía en local y en el CI. En el proyecto el efecto es el mismo.

**Cómo se verificó:**
- Migraciones y seed aplicados en un Postgres 17 local.
- Invariantes limpias con el seed y con un escenario de compra, venta, abono y anulación. Con datos corrompidos a propósito, detectan INV-01, INV-04 e INV-12.
- Las 14 aserciones de `01_ventas_roles.test.sql` pasan con sustitutos mínimos de pgTAP. No se pudo correr `supabase start` porque el entorno no tenía acceso a los registros de imágenes Docker; el CI lo correrá con el pgTAP real.

**Pendiente:**
- Cargar los secrets `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` en GitHub.
- Correr `/identidad-visual` antes de la primera pantalla.
