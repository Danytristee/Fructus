# 2026-11-09 · Escritorio: panel lateral verde y tablas (ADR-0015)

- **Qué cambió:**
  - Desde 1024 px, un panel lateral verde (`components/marco/PanelLateral.tsx`) reemplaza la barra de abajo y el menú de tres rayas, con Cierre y Ajustes a la vista. El celular no cambia.
  - Clientes y Ventas se ven en tabla (`TablaClientes`, `TablaVentasDelDia`); «Hoy», la ficha del cliente, Stock, Cierre y Ajustes van a dos columnas.
  - Las acciones de cada pantalla van a la derecha del título; la caja negativa del cierre se explica con una frase (`fraseDeLaCaja`); la hoja devuelve el foco al cerrarse.
- **Cómo se verificó:** `tests/e2e/escritorio.spec.ts` (panel, tablas, orden, acciones arriba, regresiones G3 y G4) y la auditoría visual a 1280 px, más las pruebas de las pantallas tocadas a 412 y 360 px: 33 pasan, ninguna falla. `/formidable` 8.1 y `/chaos` con 4 de 6 resistiendo; los 5 arreglos se aplicaron con OK.
- **Pendiente:**
  - El aviso «Each child in a list should have a unique key prop» en Clientes, que ya estaba antes de esta obra.
  - Decir «las anuladas no cuentan» junto al conteo de Ventas; el aire bajo «Sus movimientos» en la ficha cuando hay pocos.
  - Esperan un OK aparte: la voz en todas las pantallas, la tarjeta «Venta por voz», «¿Desde cuándo te debe?» y la comparación con el lunes pasado.
  - `pnpm medir:js` (necesita `MEDIR_COOKIE`) y `pnpm medir:pintura`.
