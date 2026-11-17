# 2026-11-17 · La tarjeta de venta avisa si no alcanza el stock

- **Qué cambió:** si la venta pide más cajas de las que hay, la tarjeta lo dice sin bloquear: «Según la app te quedan 6 cajas de Mango Kent y vas a vender 10. Igual puedes confirmarla. ¿Falta anotar una compra?». Sin stock o en negativo no da una cifra imposible. Con varias frutas es un solo aviso, debajo de «Pagó / Lo debe». El stock viaja en la tarjeta desde el servidor (`resolver`, al dictar y al corregir), y la fruta elegida tocando lo pide con `stockDe`. En manos libres se dice antes de «¿Confirmo?». Al guardar, el sello recuerda la compra que falta anotar. La regla vive en `lib/voz/stock-venta-reglas.ts`, y `Aviso` tiene una variante nueva, `atencion`.
- **Cómo se verificó:**
  - Vitest: 1019.
  - Playwright a 412 y 360 px: 50 de 50 en voz-aviso-stock, voz-venta, voz-confirmar-hablando y voz-candados. Al vender 10 con 6, la venta se guarda y la base queda en −4.
  - Invariantes en orden.
  - /chaos: 6 de 6 resistieron (dos celulares a la vez, permisos, red cortada, cinco toques, stock viejo, recargar), y la base se restauró.
  - /formidable: de 7.6 a 8.2.
- **Pendiente:**
  - a 360 px con varias frutas, el aviso se termina de leer deslizando;
  - «Anotar compra» desde el sello (flujo nuevo);
  - medir en la demo cuántas ventas lo muestran: si son casi todas, el arreglo es anotar las compras al llegar, no esconder el aviso;
  - `components/voz/TarjetaVenta.tsx` pasa de 300 líneas y pide partirse.
