-- =============================================================================
-- Cómo se confirmó la venta, toque o voz (ADR-0020) — pruebas pgTAP. No depende del catálogo cargado: crea su fruta y su
-- cliente.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a9', 'ayudante18@fructus.test'),
  ('00000000-0000-0000-0000-0000000000c9', 'contador18@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000a9', 'Ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-0000000000c9', 'Contador', 'contador');
create temp table datos as
with p as (insert into productos (nombre, variedad) values ('Fruta 18', 'Prueba') returning id),
     c as (insert into clientes (nombre) values ('Cliente confirmado 18') returning id)
select (select id from p) as producto, (select id from c) as cliente;
create temp table cmd as
with ins as (
  insert into comandos_voz (transcripcion, registrado_por)
  select t, '00000000-0000-0000-0000-0000000000a9' from unnest(array['por voz', 'por toque', 'raro', 'del contador', 'descartado']) t
  returning id, transcripcion)
select * from ins;
grant select on datos, cmd to authenticated;

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.venta(p_comando text, p_extra jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'cliente_id', (select cliente from datos), 'condicion', 'credito',
    'comando_voz_id', (select id from cmd where transcripcion = p_comando),
    'items', jsonb_build_array(jsonb_build_object('producto_id', (select producto from datos), 'cantidad', 2, 'precio_unitario', 40))) || p_extra;
$$;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000a9');

-- --- Caso feliz: lo que dice el celular queda en el comando, en la misma transacción que la venta ------------
select lives_ok($$ select registrar_venta(pg_temp.venta('por voz', '{"confirmado_por": "voz"}')) $$, 'el ayudante confirma una venta hablando');
select is((select confirmado_por from comandos_voz where id = (select id from cmd where transcripcion = 'por voz')), 'voz', 'queda «voz»');
select is((select resultado from comandos_voz where id = (select id from cmd where transcripcion = 'por voz')), 'confirmado', 'y el comando, confirmado');

select registrar_venta(pg_temp.venta('por toque', '{}'));
select is((select confirmado_por from comandos_voz where id = (select id from cmd where transcripcion = 'por toque')), 'toque', 'sin el dato es un toque, como todo lo anterior');

-- --- Casos borde ----------------------------------------------------------------------------------------------
select throws_ok($$ select registrar_venta(pg_temp.venta('raro', '{"confirmado_por": "grito"}')) $$, '23514', null,
  'otra forma de confirmar no existe: la venta no entra');
select is((select count(*)::int from ventas where comando_voz_id = (select id from cmd where transcripcion = 'raro')), 0, 'y no queda una venta a medias');

reset role;
select throws_ok($$ update comandos_voz set resultado = 'descartado', confirmado_por = 'voz' where id = (select id from cmd where transcripcion = 'descartado') $$,
  '23514', null, 'un comando descartado no puede decir que se confirmó por voz');
set local role authenticated;

-- --- Rechazo por rol: el contador no confirma ventas, ni hablando ---------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000c9');
select throws_ok($$ select registrar_venta(pg_temp.venta('del contador', '{"confirmado_por": "voz"}')) $$, '42501', null,
  'el contador no puede confirmar una venta por voz');

select * from finish();
rollback;
