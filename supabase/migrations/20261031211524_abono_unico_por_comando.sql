-- Un abono dictado se guarda una sola vez, aunque se toque Confirmar dos veces (A6).
--
-- El problema: los abonos se insertan directo en su tabla (una sola tabla, CLAUDE.md «Reglas de capas»), sin nada que
-- mire si ese comando de voz ya tenía abono. Un doble toque, o una red lenta que reintenta, guardaba el abono dos veces y
-- bajaba la deuda el doble. Es un estado imposible (principio 3): se corrige en la base, no con un botón que se desactiva.
--
-- Qué cambia: cada comando de voz puede tener un solo abono (índice único parcial: los abonos a mano no llevan comando).
-- La acción confirmarAbono toma el choque (23505) como «ya estaba guardado» y responde lo mismo que la primera vez.
--
-- Lo que NO cambia, a propósito: un abono puede ser mayor que la deuda. El cliente queda con saldo a favor, y la tarjeta
-- lo dice en grande antes de Confirmar («le quedan S/ 70 a favor»), para que un error de oído salte a la vista
-- (decisión del 31-10, docs/bitacora/2026-10-31-voz-operaciones.md).

create unique index abonos_uno_por_comando_voz on abonos (comando_voz_id) where comando_voz_id is not null;
