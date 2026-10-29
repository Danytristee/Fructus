# 2026-10-28 · Catálogo de la proyección y día de demo

**Qué cambió:**
- **`scripts/demo/catalogo-proyeccion.sql`:** 35 productos del Excel del dueño (`Proyeccion_Frutas_Mensual.xlsx`).
  - Cada variedad es un producto, porque tiene stock propio.
  - El precio de referencia es el de venta proyectado y solo se usa como «sugerido».
  - Los 7 productos ficticios del seed que el puesto no vende quedan inactivos; no se borran.
  - Se puede correr varias veces sin duplicar.
- **`scripts/demo/dia-demo.sql`:** un día de demo registrado con las RPC reales, para las capturas del informe:
  - ayer, compras y 4 deudas;
  - hoy, compras, 14 ventas, 2 abonos, 1 merma y 2 gastos;
  - recibe la fecha con `fructus.demo_fecha`.
- **Dibujos nuevos de manzana, pera, kiwi y uva** (las frutas que más vende el puesto), y tangelo usa el de naranja.

**Cómo se verificó:**
- En local, sobre una base recién rehecha: el catálogo deja 35 activos y 7 inactivos, y corrido dos veces no duplica. El día de demo
  entra completo y las invariantes salen las 12 en orden.
- `pnpm test`: 34 pruebas en verde.
- Capturas de «Hoy» a 412 y 360 px.

**Pendiente:**
- **El origen** (Chile, Argentina, nacional) también separa el stock, pero el Excel no dice qué combinaciones existen. Se agregan
  cuando el dueño las confirme.
- **Los precios** de referencia son proyecciones: se reemplazan por los reales con las primeras ventas.
- **El seed local** sigue con el catálogo ficticio. Pasarlo al real cambia las pruebas pgTAP y los casos de voz; va con el catálogo
  real (A12), junto con volver a medir el catálogo en el prompt del intérprete.
