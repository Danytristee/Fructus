-- =============================================================================
-- Cada merma, con las cajas que había de esa fruta justo antes (aviso de frescura, actividad 5; ADR-0021).
--
-- El problema: para que la estimación de vida útil se corrija sola, una merma tiene que decir QUÉ llegada se malogró. La
-- merma solo guarda la fruta y cuántas cajas; no dice de cuál compra eran. Lo primero que entra es lo primero que se
-- malogra: eran de la llegada más vieja que había en el puesto en ese momento, y para saber cuál era hace falta el stock
-- de ese instante, no el de hoy.
--
-- La solución: una vista de solo lectura que, por cada merma, suma los movimientos anteriores de esa fruta. Con eso y las
-- entradas, la regla (lib/vida-estimada-reglas.ts) reparte ese stock entre sus llegadas y fecha la más vieja.
-- Mal hecho sería leer todos los movimientos del mes desde el servidor para sumar ahí: son miles de filas y Supabase corta
-- en 1000. No guarda nada ni cambia ninguna regla de stock: el stock sigue siendo la suma de movimientos_stock.
-- =============================================================================

create view v_mermas_con_stock with (security_invoker = true) as
select
  m.id,
  m.producto_id,
  m.fecha,
  -m.cantidad as cajas,
  (
    select coalesce(sum(x.cantidad), 0)
    from movimientos_stock x
    where x.producto_id = m.producto_id
      and (x.fecha < m.fecha or (x.fecha = m.fecha and x.id < m.id))
  ) as stock_antes
from movimientos_stock m
where m.tipo = 'merma';
comment on view v_mermas_con_stock is 'Cada merma con las cajas que había de esa fruta justo antes: para saber qué llegada se malogró.';

-- Es solo para leer: una vista así de simple se podría usar para editar la tabla de abajo. No abre nada que la tabla no
-- permita ya (corre con los permisos de quien pregunta), pero se cierra igual para que «solo lectura» sea literal.
revoke insert, update, delete, truncate on v_mermas_con_stock from authenticated, anon;
