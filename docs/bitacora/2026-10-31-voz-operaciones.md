# 2026-10-31 · A6: el resto de las operaciones por voz

**Decisiones del día** (las tomó quien dirige el proyecto):
- **Abono mayor que la deuda:** se deja guardar y la tarjeta lo avisa en grande («Le quedan S/ 70 a favor»).
- **Compra sin decir si se pagó:** se pregunta Pagó / Lo debe, como en la venta, y `registrar_compra` rechazará la compra sin condición (hoy asume contado).

**Actividad 1 · Abono por voz.**
- Qué cambió: índice único de abonos por comando (`20261031211524_abono_unico_por_comando`), `confirmarAbono` y `TarjetaAbono`. La pieza común de confirmar (`useConfirmar`, `PieConfirmar`, `Guardado`, `FilaCliente`, `SelectorMedio`, `DudasVoz`, `EditorMonto`, `leerMonto`) ya la usa también la venta.
- Cómo se verificó: pgTAP (45), Vitest (129), e2e de abono y venta a 412 y 360 px, y las 12 invariantes en orden.

**Actividad 2 · Merma por voz.**
- Qué cambió: índice único de merma por comando en `movimientos_stock` (`20261031211526_merma_unica_por_comando`; parcial por tipo, porque una venta con varias frutas deja varias salidas con el mismo comando), `confirmarMerma` y `TarjetaMerma`. `EditorItem` tiene ahora una variante sin dinero.
- Cómo se verificó: pgTAP (52), e2e de merma, venta y abono a 412 y 360 px, y las 12 invariantes en orden. La captura mostró «solo tenías -91 cajas» con el stock en negativo: ahora dice «no te quedaba Mango Kent».

**Actividad 3 · Gasto por voz.**
- Qué cambió: índice único de gastos por comando (`20261031211529_gasto_unico_por_comando`), `confirmarGasto` y `TarjetaGasto`. La categoría y el medio usan la misma pieza (`GrupoOpciones`), y `HojaVoz` elige la tarjeta con un `switch`.
- Cómo se verificó: pgTAP (58), e2e de gasto, venta, abono y merma a 412 y 360 px (44 en verde), y las 12 invariantes en orden.

**Actividad 4 · Compra por voz.**
- Qué cambió: `20261031211551_compra_por_voz` (solo en local) hace que `registrar_compra` rechace la compra sin condición (antes asumía contado), sea idempotente por comando, marque «corregido» y exija proveedor al crédito (`compra_credito_requiere_proveedor`). `TarjetaCompra` pregunta «¿La pagaste o la debes?» y sugiere el último costo, marcado. `PagoODebe` acepta los textos de la compra y la insignia «sugerido» es una pieza (`InsigniaSugerido`).
- Las pruebas pgTAP 01 y 04 llamaban a `registrar_compra` sin condición (contaban con el contado por defecto): ahora la dicen.
- Cómo se verificó: pgTAP (68), Vitest (155), todos los e2e (115) y las 12 invariantes en orden. A 360 px, «Primero: ¿la pagaste o la debes?» partía el botón en dos líneas: quedó «Primero: ¿la pagaste?».

**Actividad 5 · Cierre.**
- `/formidable` 8.8 → 9.0 con 3 cambios («dijiste …», «Ayudantes», «Primero: ¿pagaste o debes?»). `/chaos` con semilla 31: 19 de 21
  ataques resistieron y los 2 hallazgos quedaron arreglados con su prueba (respuesta perdida, texto largo).
- JavaScript de «Hoy»: 177.4 KB brotli (tope 180).
- Migraciones aplicadas al proyecto con OK y renombradas a su versión real: `20261031211524_abono_unico_por_comando`,
  `20261031211526_merma_unica_por_comando`, `20261031211529_gasto_unico_por_comando` y `20261031211551_compra_por_voz`. Antes se
  revisó que no hubiera compras al crédito sin proveedor ni comandos repetidos; después, las 12 invariantes en 0, `anon` sin permiso
  sobre `registrar_compra` y el linter sin avisos nuevos. Los tipos de `public` no cambian.

## Pendiente
- El medio de pago viene marcado («Efectivo») aunque no se diga (regla 4 del prompt): decidir si se pregunta, con `/voz-precision` antes y después.
- Revisar en `/formidable` si «Primero: ¿pagó o lo debe?» de la venta también parte el botón a 360 px.
- A 360 px, «Efectivo» queda justo dentro de su píldora (ya pasaba en la venta): revisarlo en `/formidable` (`components/voz/GrupoOpciones.tsx`).
- El stock local de Mango Kent queda muy negativo tras varias corridas de e2e (las ventas de prueba no reponen): no es un error de la app, pero ensucia las capturas. `tests/e2e/voz-venta.spec.ts` podría abastecer antes de vender.
