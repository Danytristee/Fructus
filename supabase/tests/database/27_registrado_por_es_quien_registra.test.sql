-- =============================================================================
-- La firma de cada registro (registrado_por) es la de quien está conectado, y no cambia después — pruebas pgTAP.
-- La columna nace con default auth.uid(), pero el default solo aplica si el pedido no la trae: un ayudante podía guardar un
-- abono «registrado por» el dueño. Ahora se rechaza (42501). Sin sesión (semilla, pruebas, servidor) se respeta lo que venga.
-- No depende del catálogo.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d3', 'duenio27@fructus.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'ayudante27@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000d3', 'Dueño', 'duenio'),
  ('00000000-0000-0000-0000-0000000000a3', 'Ayudante', 'ayudante');
create temp table datos as
with p as (insert into productos (nombre, variedad) values ('Fruta 27', 'Prueba') returning id),
     c as (insert into clientes (nombre) values ('Cliente 27') returning id),
     v as (insert into proveedores (nombre) values ('Proveedor 27') returning id)
select (select id from p) as producto, (select id from c) as cliente, (select id from v) as proveedor;
insert into comandos_voz (transcripcion, registrado_por) values ('del dueño 27', '00000000-0000-0000-0000-0000000000d3');
grant select on datos to authenticated;

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- --- Toda tabla que firma lleva el candado ---------------------------------------------------------------------------------
select is(
  (select array_agg(c.table_name::text order by c.table_name)
     from information_schema.columns c
     join information_schema.tables t using (table_schema, table_name)
    where c.table_schema = 'public' and c.column_name = 'registrado_por' and t.table_type = 'BASE TABLE'
      and not exists (select 1 from pg_trigger g
                       where g.tgrelid = format('public.%I', c.table_name)::regclass
                         and g.tgfoid in (select oid from pg_proc where proname = 'fijar_registrado_por'))),
  null,
  'toda tabla con registrado_por tiene el trigger que fija la firma');

-- --- Sin sesión (semilla, pruebas con la clave del servidor), se respeta la firma que viene -------------------------------
insert into gastos (categoria, monto, descripcion, registrado_por)
values ('otros', 5, 'semilla 27', '00000000-0000-0000-0000-0000000000d3');
select is((select registrado_por from gastos where descripcion = 'semilla 27'), '00000000-0000-0000-0000-0000000000d3'::uuid,
  'sin sesión, la firma que trae el pedido se respeta');

set local role authenticated;

-- --- Rechazo: el ayudante no firma a nombre del dueño, en ninguna tabla ------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$ insert into abonos (cliente_id, monto, medio_pago, nota, registrado_por)
                    values ((select cliente from datos), 10, 'efectivo', 'abono 27', '00000000-0000-0000-0000-0000000000d3') $$,
  '42501', null, 'un abono firmado como el dueño');
select throws_ok($$ insert into gastos (categoria, monto, descripcion, registrado_por)
                    values ('flete', 12, 'gasto 27', '00000000-0000-0000-0000-0000000000d3') $$,
  '42501', null, 'un gasto');
select throws_ok($$ insert into movimientos_stock (producto_id, tipo, cantidad, motivo, registrado_por)
                    values ((select producto from datos), 'merma', -1, 'merma 27', '00000000-0000-0000-0000-0000000000d3') $$,
  '42501', null, 'una merma');
select throws_ok($$ insert into comandos_voz (transcripcion, registrado_por) values ('comando 27', '00000000-0000-0000-0000-0000000000d3') $$,
  '42501', null, 'un dictado');
select throws_ok($$ insert into pagos_proveedor (proveedor_id, monto, medio_pago, nota, registrado_por)
                    values ((select proveedor from datos), 30, 'efectivo', 'pago 27', '00000000-0000-0000-0000-0000000000d3') $$,
  '42501', null, 'un pago a proveedor');
reset role;
select is((select count(*)::int from abonos where nota = 'abono 27'), 0, 'y no queda nada guardado');

-- --- Caso feliz: por las RPC, la firma es la de quien confirma ----------------------------------------------------------------
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000a3');
create temp table venta27 as
select registrar_venta(jsonb_build_object('cliente_id', (select cliente from datos), 'condicion', 'credito',
  'items', jsonb_build_array(jsonb_build_object('producto_id', (select producto from datos), 'cantidad', 1, 'precio_unitario', 40)))) as id;
reset role;
select is((select registrado_por from ventas where id = (select id from venta27)), '00000000-0000-0000-0000-0000000000a3'::uuid,
  'la venta que registra el ayudante queda firmada por él');
select is((select count(*)::int from movimientos_stock where venta_id = (select id from venta27)
            and registrado_por = '00000000-0000-0000-0000-0000000000a3'), 1, 'y su salida de stock también');

-- --- La firma no cambia después: ni el dueño, que puede editar todo, la reescribe ---------------------------------------------
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000d3');
select throws_ok($$ update ventas set registrado_por = '00000000-0000-0000-0000-0000000000d3' where id = (select id from venta27) $$,
  '42501', null, 'el dueño no reescribe quién registró una venta');
select lives_ok($$ update comandos_voz set resultado = 'descartado' where transcripcion = 'del dueño 27' $$,
  'pero actualizar otra cosa de un registro sigue andando');
reset role;
select is((select registrado_por from ventas where id = (select id from venta27)), '00000000-0000-0000-0000-0000000000a3'::uuid,
  'y la firma sigue siendo la del ayudante');

-- --- Caso borde: sin decir la firma, el default de siempre ------------------------------------------------------------------
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000d3');
insert into gastos (categoria, monto, descripcion) values ('otros', 3, 'sin firma 27');
reset role;
select is((select registrado_por from gastos where descripcion = 'sin firma 27'), '00000000-0000-0000-0000-0000000000d3'::uuid,
  'sin decir la firma, queda la de quien está conectado');

select * from finish();
rollback;
