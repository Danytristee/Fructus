# 2026-11-12 · La cola sin conexión: lo confirmado o dictado sin señal entra solo, en orden

- **Qué cambió:** cola en el celular (IndexedDB) con las confirmaciones y los audios hechos sin señal; se envían solos y en orden al volver
  (los audios vuelven como tarjetas por confirmar). Franja «Sin señal / Enviando / Listo / No se pudo guardar» arriba en todas las pantallas.
  «Quedó en el celular» en vez del sello cuando se confirma sin señal. Registrar a mano abre sin señal. ADR-0017.
- **Cómo se verificó:** Vitest (550, con 26 de `lib/cola-reglas.test.ts`); e2e nuevo `tests/e2e/cola-sin-conexion.spec.ts` a 412 y 360 px
  (corta la red, confirma una venta, dicta, vuelve la señal y revisa en la base la venta, el saldo y el abono); se actualizaron las pruebas de
  «respuesta perdida» y «sin señal» al comportamiento nuevo. `medir:js` de «Hoy»: 149.7 KB. Invariantes: las 12 en orden.
- **Pendiente:** la fecha de lo encolado es la del envío (ver ADR-0017); `/formidable` de la franja y `/chaos` de la cola; `voz-compra` y la merma
  simultánea ya fallaban en `main` antes de este cambio.
