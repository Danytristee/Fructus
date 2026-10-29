-- =============================================================================
-- Una venta dictada se guarda una sola vez — pruebas pgTAP (npx supabase test db).
-- Corre sobre la base local con supabase/seed.sql cargado: Mango Kent = producto 1, Luis Paredes = cliente 1.
-- La carrera real de dos toques a la vez la cubre el índice único; aquí se prueba la segunda llamada y el choque.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a2', 'ayudante2@fructus.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'contador2@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000a2', 'Ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-0000000000c2', 'Contador', 'contador');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

create temp table inicio as
select (select count(*) from ventas)                                         as ventas,
       coalesce((select stock from v_stock where producto_id = 1), 0)        as stock_mango,
       coalesce((select saldo from v_saldo_clientes where cliente_id = 1), 0) as deuda_lucho;
create temp table venta (n int, id bigint);
grant select on inicio to authenticated;
grant all on venta to authenticated;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');

-- Dos comandos dictados por el ayudante, esperando su tarjeta.
insert into comandos_voz (transcripcion, intencion, resultado) values
  ('dos de mango a don lucho a 45 lo debe', 'registrar_venta', 'pendiente'),
  ('una de mango al contado', 'registrar_venta', 'pendiente');

-- --- Confirmar dos veces el mismo comando ------------------------------------------
insert into venta select 1, registrar_venta(jsonb_build_object('cliente_id', 1, 'condicion', 'credito',
  'comando_voz_id', (select min(id) from comandos_voz where transcripcion like 'dos de mango%'),
  'items', '[{"producto_id":1,"cantidad":2,"precio_unitario":45}]'::jsonb));
insert into venta select 2, registrar_venta(jsonb_build_object('cliente_id', 1, 'condicion', 'credito',
  'comando_voz_id', (select min(id) from comandos_voz where transcripcion like 'dos de mango%'),
  'items', '[{"producto_id":1,"cantidad":2,"precio_unitario":45}]'::jsonb));

select is((select id from venta where n = 2), (select id from venta where n = 1), 'el segundo toque devuelve la misma venta');
select is((select count(*) from ventas), (select ventas + 1 from inicio), 'se guardó una sola venta');
select is((select stock from v_stock where producto_id = 1), (select stock_mango - 2 from inicio), 'el stock baja 2 cajas, no 4');
select is((select saldo from v_saldo_clientes where cliente_id = 1), (select deuda_lucho + 90 from inicio), 'don Lucho debe 90 más, no 180');
select is((select resultado from comandos_voz where transcripcion like 'dos de mango%'), 'confirmado', 'sin cambios, el comando queda confirmado');

-- --- Corregido: la persona cambió algo de la tarjeta -------------------------------------
select lives_ok($$ select registrar_venta(jsonb_build_object('condicion', 'contado', 'medio_pago', 'yape', 'corregido', true,
  'comando_voz_id', (select id from comandos_voz where transcripcion like 'una de mango%'),
  'items', '[{"producto_id":1,"cantidad":1,"precio_unitario":47}]'::jsonb)) $$, 'una venta corregida se guarda');
select is((select resultado from comandos_voz where transcripcion like 'una de mango%'), 'corregido', 'el comando queda como corregido');

-- --- El índice no deja dos ventas con el mismo comando, ni por fuera de la función -------
reset role;
select throws_ok(
  $$ insert into ventas (cliente_id, condicion, total, comando_voz_id, registrado_por)
     values (1, 'credito', 10, (select min(id) from comandos_voz where transcripcion like 'dos de mango%'), '00000000-0000-0000-0000-0000000000a2') $$,
  '23505', null, 'la base rechaza una segunda venta con el mismo comando');
select lives_ok(
  $$ insert into ventas (cliente_id, condicion, total, registrado_por) values (1, 'credito', 10, '00000000-0000-0000-0000-0000000000a2') $$,
  'las ventas sin comando de voz no chocan entre sí');

-- --- Contador: no registra, ni siquiera repitiendo un comando ------------------------------
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000c2');
select throws_ok($$ select registrar_venta('{"condicion":"contado","medio_pago":"efectivo","items":[{"producto_id":1,"cantidad":1,"precio_unitario":45}]}') $$,
  '42501', null, 'el contador no puede registrar ventas');

select * from finish();
rollback;
