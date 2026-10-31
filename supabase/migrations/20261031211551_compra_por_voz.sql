-- Una compra dictada se guarda una sola vez y nunca se asume contado (A6, decisión del 31-10).
--
-- El problema:
--   1. registrar_compra guardaba «contado» cuando no se decía si se pagó (coalesce(condicion, 'contado')). Eso choca con
--      el principio 2: una compra al crédito anotada como contado infla el egreso del día y esconde una deuda con el
--      proveedor.
--   2. No miraba si ese comando de voz ya tenía compra: un doble toque metía el doble de cajas al stock.
--   3. Nada impedía una compra al crédito sin proveedor: una deuda con nadie es un estado imposible (principio 3).
--
-- Qué cambia:
--   1. registrar_compra rechaza la compra sin condición. La tarjeta de voz pregunta «¿La pagaste o la debes?» antes.
--   2. Cada comando de voz puede tener una sola compra (índice único parcial), y registrar_compra es idempotente por
--      comando, igual que registrar_venta (20261029162319): si dos llamadas llegan a la vez, la segunda devuelve la misma.
--   3. Una compra al crédito exige proveedor, como la venta al crédito exige cliente.
--   4. registrar_compra recibe "corregido": el comando queda como 'corregido' si la persona cambió algo de la tarjeta.
-- Las compras del seed y de scripts/demo ya dicen su condición y su proveedor.
-- create or replace conserva los permisos de registrar_compra (anon sigue sin poder llamarla).

create unique index compras_una_por_comando_voz on compras (comando_voz_id) where comando_voz_id is not null;

alter table compras add constraint compra_credito_requiere_proveedor check (condicion = 'contado' or proveedor_id is not null);

create or replace function registrar_compra(p jsonb)
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
    raise exception 'La compra no tiene productos';
  end if;

  -- Nunca se asume contado (principio 2): si no se dijo si se pagó, la tarjeta pregunta antes de llegar aquí.
  if p ->> 'condicion' is null then
    raise exception 'Falta decir si la compra se pagó o se debe' using errcode = '23502';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p -> 'items') i
     where (i ->> 'cantidad')::numeric <> round((i ->> 'cantidad')::numeric, 2)
        or (i ->> 'costo_unitario')::numeric <> round((i ->> 'costo_unitario')::numeric, 2)
  ) then
    raise exception 'Los montos y las cajas van con dos decimales como máximo';
  end if;

  -- El mismo comando ya se guardó (segundo toque, o reintento tras una respuesta que no llegó): la misma compra.
  if v_voz is not null then
    select id into v_id from compras where comando_voz_id = v_voz;
    if found then return v_id; end if;
  end if;

  select sum(round((i ->> 'cantidad')::numeric * (i ->> 'costo_unitario')::numeric, 2))
    into v_total
    from jsonb_array_elements(p -> 'items') i;

  begin
    insert into compras (proveedor_id, condicion, medio_pago, total, numero_comprobante, comando_voz_id)
    values ((p ->> 'proveedor_id')::bigint,
            (p ->> 'condicion')::condicion_pago,
            (p ->> 'medio_pago')::medio_pago,
            v_total,
            p ->> 'numero_comprobante',
            v_voz)
    returning id into v_id;
  exception when unique_violation then
    -- Otra llamada con el mismo comando ganó por milisegundos: ya está guardada, se devuelve esa.
    select id into v_id from compras where comando_voz_id = v_voz;
    return v_id;
  end;

  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    insert into compra_items (compra_id, producto_id, cantidad, costo_unitario)
    values (v_id,
            (v_item ->> 'producto_id')::bigint,
            (v_item ->> 'cantidad')::numeric,
            (v_item ->> 'costo_unitario')::numeric);

    insert into movimientos_stock (producto_id, tipo, cantidad, compra_id, comando_voz_id)
    values ((v_item ->> 'producto_id')::bigint,
            'entrada_compra',
            (v_item ->> 'cantidad')::numeric,
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
