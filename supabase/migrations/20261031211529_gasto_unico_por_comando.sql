-- Un gasto dictado se guarda una sola vez, aunque se toque Confirmar dos veces (A6).
--
-- El problema: los gastos se insertan directo en su tabla, sin nada que mire si ese comando de voz ya tenía su gasto.
-- Un doble toque contaba dos veces el mismo pago y el cierre del día salía con menos plata de la que hay.
--
-- Qué cambia: cada comando de voz puede tener un solo gasto (índice único parcial: los gastos a mano no llevan comando).
-- La acción confirmarGasto toma el choque (23505) como «ya estaba guardado».

create unique index gastos_uno_por_comando_voz on gastos (comando_voz_id) where comando_voz_id is not null;
