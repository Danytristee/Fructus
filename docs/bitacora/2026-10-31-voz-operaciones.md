# 2026-10-31 · A6: el resto de las operaciones por voz

**Decisiones del día** (las tomó quien dirige el proyecto):
- **Abono mayor que la deuda:** se deja guardar y la tarjeta lo avisa en grande («Le quedan S/ 70 a favor»).
- **Compra sin decir si se pagó:** se pregunta Pagó / Lo debe, como en la venta, y `registrar_compra` rechazará la compra sin condición (hoy asume contado).

**Actividad 1 · Abono por voz.**
- Qué cambió: índice único de abonos por comando (`20261031120000_abono_unico_por_comando`, solo en local), `confirmarAbono` y `TarjetaAbono`. La pieza común de confirmar (`useConfirmar`, `PieConfirmar`, `Guardado`, `FilaCliente`, `SelectorMedio`, `DudasVoz`, `EditorMonto`, `leerMonto`) ya la usa también la venta.
- Cómo se verificó: pgTAP (45), Vitest (129), e2e de abono y venta a 412 y 360 px, y las 12 invariantes en orden.

## Pendiente
- Aplicar las migraciones de A6 al proyecto, con OK, al cerrar la última actividad.
- `/formidable` y `/chaos` de las tarjetas nuevas (actividad 5).
