# /chaos · Tarjeta de venta con pago parcial · 2026-11-17

- **Pantalla:** la hoja «¿Así fue la venta?» con «Pagó una parte» (`components/voz/TarjetaVenta.tsx`, `PagoParcial.tsx`) y `registrar_venta` con `pago_inicial` (ADR-0023).
- **Rama:** `claude/relaxed-ptolemy-4390e8`. **Semilla:** 1117. **Base:** local propia (`fructus-pago`), con un volcado antes y un `db reset` al terminar. Invariantes limpias antes y después de cada ataque que escribió.
- **Conteo:** 12 ataques, 11 resistieron, 1 hallazgo.

## Hallazgo

### 1 · Gravedad 2 · Anular una venta con pago al llevar no dice que el cliente queda a favor

**Pasos (I):** dictar «10 cajas de mango a 500, pagó solo 1000» para un cliente sin deuda → Confirmar → Ventas → la venta → «Anular esta venta».

**Qué se ve:**
- El detalle dice «S/ 5,000.00 · Lo debe», sin lo que pagó al llevar.
- La hoja de anular dice «… te debe S/ 5,000.00 menos».

**Qué queda en la base:** el saldo del cliente es **−1,000**, es decir, S/ 1,000 a su favor, y el abono sigue atado a la venta anulada. Es la regla elegida (opción A), pero la pantalla no lo dice. El dueño cree que el cliente queda en cero, y en la siguiente venta Fructus le descuenta S/ 1,000 sin que nadie lo haya visto venir.

**Arreglo:** es la actividad 5. El detalle tiene que decir «Pagó S/ 1,000 al llevar · debe S/ 4,000», y la hoja de anular, «Los S/ 1,000 que pagó quedan a su favor».

## Resistieron

| Ataque | Qué pasó |
|---|---|
| N1 · cinco toques en el mismo tick | 1 venta, 1 abono, debe S/ 4,000. |
| N2 · la red se cuelga al confirmar | «Quedó en el celular»; al volver, entra una sola vez con el pago de S/ 1,000 por Yape. |
| N3 · voz ambigua (Claude real) | «me dio mil o dos mil» y «me dejó algo»: no anota pago y deja la duda. «pagó 6000» de 5,000: al contado, con la duda. «me pagó mil» marcado al contado: la tarjeta lo pasa a «Debe el resto». |
| N4 · montos con coma | «1,299.50», «1.000», «1,000», «-50», «0», «1e3», cifras árabes y 9 dígitos se rechazan con su frase; «1,5» es S/ 1.50. |
| N5 · dueño y ayudante a la vez, mismo cliente | 2 ventas, 2 abonos, debe S/ 8,000. Invariantes limpias. |
| A · el precio cambia después de anotar el pago | Si lo pagado llega al total: «… menos que el total (si pagó todo, toca «Pagó»)», y Confirmar se bloquea. Con «Pagó» se guarda al contado y sin abono. |
| F · sesión vencida al confirmar | No guarda; al volver a entrar, la tarjeta sigue con «Pagó ahora S/ 1,000» y entra bien. |
| H · lo pagado alterado en la petición (3 decimales, negativo, más que el total) | No se guarda nada. Con 3 decimales: «Revisa cuánto pagó.» Con negativo o más que el total: «Revisa el precio y las cajas de la tarjeta.» La frase es imprecisa, pero solo se llega alterando la petición. |
| C · ayudante, cliente de paso al crédito con pago | Lo rechaza `venta_credito_requiere_cliente`. |
| C2 · un segundo abono atado a la misma venta | Lo rechaza `abonos_uno_por_venta`. |
| C3 · el ayudante anula | «Solo el dueño o el administrador pueden anular ventas.» |

## Notas sin gravedad

- Algunas dudas del intérprete todavía explican en vez de dudar («'Le rebajé mil' se registró como descuento de S/ 1000»). Con manos libres, una duda impide confirmar hablando. Ya bajaron de 25 a 10 en 93 casos (`docs/voz/precision-2026-11-17-3.md`).
