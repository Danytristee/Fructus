# ADR-0025 — Lo que el cliente paga al llevarse la fruta es un abono de esa venta

**Fecha:** 2026-11-17 · **Estado:** aceptado (cambia `registrar_venta`; la deuda se sigue contando igual)

## Contexto

«Vendí 10 cajas de mango a don Lucho a 500 y pagó solo 1000» es una venta normal en el puesto: el cliente se lleva S/ 5,000 de fruta,
deja S/ 1,000 y debe S/ 4,000. Fructus no tenía cómo guardarla. Una venta era al contado o al crédito, sin nada en medio:

- al contado se perdían los S/ 4,000 que debe;
- al crédito, los S/ 1,000 que pagó.

El intérprete entendía la frase (sus dudas lo decían: «Pago parcial: 100 ahora, resto a crédito»), pero no tenía dónde ponerla. En la
medición del 17-11 la puso **al contado con S/ 4,000 de descuento**: la venta habría quedado pagada y la deuda, borrada
(`docs/voz/precision-2026-11-17.md`). Eso rompe el principio 2.

## Decisión

1. **La venta queda al crédito por el total, y lo que pagó entra como un abono en la misma transacción** (`registrar_venta`, con
   `p.pago_inicial = {monto, medio_pago}`). La deuda sale de la cuenta de siempre (principio 4: ventas al crédito − abonos):
   5,000 − 1,000 = 4,000. El cierre del día ya cuenta los abonos como cobrado, así que los S/ 1,000 entran a la caja sin tocarlo.
2. **`abonos.venta_id` ata ese abono a su venta**, con un índice único: un pago al llevar por venta. Sirve para decir «pagó al
   llevar» en la ficha y en el detalle, y para revisarlo.
3. **Cero estados imposibles (principio 3):**
   - `registrar_venta` rechaza un pago en una venta al contado, un pago igual o mayor que el total (eso es contado), cero, más de dos
     decimales o sin medio de pago;
   - el trigger `abono_de_su_venta` exige que todo abono atado a una venta sea de esa venta (al crédito, del mismo cliente, registrada
     y por menos que el total), también en un insert directo;
   - la invariante 13 lo revisa.
4. **El abono no lleva `comando_voz_id`:** lo lleva la venta, que ya es idempotente por comando. Un doble toque devuelve la misma
   venta sin volver a insertar nada.
5. **Anular la venta no toca el abono:** lo que pagó queda a favor del cliente (opción A del 17-11). Es lo que pasó: pagó S/ 1,000
   por fruta que ya no se llevó. La hoja de anular lo dice antes de confirmar.
6. **El intérprete** suma el campo `pago_parcial` a `registrar_venta`. Si viene, la tarjeta pone la venta al crédito aunque el modelo
   haya dicho otra cosa, y sin medio dicho pone efectivo, a la vista.
7. **La tarjeta** deja «Pagó» y «Lo debe» como siempre. Debajo de «Lo debe» suma «Pagó una parte». Con algo anotado se ve «Pagó
   ahora» (tocable), con qué pagó y «Queda debiendo», y la píldora dice «Debe el resto».

## Alternativas descartadas

- **Una columna `ventas.pagado`.** Cambiaba la cuenta de la deuda y obligaba a tocar cada lugar que suma dinero: la vista de saldos,
  el cierre, la exportación, «Hoy», las consultas por voz. Bastaba olvidar uno para que dos pantallas dijeran cifras distintas.
- **Un tercer estado de venta («parcial»).** Lo mismo, y además un estado más que cuidar en cada pantalla.
- **Anular también el abono (opción B).** Los abonos no se anulan hoy. Habría que crear esa operación con su motivo y su prueba, y es
  otra regla de dinero. Si en el puesto se devuelve la plata en la mano, se decide aparte.

## Consecuencias

- Una venta con pago al llevar aparece en la ficha como dos movimientos: la venta («Lo debe») y el pago («Pagó al llevar, en
  efectivo»). El detalle de la venta los junta: «Pagó S/ 1,000.00 al llevar · debe S/ 4,000.00».
- Con manos libres, una respuesta hablada con monto («pagó quinientos») no se anota como «Pagó»: se repregunta y la parte se anota
  con el dedo. Mandarla al intérprete como corrección queda pendiente.
- Migración `20261117213424_venta_con_pago_al_llevar`, aplicada al proyecto con OK. Su comentario dice «ADR-0023»: se escribió antes de
  fusionar main, donde ese número ya era la hora de cierre. No se edita una migración aplicada, así que la referencia correcta es esta,
  ADR-0025.
