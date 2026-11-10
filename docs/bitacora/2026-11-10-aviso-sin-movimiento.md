# 2026-11-10 · «No se están vendiendo»: ni cajas recién llegadas ni 58 frutas en una tarjeta

- **Qué cambió:**
  - La regla: «no se está vendiendo» solo salta si las cajas llevan 7 días o más en el puesto (`lib/inventario-reglas.ts`). Antes, 20 cajas cargadas hoy ya decían «sin vender en 7 días». La edad del lote cuenta también los ajustes a favor (conteo, stock inicial), no solo las compras (`lib/inventario.ts`).
  - La tarjeta (`components/inventario/TarjetaAlerta.tsx`, que sale de `TableroStock.tsx`): cuando junta varias frutas, nombra 3 y el resto va en una hoja con «Ver las N frutas».
- **Cómo se verificó:** Vitest (524, con la prueba de las cajas de 0, 3 y 6 días, que fallaba antes del arreglo), e2e de Stock y «Hoy» a 412 y 360 px con una prueba nueva (4 frutas de hace 10 días y 1 de hoy). Capturas con el catálogo real y 20 cajas por producto, de hoy y de hace 10 días (`docs/formidable/capturas/stock-sin-movimiento-2026-11-10/`).
- **Pendiente:** `/formidable` de la tarjeta y su hoja.
