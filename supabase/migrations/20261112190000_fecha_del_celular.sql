-- =============================================================================
-- La fecha de lo que se confirmó sin señal es la del toque, no la del envío (ADR-0019).
--
-- El problema: la cola sin conexión guarda en el celular lo que se confirma sin señal y lo envía cuando vuelve. La fecha
-- se ponía con now() al llegar: una venta de las 11:40 p. m. enviada a las 6 a. m. contaba para el día siguiente, y el
-- cierre de los dos días y el Excel del contador quedaban descuadrados. Es como anotar en el cuaderno el día en que volvió
-- la señal y no el día en que se vendió.
--
-- La solución:
--   1. registrar_venta y registrar_compra aceptan p.fecha (la hora del celular). La venta y sus salidas de stock llevan la
--      misma fecha; igual la compra y sus entradas.
--   2. fecha_del_celular() acepta esa hora solo si es creíble: entre 48 horas atrás y 5 minutos adelante. Si el celular
--      tiene la hora mal (o alguien manda otra a propósito), se usa la del servidor. Nunca se pierde la operación.
--   3. Un trigger aplica la misma regla a todo insert en ventas, compras, abonos, gastos y movimientos_stock, también a los
--      inserts directos (abonos, mermas, gastos), que antes aceptaban cualquier fecha.
--   4. creado_en sigue siendo la hora real del servidor: la auditoría no cambia.
-- =============================================================================

create or replace function fecha_del_celular(p timestamptz)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select case
    when p is not null and p between now() - interval '48 hours' and now() + interval '5 minutes' then p
    else now()
  end;
$$;
comment on function fecha_del_celular(timestamptz) is
  'La hora del celular si es creíble (48 h atrás a 5 min adelante); si no, la del servidor. ADR-0019.';

create or replace function fijar_fecha_del_celular()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.fecha := fecha_del_celular(new.fecha);
  return new;
end;
$$;

create trigger ventas_fecha_creible before insert on ventas for each row execute function fijar_fecha_del_celular();
create trigger compras_fecha_creible before insert on compras for each row execute function fijar_fecha_del_celular();
create trigger abonos_fecha_creible before insert on abonos for each row execute function fijar_fecha_del_celular();
create trigger gastos_fecha_creible before insert on gastos for each row execute function fijar_fecha_del_celular();
create trigger movimientos_fecha_creible before insert on movimientos_stock for each row execute function fijar_fecha_del_celular();

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
       set resultado = case when coalesce((p ->> 'corregido')::boolean, false) then 'corregido' else 'confirmado' end
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
       set resultado = case when coalesce((p ->> 'corregido')::boolean, false) then 'corregido' else 'confirmado' end
     where id = v_voz and resultado = 'pendiente';
  end if;

  return v_id;
end;
$$;

-- Ninguna función propia se ejecuta sin sesión (CLAUDE.md, trampas de RLS). El trigger no se llama directo.
revoke execute on function fecha_del_celular(timestamptz) from public, anon;
revoke execute on function fijar_fecha_del_celular() from public, anon;
revoke execute on function registrar_venta(jsonb) from public, anon;
revoke execute on function registrar_compra(jsonb) from public, anon;
