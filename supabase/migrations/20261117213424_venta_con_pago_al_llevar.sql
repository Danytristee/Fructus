-- =============================================================================
-- Una venta al crédito puede llevar lo que el cliente pagó al llevarse la fruta (ADR-0023).
--
-- El problema: «Vendí 10 cajas de mango a don Lucho y pagó solo 1000» (S/ 5,000 de venta) no tenía cómo guardarse. La venta era
-- contado o crédito, nada en medio: al contado se perdían los S/ 4,000 que debe; al crédito, los S/ 1,000 que dejó. El intérprete
-- entendía la frase, pero no tenía dónde ponerla, y elegir cualquiera de los dos inventa o pierde dinero (principio 2).
--
-- La solución, sin tocar cómo se cuenta la deuda (principio 4: deuda = ventas al crédito − abonos):
--   1. La venta queda AL CRÉDITO por el total, y lo que dejó entra como un ABONO en la misma transacción. La deuda sale sola:
--      5,000 − 1,000 = 4,000. El cierre del día ya cuenta los abonos como cobrado, así que los S/ 1,000 entran a la caja.
--   2. abonos.venta_id ata ese abono a su venta (uno por venta), para mostrarlo como «dejó S/ 1,000 al llevar».
--   3. registrar_venta recibe p.pago_inicial = {"monto": 1000, "medio_pago": "efectivo"} y rechaza lo que no es un pago parcial:
--      en una venta al contado (ya está pagada), igual o mayor que el total (eso es contado) o sin medio de pago.
--   4. Un trigger exige que un abono atado a una venta sea de esa venta: al crédito, del mismo cliente, registrada y menor que
--      su total. El insert directo en abonos (que el ayudante puede hacer) tampoco arma un estado imposible (principio 3).
--
-- El abono del pago al llevar no lleva comando_voz_id: lo lleva la venta, que ya es idempotente por comando (un doble toque
-- devuelve la misma venta sin volver a insertar nada). Así el comando sigue apuntando a una sola operación.
--
-- Lo que NO cambia, a propósito (decisión del 2026-11-17, opción A): anular la venta no toca el abono. Lo que dejó queda a favor
-- del cliente, que es lo que pasó: pagó S/ 1,000 por fruta que ya no se llevó. La hoja de anular lo dice antes de confirmar.
-- =============================================================================

alter table abonos add column venta_id bigint references ventas (id);
comment on column abonos.venta_id is
  'La venta al crédito en la que se pagó este abono al llevarse la fruta («pagó solo 1000»). null: un abono suelto.';

-- Un pago al llevar por venta. También sirve de índice de la llave foránea.
create unique index abonos_uno_por_venta on abonos (venta_id) where venta_id is not null;

-- ¿El abono atado a una venta es de esa venta? Invoker: lee ventas con la RLS de quien registra (todo rol las lee).
create function abono_de_su_venta()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v ventas%rowtype;
begin
  if new.venta_id is null then return new; end if;
  select * into v from ventas where id = new.venta_id;
  if not found then
    raise exception 'La venta % no existe', new.venta_id using errcode = '23503';
  end if;
  if v.condicion <> 'credito' then
    raise exception 'Una venta al contado ya está pagada: no lleva pago al llevar' using errcode = '23514';
  end if;
  if v.cliente_id is distinct from new.cliente_id then
    raise exception 'El pago al llevar es del cliente de la venta' using errcode = '23514';
  end if;
  if new.monto >= v.total then
    raise exception 'Si pagó todo, la venta es al contado' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and v.estado <> 'registrada' then
    raise exception 'La venta % está anulada', new.venta_id using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function abono_de_su_venta() from public, anon;

create trigger abonos_de_su_venta before insert or update of venta_id, cliente_id, monto on abonos
  for each row execute function abono_de_su_venta();

-- registrar_venta: la versión vigente (20261116182112_comando_de_quien_confirma) con el pago al llevar.
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
  -- La hora del toque (cola sin conexión) o la del servidor; la venta, su stock y lo que pagó al llevar llevan la misma.
  v_fecha timestamptz := fecha_del_celular((p ->> 'fecha')::timestamptz);
  -- Lo que pagó al llevarse la fruta en una venta al crédito («pagó solo 1000»). null: no pagó nada al llevar.
  v_pago  jsonb := nullif(p -> 'pago_inicial', 'null'::jsonb);
  v_monto numeric;
begin
  -- Un dictado lo confirma quien lo dictó, o el dueño o el administrador, que gestionan todo. Si no, el update del comando de abajo
  -- no tocaría ninguna fila (RLS: un update sin permiso no falla) y la operación quedaría guardada con su comando «pendiente».
  if v_voz is not null and not exists (
    select 1 from comandos_voz
     where id = v_voz and (registrado_por = (select auth.uid()) or rol_actual() in ('duenio', 'administrador'))
  ) then
    raise exception 'Ese dictado es de otra cuenta' using errcode = '42501';
  end if;

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

  if v_pago is not null then
    v_monto := (v_pago ->> 'monto')::numeric;
    if p ->> 'condicion' is distinct from 'credito' then
      raise exception 'Una venta al contado ya está pagada: no lleva pago al llevar' using errcode = '23514';
    end if;
    if v_monto is null or v_monto <= 0 or v_monto <> round(v_monto, 2) then
      raise exception 'Lo que pagó al llevar va en soles, mayor que cero y con dos decimales como máximo' using errcode = '23514';
    end if;
    if v_pago ->> 'medio_pago' is null then
      raise exception 'Falta decir con qué pagó lo que dejó' using errcode = '23502';
    end if;
  end if;

  -- El mismo comando ya se guardó (segundo toque, o reintento tras una respuesta que no llegó): la misma venta, con lo que pagó.
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

  -- Pagar todo (o más) no es un pago parcial: es una venta al contado, y la tarjeta la manda así.
  if v_pago is not null and v_monto >= v_total then
    raise exception 'Si pagó todo, la venta es al contado' using errcode = '23514';
  end if;

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

  -- Lo que pagó al llevar, como abono de esa venta: la deuda baja sola (ventas al crédito − abonos).
  if v_pago is not null then
    insert into abonos (cliente_id, monto, medio_pago, fecha, nota, venta_id)
    values ((p ->> 'cliente_id')::bigint, v_monto, (v_pago ->> 'medio_pago')::medio_pago, v_fecha, 'al llevar', v_id);
  end if;

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

revoke execute on function registrar_venta(jsonb) from public, anon;
grant execute on function registrar_venta(jsonb) to authenticated;
