# ADR-0003 — Una sola app, con la organización y el flujo de CAYLA Retail

**Fecha:** 2026-10-26 · **Estado:** aceptado

## Contexto

CAYLA Retail es un ERP construido con el mismo stack (Next.js + Supabase + RLS) y con un flujo de trabajo probado en producción. Tiene:
- lógica pura en `lib/*-reglas.ts` con su prueba al lado;
- hook de pre-commit que revisa solo lo del commit;
- CI obligatorio;
- ADR y bitácora con un archivo por entrada;
- skills propias (`/construir`, `/formidable`, `/chaos`, `/decide`, `/abrir-pr`).

Allá es un monorepo con pnpm y Turborepo porque tiene dos apps y paquetes compartidos.

## Decisión

- **Una sola app de Next.js en la raíz, sin monorepo.** Con una app y una persona, Turborepo y `packages/` serían ceremonia (principio de simplicidad radical).
- **Se adopta de CAYLA Retail:**
  - la organización interna (`app/`, `components/ui/` con una pieza por función, `lib/*-reglas.ts` + prueba);
  - los principios, adaptados;
  - el hook de pre-commit;
  - el CI en dos trabajos (código y base);
  - la plantilla de PR;
  - la bitácora de un archivo por entrada;
  - las invariantes revisadas después de cada ataque de `/chaos`;
  - la regla de que las skills de diseño de afuera «se consultan, no mandan».
- **Se adaptan las skills** `/construir`, `/formidable` (aquí manda el celular, no el escritorio), `/chaos` (con una familia de ataques de voz), `/decide` y `/abrir-pr` (sin reservas de números, que solo hacen falta con muchas personas en paralelo).
- **Se agregan dos skills propias:** `/identidad-visual` y `/voz-precision`.
- **No se adopta (todavía):**
  - las reservas de números de ADR y migraciones;
  - el tablero de sesiones activas;
  - la protección de `main` con reglas de GitHub, que en repos privados exige un plan de pago.

  Se retoman si el equipo crece.

## Consecuencias

Quien venga de CAYLA Retail reconoce la estructura y el flujo. Si Fructus crece a varias apps (por ejemplo, una vista para el contador
separada), se reevalúa el monorepo con un ADR nuevo.
