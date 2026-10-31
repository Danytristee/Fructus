-- Una merma dictada se guarda una sola vez, aunque se toque Confirmar dos veces (A6).
--
-- El problema: la merma se inserta directo en movimientos_stock (una sola tabla), sin nada que mire si ese comando de
-- voz ya tenía su merma. Un doble toque sacaba del stock el doble de cajas: el stock dejaba de ser la verdad (principio 4).
--
-- Qué cambia: cada comando de voz puede tener una sola fila de merma. El índice es parcial por tipo porque una venta
-- dictada deja una fila de salida por cada fruta con el mismo comando, y esas sí son varias. La acción confirmarMerma
-- toma el choque (23505) como «ya estaba guardada».
--
-- Lo que NO cambia, a propósito: una merma puede dejar el stock en negativo. Se permite y se avisa en la tarjeta
-- (decisión del 28-10, docs/bitacora/2026-10-28-andamiaje.md): el conteo inicial del stock llega en A8.

create unique index movimientos_una_merma_por_comando_voz on movimientos_stock (comando_voz_id)
  where tipo = 'merma' and comando_voz_id is not null;
