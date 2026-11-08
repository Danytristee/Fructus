-- Emitir un comprobante (A9): el número se reserva en la base, de a uno por venta, antes de hablar con el proveedor.
--
-- El problema: emitir una boleta o una factura son tres pasos (tomar el número, guardar el comprobante, enviarlo). Hecho
-- desde el servidor en pasos sueltos, un doble toque o dos personas a la vez podían tomar dos números para la misma venta, y
-- un número tomado sin guardar el comprobante deja un hueco en la serie. SUNAT mira los correlativos: «nunca se emite dos
-- veces el mismo número» y no se pierden números (CLAUDE.md, «Comprobantes»). Además, anular una venta cuyo comprobante estaba
-- «pendiente» (enviado pero sin respuesta) podía dejarla anulada y con un comprobante aceptado después (INV-09).
--
-- Qué cambia:
--   1. Un índice único: una venta tiene a lo más un comprobante vigente (pendiente, enviado o aceptado). Es INV-08, ahora
--      imposible de romper y no solo revisable.
--   2. reservar_comprobante(venta, tipo): en una sola transacción bloquea la venta, devuelve el comprobante vigente si ya hay
--      uno (sin gastar otro número), y si no, toma el siguiente número de la serie y guarda el comprobante «pendiente». Si algo
--      falla a medias, todo se deshace y el número no se gasta. La hacen cumplir aquí, y no solo la pantalla:
--        - la factura es de un cliente con RUC (INV-11);
--        - la boleta de más de S/ 700 lleva el documento del cliente (regla de SUNAT para boletas);
--        - una venta anulada no recibe comprobante.
--      Solo la ejecuta el servidor (service role): ningún usuario puede reservar números por su cuenta.
--   3. anular_venta ya no deja anular una venta con un comprobante «pendiente» (podría quedar aceptado después), y bloquea la
--      venta antes de mirar, para que anular y reservar a la vez se pongan en fila.
--
-- Lo que NO cambia: quién puede anular, que una venta con comprobante enviado o aceptado pide nota de crédito, la devolución
-- del stock y que todo es una sola transacción. La política de lectura de comprobantes (cualquier perfil activo) ya existía.

create unique index comprobantes_una_vigente_por_venta
  on comprobantes (venta_id)
  where estado in ('pendiente', 'enviado', 'aceptado');

create or replace function reservar_comprobante(p_venta_id bigint, p_tipo text)
returns jsonb
language plpgsql security invoker
set search_path = public
as $$
declare
  v_venta   ventas%rowtype;
  v_cliente clientes%rowtype;
  v_c       comprobantes%rowtype;
  v_serie   text;
begin
  if p_tipo is null or p_tipo not in ('01', '03') then
    raise exception 'Tipo de comprobante no válido: 01 es factura y 03 es boleta' using errcode = '22023';
  end if;

  -- Una venta a la vez: dos pedidos sobre la misma venta se ponen en fila, y el segundo ve lo que dejó el primero.
  select * into v_venta from ventas where id = p_venta_id for update;
  if not found then
    raise exception 'La venta % no existe', p_venta_id using errcode = 'P0002';
  end if;
  if v_venta.estado <> 'registrada' then
    raise exception 'La venta % está anulada: no se le emite comprobante', p_venta_id using errcode = '22023';
  end if;

  -- Ya tiene uno vigente: ese es. No se toma otro número.
  select * into v_c from comprobantes
   where venta_id = p_venta_id and estado in ('pendiente', 'enviado', 'aceptado');
  if found then
    return jsonb_build_object('id', v_c.id, 'tipo', v_c.tipo, 'serie', v_c.serie, 'numero', v_c.numero,
                              'estado', v_c.estado, 'pdf_url', v_c.pdf_url, 'nuevo', false);
  end if;

  if v_venta.cliente_id is not null then
    select * into v_cliente from clientes where id = v_venta.cliente_id;
  end if;

  if p_tipo = '01' and v_cliente.tipo_documento is distinct from 'RUC' then
    raise exception 'Una factura va a un cliente con RUC' using errcode = '23514';
  end if;
  -- SUNAT: la boleta de más de S/ 700 identifica al comprador. Con DNI o con RUC del cliente alcanza.
  if p_tipo = '03' and v_venta.total > 700 and v_cliente.numero_documento is null then
    raise exception 'Una boleta de más de S/ 700 lleva el DNI del cliente' using errcode = '23514';
  end if;

  select s.serie into v_serie from series_comprobante s where s.tipo = p_tipo order by s.serie limit 1;
  if v_serie is null then
    raise exception 'No hay una serie para el tipo %', p_tipo using errcode = 'P0002';
  end if;

  -- El número y el comprobante nacen juntos: si el insert falla, el número no se gasta.
  insert into comprobantes (venta_id, tipo, serie, numero)
  values (p_venta_id, p_tipo, v_serie, tomar_numero(v_serie))
  returning * into v_c;

  return jsonb_build_object('id', v_c.id, 'tipo', v_c.tipo, 'serie', v_c.serie, 'numero', v_c.numero,
                            'estado', v_c.estado, 'pdf_url', v_c.pdf_url, 'nuevo', true);
end;
$$;

-- Ninguna función propia se ejecuta sin sesión (05_funciones_sin_anon.test.sql), y esta solo la corre el servidor: Supabase da
-- EXECUTE a anon y authenticated en toda función nueva, y Postgres a public.
revoke execute on function reservar_comprobante(bigint, text) from public, anon, authenticated;
grant execute on function reservar_comprobante(bigint, text) to service_role;

-- Anular una venta y devolver su stock. No se puede si ya tiene comprobante enviado o aceptado (corresponde una nota de crédito),
-- ni si lo tiene pendiente: pudo haberse enviado y quedar aceptado después de anular. El motivo es obligatorio.
create or replace function anular_venta(p_venta_id bigint, p_motivo text)
returns void
language plpgsql security invoker
set search_path = public
as $$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  -- Con RLS, un update sin permiso no falla: simplemente no toca filas.
  -- Por eso se verifica el rol explícitamente.
  if rol_actual() is distinct from 'duenio' and rol_actual() is distinct from 'administrador' then
    raise exception 'Solo el dueño o el administrador pueden anular ventas';
  end if;

  if length(v_motivo) < 3 then
    raise exception 'Anular una venta pide el motivo' using errcode = '23514';
  end if;
  if length(v_motivo) > 200 then
    raise exception 'El motivo no puede pasar de 200 letras' using errcode = '23514';
  end if;

  -- Misma fila, mismo orden que reservar_comprobante: anular y emitir a la vez se ponen en fila.
  perform 1 from ventas where id = p_venta_id for update;

  if exists (
    select 1 from comprobantes
    where venta_id = p_venta_id and estado in ('enviado', 'aceptado')
  ) then
    raise exception 'La venta % ya tiene comprobante en SUNAT: usar nota de crédito', p_venta_id;
  end if;
  if exists (
    select 1 from comprobantes
    where venta_id = p_venta_id and estado = 'pendiente'
  ) then
    raise exception 'La venta % tiene un comprobante en proceso: espera a que termine', p_venta_id;
  end if;

  update ventas
     set estado = 'anulada', anulada_en = now(), anulada_por = auth.uid(), motivo_anulacion = v_motivo
   where id = p_venta_id and estado = 'registrada';

  if not found then
    raise exception 'La venta % no existe o ya estaba anulada', p_venta_id;
  end if;

  insert into movimientos_stock (producto_id, tipo, cantidad, venta_id, motivo)
  select producto_id, 'devolucion', cantidad, p_venta_id, 'anulación de venta'
  from venta_items
  where venta_id = p_venta_id;
end;
$$;
