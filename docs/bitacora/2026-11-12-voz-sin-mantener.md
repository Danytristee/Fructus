# 2026-11-12 · Voz sin mantener presionado (ADR-0018)

- **Qué cambió:**
  - Un toque deja el orbe escuchando y otro toque envía.
  - Mientras se mantiene, subir el dedo hasta el candado (encima del orbe) hace lo mismo, como los audios de WhatsApp.
  - Escuchando sin el dedo, el orbe dice «Enviar», «Borrar» descarta y la barra se aparta. A los 55 s se envía solo.
  - /chaos encontró el micrófono prendido tras toques rápidos y quedó arreglado (`useGrabadora`, una vuelta por `empezar`).
- **Cómo se verificó:**
  - Vitest: 539, con 15 del gesto.
  - `voz.spec.ts` a 412 y 360 px: 24 en verde. La prueba del micrófono falló antes del arreglo (5 de 5) y pasa después (8 de 8).
  - /formidable de 8.4 a 8.9, con dos pruebas ciegas.
  - /chaos (semilla 2026111201): 7 de 8 resistieron y el octavo quedó arreglado. Invariantes limpias antes y después.
  - Capturas en `docs/formidable/capturas/voz-gestos-2026-11-12/`.
- **Pendiente:**
  - **Sin probar en un teléfono real:** el toque de 300 ms, los 94 px del candado y el micrófono con la pantalla bloqueada (`lib/voz/gesto-reglas.ts`).
  - `app/piezas/DemoVoz.tsx:15` y `app/piezas/page.tsx:93` todavía dicen «Mantén para hablar».
  - **La base local la comparten todos los worktrees.** Otra sesión aplicó `20261112120000_proveedores_completos` y cargó el catálogo real (los productos 1 a 3 quedaron inactivos). Por eso fallan aquí `voz-merma.spec.ts`, `hoy.spec.ts:10`, `escritorio.spec.ts:76` y, a veces, `voz-venta.spec.ts:36`. No es el botón: corren contra datos que ya no son los del seed. Un `db reset` de una sesión rompe a la otra; conviene una base por worktree o un acuerdo.
  - De la 2.ª prueba ciega: el candado sin palabra y la etiqueta en reposo que no dice cómo se termina (`docs/formidable/voz-gestos-2026-11-12.md`).
  - Sigue la parte 2: «Hola Fructus» con openWakeWord (actividades 4 a 6).
