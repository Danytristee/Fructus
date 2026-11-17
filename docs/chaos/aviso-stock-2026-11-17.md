# /chaos · El aviso de stock en la tarjeta de venta (2026-11-17)

**Pantalla:** la hoja «¿Así fue la venta?» con el aviso de stock: `components/voz/AvisosStock.tsx`, `TarjetaVenta.tsx` y `stockDe`
(`app/(app)/acciones-voz.ts`).
**Rama:** `claude/aviso-stock-venta`. **Semilla:** 20261117. **Base:** la local de esta copia (`fructus-respaldo`, 5652x), nunca la
del proyecto.
**Conteo:** 6 ataques; 6 resistieron. 0 hallazgos de gravedad 1 a 4.
**Antes y después:** volcado `--data-only` antes de atacar y restaurado al terminar, en una sola transacción: 151 ventas, el mismo stock
y las 12 invariantes en orden.

## Ataques

| # | Ataque | Familia | Resultado |
|---|---|---|---|
| A | Dueño y ayudante venden a la vez las últimas 8 cajas de palta (`registrar_venta` en paralelo) | Concurrencia | **Resistió.** Las dos ventas entran y el stock queda en −8. Es lo esperado: el aviso no bloquea y la base no frena vender sin stock anotado (se vende antes de anotar la compra). Invariantes en orden. |
| B | ¿Quién lee el stock? Ayudante, contador y sin sesión | Permisos | **Resistió.** Ayudante y contador leen (2 filas); sin sesión, 0 filas. `stockDe` además devuelve null sin sesión. |
| C | Se corta la red justo cuando la tarjeta pide el stock | Red | **Resistió.** Sin aviso, sin error a la vista. Confirmar guarda una venta. Sin stock leído no se inventa un aviso. |
| D | Cinco toques a Confirmar en el mismo tick, con el aviso a la vista | Doble toque | **Resistió.** Una sola venta. |
| E | Otro celular vende la fruta mientras la tarjeta está abierta | Concurrencia | **Resistió.** La tarjeta avisa con el stock que leyó al abrir y la venta se guarda. El aviso puede quedar viejo, y eso es aceptable porque solo avisa. |
| F | Recargar con la tarjeta abierta | Sesión | **Resistió.** Con «Verla», la venta vuelve con su aviso. |

**Del núcleo que no aplica a este cambio:**
- *Monto con coma:* el aviso no lee montos; ya lo cubre `voz-venta.spec.ts`, «un precio que no es precio se rechaza».
- *Voz ambigua:* una fruta con opciones no avisa hasta que se elige; lo prueba `voz-aviso-stock.spec.ts`, «una fruta elegida tocando».

## Lo que no es de /chaos pero salió aquí

Lo de diseño va en `/formidable` (`docs/formidable/aviso-stock-2026-11-17.md`): con dos avisos, a 360 px, el total y «Pagó / Lo debe»
quedan fuera de la pantalla.
