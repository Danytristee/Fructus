# 2026-11-17 · /formidable de la tarjeta de venta con manos libres, después de corregir

- **Qué cambió (3 cambios con OK):**
  - Después de corregir hablando, el recuadro «Con esta venta, … te debe» ya no desaparece: el saldo solo se borra si la corrección cambió de cliente. El error estaba desde el 16-11.
  - La tarjeta marca «corregido» en lo mismo que dice la voz (la fruta, el cliente o el total), con una variante nueva de `Insignia`. La regla que decide qué cambió (`cambiosDeCorreccion`) es una sola para la voz y la pantalla, y la marca se va si se toca y se cambia algo a mano.
  - Al escuchar, la línea enseña «repite»: «Te escucho: di «confirmo», «repite» o lo que hay que cambiar».
- **Cómo se verificó:** Vitest, 380 de `lib/voz` en verde. Playwright a 412 y 360 px: `voz-confirmar-hablando`, `voz-candados`, `voz-operaciones-hablando` y `voz-venta`, 48 de 48; la de «no, son ocho cajas» espera el recuadro de la deuda con «+ S/ 360.00 de hoy» y dos «corregido». Medido en 6 momentos a 412, 360 y 1280 px: 0 controles bajo 48 px, 0 desborde, la línea de la voz en 2 renglones y la insignia con 9.0:1 a 9.8:1. Informe: `docs/formidable/manos-libres-2026-11-17.md`.
- **Pendiente:** a 360 px, «corregido» del total baja a un segundo renglón bajo «Total». Probarlo con audífono en el S25.
