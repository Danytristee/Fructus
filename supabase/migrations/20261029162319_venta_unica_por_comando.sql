-- Una venta dictada se guarda una sola vez, aunque se toque Confirmar dos veces (A5).
--
-- El problema: registrar_venta no miraba si ese comando de voz ya tenía venta. Un doble toque, o una red lenta que
-- reintenta, guardaba la venta dos veces: dos salidas de stock y dos deudas por una sola venta. Es un estado imposible
-- (principio 3) y se corrige en la base, no con un botón que se desactiva.
--
-- Qué cambia:
--   1. Cada comando de voz puede tener una sola venta (índice único parcial: las ventas a mano no llevan comando).
--   2. registrar_venta es idempotente por comando: si ya hay venta con ese comando, devuelve su id y no guarda nada.
--      Si dos llamadas llegan a la vez, la segunda espera a la primera, choca con el índice y devuelve la misma venta.
--   3. registrar_venta recibe "corregido": true cuando la persona cambió algo de la tarjeta antes de confirmar; el
--      comando queda como 'corregido' en vez de 'confirmado' (sirve para medir la precisión real del intérprete).
-- create or replace conserva los permisos que ya tenía registrar_venta (anon sigue sin poder llamarla).

create unique index ventas_una_por_comando_voz on ventas (comando_voz_id) where comando_voz_id is not null;

create or replace function registrar_venta(p jsonb)
returns bigint
language plpgsql security invoker
set search_path = public
as $$
declare
  v_id    bigint;
  v_item  jsonb;
  v_voz   bigint := (p ->> 'comando_voz_id')::bigint;
  v_total numeric(12,2);
begin
  if jsonb_array_length(coalesce(p -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  -- El mismo comando ya se guardó (segundo toque, o reintento tras una respuesta que no llegó): la misma venta.
  if v_voz is not null then
    select id into v_id from ventas where comando_voz_id = v_voz;
    if found then return v_id; end if;
  end if;

  -- El total se calcula antes de insertar: el ayudante puede insertar ventas
  -- pero no actualizarlas (RLS), así que no hay un "update total" después.
  select sum((i ->> 'cantidad')::numeric * (i ->> 'precio_unitario')::numeric
             - coalesce((i ->> 'descuento')::numeric, 0))
    into v_total
    from jsonb_array_elements(p -> 'items') i;

  begin
    insert into ventas (cliente_id, condicion, medio_pago, total, comando_voz_id)
    values ((p ->> 'cliente_id')::bigint,
            (p ->> 'condicion')::condicion_pago,
            (p ->> 'medio_pago')::medio_pago,
            v_total,
            v_voz)
    returning id into v_id;
  exception when unique_violation then
    -- Otra llamada con el mismo comando ganó por milisegundos: ya está guardada, se devuelve esa.
    select id into v_id from ventas where comando_voz_id = v_voz;
    return v_id;
  end;

  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    insert into venta_items (venta_id, producto_id, cantidad, precio_unitario, descuento)
    values (v_id,
            (v_item ->> 'producto_id')::bigint,
            (v_item ->> 'cantidad')::numeric,
            (v_item ->> 'precio_unitario')::numeric,
            coalesce((v_item ->> 'descuento')::numeric, 0));

    insert into movimientos_stock (producto_id, tipo, cantidad, venta_id, comando_voz_id)
    values ((v_item ->> 'producto_id')::bigint,
            'salida_venta',
            -((v_item ->> 'cantidad')::numeric),
            v_id,
            v_voz);
  end loop;

  if v_voz is not null then
    update comandos_voz
       set resultado = case when coalesce((p ->> 'corregido')::boolean, false) then 'corregido' else 'confirmado' end
     where id = v_voz and resultado = 'pendiente';
  end if;

  return v_id;
end;
$$;
