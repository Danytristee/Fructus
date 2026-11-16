-- =============================================================================
-- Un dictado lo confirma quien lo dictó, o el dueño o el administrador (/chaos 2026-11-16) — pruebas pgTAP.
-- Si un ayudante confirmaba el comando de otra cuenta, la venta entraba pero el comando quedaba «pendiente»: la RLS no le deja
-- actualizar un comando ajeno y el update no falla, solo no toca filas. No depende del catálogo cargado.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'duenio21@fructus.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'ayudante21@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000d1', 'Dueño', 'duenio'),
  ('00000000-0000-0000-0000-0000000000a1', 'Ayudante', 'ayudante');
create temp table datos as
with p as (insert into productos (nombre, variedad) values ('Fruta 21', 'Prueba') returning id),
     c as (insert into clientes (nombre) values ('Cliente 21') returning id),
     v as (insert into proveedores (nombre) values ('Proveedor 21') returning id)
select (select id from p) as producto, (select id from c) as cliente, (select id from v) as proveedor;
create temp table cmd as
with ins as (
  insert into comandos_voz (transcripcion, registrado_por)
  values ('del dueño', '00000000-0000-0000-0000-0000000000d1'),
         ('compra del dueño', '00000000-0000-0000-0000-0000000000d1'),
         ('del ayudante', '00000000-0000-0000-0000-0000000000a1'),
         ('del ayudante 2', '00000000-0000-0000-0000-0000000000a1')
  returning id, transcripcion)
select * from ins;
grant select on datos, cmd to authenticated;

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.venta(p_comando text) returns jsonb language sql as $$
  select jsonb_build_object(
    'cliente_id', (select cliente from datos), 'condicion', 'credito', 'confirmado_por', 'voz',
    'comando_voz_id', (select id from cmd where transcripcion = p_comando),
    'items', jsonb_build_array(jsonb_build_object('producto_id', (select producto from datos), 'cantidad', 2, 'precio_unitario', 40)));
$$;

set local role authenticated;

-- --- Rechazo: el ayudante no confirma el dictado de otra cuenta -------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select registrar_venta(pg_temp.venta('del dueño')) $$, '42501', null, 'el ayudante no confirma una venta dictada por el dueño');
select is((select count(*)::int from ventas where comando_voz_id = (select id from cmd where transcripcion = 'del dueño')), 0, 'y no queda una venta suelta');
select throws_ok($$ select registrar_compra(jsonb_build_object(
    'proveedor_id', (select proveedor from datos), 'condicion', 'credito',
    'comando_voz_id', (select id from cmd where transcripcion = 'compra del dueño'),
    'items', jsonb_build_array(jsonb_build_object('producto_id', (select producto from datos), 'cantidad', 1, 'costo_unitario', 20)))) $$,
  '42501', null, 'tampoco una compra dictada por el dueño');

-- --- Caso feliz: su propio dictado sí, y queda confirmado ----------------------------------------------------------------
select lives_ok($$ select registrar_venta(pg_temp.venta('del ayudante')) $$, 'el ayudante confirma su propio dictado');
select is((select resultado from comandos_voz where id = (select id from cmd where transcripcion = 'del ayudante')), 'confirmado', 'y su comando queda confirmado');

-- --- El dueño gestiona todo: confirma el dictado del ayudante y queda confirmado -----------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000d1');
select lives_ok($$ select registrar_venta(pg_temp.venta('del ayudante 2')) $$, 'el dueño confirma un dictado del ayudante');
select is((select resultado from comandos_voz where id = (select id from cmd where transcripcion = 'del ayudante 2')), 'confirmado', 'y el comando queda confirmado, no pendiente');

-- --- Caso borde: sin comando (a mano) no hay dictado que revisar ---------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select registrar_venta(jsonb_build_object('cliente_id', (select cliente from datos), 'condicion', 'credito',
    'items', jsonb_build_array(jsonb_build_object('producto_id', (select producto from datos), 'cantidad', 1, 'precio_unitario', 40)))) $$,
  'sin comando, el ayudante registra como siempre');

select * from finish();
rollback;
