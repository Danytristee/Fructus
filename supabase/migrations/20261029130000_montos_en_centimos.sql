-- Los montos van en céntimos: el total de una venta o compra es siempre la suma de lo que guardan sus ítems (INV-01, INV-05).
--
-- El problema (/chaos 2026-10-29): las columnas de ítems son numeric(10,2) y redondean al guardar, pero registrar_venta y
-- registrar_compra sumaban el total con los números tal como llegaban. «1,299» llegaba como 1.299: el ítem guardaba 1.30
-- (subtotal 13.00) y la venta 12.99. Y media caja a 47.33 da 118.325: el ítem guarda 118.33 y el total sumaba sin redondear.
--
-- Qué cambia, en las dos funciones:
--   1. Cajas, precios, costos y rebajas con más de dos decimales se rechazan. No se redondean a escondidas: el dinero
--      que no se dijo no se inventa (principio 2); la tarjeta de voz tampoco deja escribirlos.
--   2. El total se suma ítem por ítem, redondeado igual que la columna subtotal: total = Σ round(cajas × precio − rebaja, 2).
-- registrar_venta conserva lo de 20261029120000 (una venta por comando de voz, «corregido»).
-- create or replace conserva los permisos de cada función (anon sigue sin poder llamarlas).

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

  if exists (
    select 1 from jsonb_array_elements(p -> 'items') i
     where (i ->> 'cantidad')::numeric <> round((i ->> 'cantidad')::numeric, 2)
        or (i ->> 'precio_unitario')::numeric <> round((i ->> 'precio_unitario')::numeric, 2)
        or coalesce((i ->> 'descuento')::numeric, 0) <> round(coalesce((i ->> 'descuento')::numeric, 0), 2)
  ) then
    raise exception 'Los montos y las cajas van con dos decimales como máximo';
  end if;

  -- El mismo comando ya se guardó (segundo toque, o reintento tras una respuesta que no llegó): la misma venta.
  if v_voz is not null then
    select id into v_id from ventas where comando_voz_id = v_voz;
    if found then return v_id; end if;
  end if;

  -- El total se calcula antes de insertar: el ayudante puede insertar ventas
  -- pero no actualizarlas (RLS), así que no hay un "update total" después.
  select sum(round((i ->> 'cantidad')::numeric * (i ->> 'precio_unitario')::numeric
                   - coalesce((i ->> 'descuento')::numeric, 0), 2))
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

  if exists (
    select 1 from jsonb_array_elements(p -> 'items') i
     where (i ->> 'cantidad')::numeric <> round((i ->> 'cantidad')::numeric, 2)
        or (i ->> 'costo_unitario')::numeric <> round((i ->> 'costo_unitario')::numeric, 2)
  ) then
    raise exception 'Los montos y las cajas van con dos decimales como máximo';
  end if;

  select sum(round((i ->> 'cantidad')::numeric * (i ->> 'costo_unitario')::numeric, 2))
    into v_total
    from jsonb_array_elements(p -> 'items') i;

  insert into compras (proveedor_id, condicion, medio_pago, total, numero_comprobante, comando_voz_id)
  values ((p ->> 'proveedor_id')::bigint,
          coalesce((p ->> 'condicion')::condicion_pago, 'contado'),
          (p ->> 'medio_pago')::medio_pago,
          v_total,
          p ->> 'numero_comprobante',
          v_voz)
  returning id into v_id;

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
    update comandos_voz set resultado = 'confirmado' where id = v_voz and resultado = 'pendiente';
  end if;

  return v_id;
end;
$$;
