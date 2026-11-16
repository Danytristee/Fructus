-- =============================================================================
-- Cómo llegó la fruta: verde, pintón o maduro (aviso de frescura, actividad 3).
--
-- El problema: el aviso de «tiene que salir hoy» cuenta los días y el calor desde que la caja llegó, pero no sabe en qué
-- punto llegó. Un mango que llega verde aguanta más de una semana; uno que llega maduro, dos o tres días. Con la misma
-- cuenta para los dos, al maduro se le avisa tarde y al verde, antes de tiempo. Es como calcular cuánto falta para llegar
-- sin saber desde qué paradero se subió el pasajero.
--
-- La solución: la entrada de stock, que es la llegada, guarda cómo llegó la fruta si se dijo («llegaron 30 de mango, verde»).
--   1. Es opcional: si no se dijo, queda null y la app cuenta como pintón. No es dinero ni stock: no se exige.
--   2. Solo vale en entradas (cantidad mayor que cero): una venta o una merma no «llegan».
--   3. registrar_compra recibe `estado_llegada` en cada ítem y lo deja en la entrada de stock de ese ítem. Lo demás de la
--      función no cambia (misma idempotencia por comando, misma fecha del celular).
-- =============================================================================

create type estado_llegada as enum ('verde', 'pinton', 'maduro');

alter table movimientos_stock add column estado_llegada estado_llegada;
alter table movimientos_stock add constraint movimientos_estado_solo_en_entradas check (estado_llegada is null or cantidad > 0);
comment on column movimientos_stock.estado_llegada is 'Cómo llegó la fruta de esa entrada: verde, pintón o maduro. null si no se dijo.';

create or replace function registrar_compra(p jsonb)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_id    bigint;
  v_item  jsonb;
  v_voz   bigint := (p ->> 'comando_voz_id')::bigint;
  v_total numeric(12,2);
  -- La hora del toque (cola sin conexión) o la del servidor; la compra y su stock llevan la misma.
  v_fecha timestamptz := fecha_del_celular((p ->> 'fecha')::timestamptz);
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
    insert into compras (proveedor_id, condicion, medio_pago, total, numero_comprobante, comando_voz_id, fecha)
    values ((p ->> 'proveedor_id')::bigint,
            (p ->> 'condicion')::condicion_pago,
            (p ->> 'medio_pago')::medio_pago,
            v_total,
            p ->> 'numero_comprobante',
            v_voz,
            v_fecha)
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

    -- Cómo llegó esa fruta (verde, pintón, maduro), si se dijo: va en la entrada de stock, que es la llegada.
    insert into movimientos_stock (producto_id, tipo, cantidad, compra_id, comando_voz_id, fecha, estado_llegada)
    values ((v_item ->> 'producto_id')::bigint,
            'entrada_compra',
            (v_item ->> 'cantidad')::numeric,
            v_id,
            v_voz,
            v_fecha,
            nullif(v_item ->> 'estado_llegada', '')::estado_llegada);
  end loop;

  if v_voz is not null then
    update comandos_voz
       set resultado = case when coalesce((p ->> 'corregido')::boolean, false) then 'corregido' else 'confirmado' end
     where id = v_voz and resultado = 'pendiente';
  end if;

  return v_id;
end;
$$;

-- Ninguna función propia se ejecuta sin sesión (CLAUDE.md, trampas de RLS).
revoke execute on function registrar_compra(jsonb) from public, anon;
