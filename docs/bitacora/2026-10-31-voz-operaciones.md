# 2026-10-31 · A6: el resto de las operaciones por voz

**Decisiones del día** (las tomó quien dirige el proyecto):
- **Abono mayor que la deuda:** se deja guardar y la tarjeta lo avisa en grande («Le quedan S/ 70 a favor»).
- **Compra sin decir si se pagó:** se pregunta Pagó / Lo debe, como en la venta, y `registrar_compra` rechazará la compra sin condición (hoy asume contado).

**Actividad 1 · Abono por voz.**
- Qué cambió: índice único de abonos por comando (`20261031120000_abono_unico_por_comando`, solo en local), `confirmarAbono` y `TarjetaAbono`. La pieza común de confirmar (`useConfirmar`, `PieConfirmar`, `Guardado`, `FilaCliente`, `SelectorMedio`, `DudasVoz`, `EditorMonto`, `leerMonto`) ya la usa también la venta.
- Cómo se verificó: pgTAP (45), Vitest (129), e2e de abono y venta a 412 y 360 px, y las 12 invariantes en orden.

**Actividad 2 · Merma por voz.**
- Qué cambió: índice único de merma por comando en `movimientos_stock` (`20261031120100_merma_unica_por_comando`, solo en local; parcial por tipo, porque una venta con varias frutas deja varias salidas con el mismo comando), `confirmarMerma` y `TarjetaMerma`. `EditorItem` tiene ahora una variante sin dinero.
- Cómo se verificó: pgTAP (52), e2e de merma, venta y abono a 412 y 360 px, y las 12 invariantes en orden. La captura mostró «solo tenías -91 cajas» con el stock en negativo: ahora dice «no te quedaba Mango Kent».

## Pendiente
- Aplicar las migraciones de A6 al proyecto, con OK, al cerrar la última actividad.
- `/formidable` y `/chaos` de las tarjetas nuevas (actividad 5).
- El stock local de Mango Kent queda muy negativo tras varias corridas de e2e (las ventas de prueba no reponen): no es un error de la app, pero ensucia las capturas. `tests/e2e/voz-venta.spec.ts` podría abastecer antes de vender.
