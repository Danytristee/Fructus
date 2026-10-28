# ADR-0008 — La unidad se llama «caja»

**Fecha:** 2026-10-28 · **Estado:** aceptado

## Contexto

Fructus nació diciendo «jaba» en pantalla y en la base, y aceptaba «caja» solo por voz. Quien dirige el proyecto pidió que la unidad
se llame simplemente **«caja»**.

`CLAUDE.md` pide que la base y la pantalla usen el mismo nombre, sin sinónimos entre capas. Por eso el cambio no puede quedarse en la
interfaz.

## Decisión

- **En pantalla, en la base, en los documentos y en el intérprete la unidad es «caja».**
- **Por voz se sigue aceptando «jaba» como sinónimo:** en el mercado se dicen las dos. Dos casos de `tests/interprete/casos.json`
  siguen diciendo «jabas» para probarlo.
- **Base:** la migración `20261028222919_unidad_caja.sql` (nueva; las aplicadas no se editan) hace tres cosas:
  - cambia el valor por defecto de `productos.unidad` a `'caja'`;
  - pasa a `'caja'` las filas que decían `'jaba'`;
  - hace que `resumen_dia()` devuelva `cajas_vendidas` en vez de `jabas_vendidas`. Ninguna pantalla leía esa llave todavía.
- `lib/formato.ts` trae `formatearCajas()`: «1 caja», «10 cajas».

## Alternativas descartadas

- **Cambiar solo los textos de pantalla:** sería más rápido, pero dejaría «jaba» en la base y «caja» en la pantalla, que es justo el
  sinónimo entre capas que `CLAUDE.md` prohíbe.

## Consecuencias

- La migración se probó en local (`db reset`, pgTAP con `02_unidad_caja.test.sql` e invariantes) y se aplicó al proyecto el
  2026-10-28 con el OK de quien dirige el proyecto. Supabase le asignó la versión `20261028222919`. En el proyecto, los 10 productos
  quedaron en `caja` y `resumen_dia()` devuelve `cajas_vendidas`.
- Los ADR anteriores que dicen «jabas» no se reescriben: son el registro de lo que se decidió en su momento.
