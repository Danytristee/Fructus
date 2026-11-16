-- =============================================================================
-- Queda registrado si la venta se confirmó con un toque o hablando (ADR-0020, candado 7).
--
-- El problema: con manos libres, la venta se confirma diciendo «confirmo» después de oír la lectura. Si alguien cerca dice
-- «correcto» y entra una venta que no era, hay que poder verlo: cuántas ventas entraron por voz, cuántas de ellas se
-- anularon después. Sin el dato, una venta confirmada por voz y una por toque se ven iguales en el cuaderno.
--
-- La solución:
--   1. comandos_voz.confirmado_por: 'toque' o 'voz'. Vacío en lo que no se confirmó (pendiente, descartado, no entendido) y
--      en lo anterior a esta migración, que no se sabe.
--   2. Un check impide el estado imposible: un comando descartado o pendiente que «se confirmó por voz».
--   3. registrar_venta y registrar_compra lo guardan en la misma transacción que la operación, desde p.confirmado_por; sin el
--      dato, 'toque'. Abonos, mermas y gastos se insertan directo y la acción del servidor marca el comando con el dato.
--
-- El dato lo declara el celular: sirve para auditar y medir, no es una prueba. El dinero lo protege lo de siempre: solo el
-- dueño o el administrador anulan (anular_venta).
-- =============================================================================

alter table comandos_voz
  add column confirmado_por text check (confirmado_por in ('toque', 'voz')),
  add constraint comandos_voz_confirmado_por_solo_si_se_confirmo
    check (confirmado_por is null or resultado in ('confirmado', 'corregido'));

comment on column comandos_voz.confirmado_por is
  'Cómo se confirmó: toque (Confirmar) o voz («confirmo» tras oír la lectura, ADR-0020). Vacío si no se confirmó o es anterior al 2026-11-14.';

create or replace function registrar_venta(p jsonb)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_id    bigint;
  v_item  jsonb;
  v_voz   bigint := (p ->> 'comando_voz_id')::bigint;
  v_total numeric(12,2);
  -- La hora del toque (cola sin conexión) o la del servidor; la venta y su stock llevan la misma.
  v_fecha timestamptz := fecha_del_celular((p ->> 'fecha')::timestamptz);
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
    insert into ventas (cliente_id, condicion, medio_pago, total, comando_voz_id, fecha)
    values ((p ->> 'cliente_id')::bigint,
            (p ->> 'condicion')::condicion_pago,
            (p ->> 'medio_pago')::medio_pago,
            v_total,
            v_voz,
            v_fecha)
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

    insert into movimientos_stock (producto_id, tipo, cantidad, venta_id, comando_voz_id, fecha)
    values ((v_item ->> 'producto_id')::bigint,
            'salida_venta',
            -((v_item ->> 'cantidad')::numeric),
            v_id,
            v_voz,
            v_fecha);
  end loop;

  if v_voz is not null then
    update comandos_voz
       set resultado = case when coalesce((p ->> 'corregido')::boolean, false) then 'corregido' else 'confirmado' end,
           -- Cómo se confirmó (ADR-0020). Sin el dato es un toque: así confirmaba todo lo anterior.
           confirmado_por = coalesce(p ->> 'confirmado_por', 'toque')
     where id = v_voz and resultado = 'pendiente';
  end if;

  return v_id;
end;
$$;

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

    insert into movimientos_stock (producto_id, tipo, cantidad, compra_id, comando_voz_id, fecha)
    values ((v_item ->> 'producto_id')::bigint,
            'entrada_compra',
            (v_item ->> 'cantidad')::numeric,
            v_id,
            v_voz,
            v_fecha);
  end loop;

  if v_voz is not null then
    update comandos_voz
       set resultado = case when coalesce((p ->> 'corregido')::boolean, false) then 'corregido' else 'confirmado' end,
           -- Cómo se confirmó (ADR-0020). Sin el dato es un toque: así confirmaba todo lo anterior.
           confirmado_por = coalesce(p ->> 'confirmado_por', 'toque')
     where id = v_voz and resultado = 'pendiente';
  end if;

  return v_id;
end;
$$;

-- create or replace conserva los permisos, pero se repite por si acaso: ninguna función propia se ejecuta sin sesión.
revoke execute on function registrar_venta(jsonb) from public, anon;
revoke execute on function registrar_compra(jsonb) from public, anon;
