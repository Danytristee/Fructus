# 2026-10-28 · Identidad «Aurora» y la unidad «caja»

**Qué cambió:**
- **ADR-0007 (identidad Aurora):**
  - tokens en `app/globals.css` (claro y oscuro, con las variables de shadcn apuntando a ellos);
  - Manrope con `next/font`;
  - piezas `Boton`, `Monto`, `Tarjeta`, `Insignia`, `Hoja`, `Fruta`, `FondoAurora` y `BotonVoz`;
  - fruta ilustrada en `public/frutas/`;
  - página `/piezas`, solo en desarrollo.

  También cambia la regla de movimiento de `CLAUDE.md`. Maquetas v4 (Aurora, Bento, Horizonte) en `docs/maquetas/identidad/`.
- **ADR-0008 (la unidad es la caja):**
  - «jaba» pasa a «caja» en pantalla, base, docs e intérprete; por voz se sigue aceptando «jaba»;
  - nueva migración `20261028222919_unidad_caja.sql` (aplicada al proyecto) y `lib/formato.ts` con su prueba.
- **shadcn:** `button` y `sheet` en `components/shadcn/`, con el velo de la hoja apuntando al token `--velo`. Knip no revisa sus
  exportaciones sin usar.

**Cómo se verificó:**
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (4 pruebas nuevas) y `pnpm knip`: en verde.
- `npx supabase db reset` y `npx supabase test db`: 18 pruebas. `pnpm db:invariantes`: las 12 en orden.
- `/piezas` a 412 y 360 px, en claro y en oscuro:
  - cifras de 46 y 30 px, ningún control bajo 48 px, sin desborde;
  - mantener y soltar el orbe abre la hoja, y Confirmar muestra «guardando» y cierra.
  - Capturas en `docs/capturas/a1-*.png`.
- **Proyecto de Supabase:**
  - `unidad_caja` aplicada como `20261028222919`; los 10 productos quedaron en `caja` y el resumen devuelve `cajas_vendidas`.
  - `get_advisors` no trae avisos nuevos: siguen solo los que `CLAUDE.md` deja a propósito.

**Pendiente:**
- Medir INP con el vidrio en un Android de gama media (A11).
