-- =============================================================================
-- Cómo llegó la fruta (verde, pintón, maduro) queda en la entrada de stock — pruebas pgTAP (npx supabase test db).
-- Corre sobre la base local con supabase/seed.sql cargado: Mango Kent = producto 1, Plátano de seda = producto 3.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a19', 'ayudante19@fructus.test'),
  ('00000000-0000-0000-0000-000000000c19', 'contador19@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-000000000a19', 'Ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-000000000c19', 'Contador', 'contador');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

create temp table compra (n int, id bigint);
grant all on compra to authenticated;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-000000000a19');

insert into comandos_voz (transcripcion, intencion, resultado) values ('llegaron 30 de mango verde y 20 de plátano', 'registrar_compra', 'pendiente');

-- --- El caso feliz: cada ítem deja en su entrada cómo llegó; el que no lo dice, queda sin decir ---
insert into compra select 1, registrar_compra(jsonb_build_object('condicion', 'contado', 'medio_pago', 'efectivo',
  'comando_voz_id', (select id from comandos_voz where transcripcion like 'llegaron 30%'),
  'items', '[{"producto_id":1,"cantidad":30,"costo_unitario":32,"estado_llegada":"verde"},
             {"producto_id":3,"cantidad":20,"costo_unitario":22}]'::jsonb));

select is((select estado_llegada::text from movimientos_stock where compra_id = (select id from compra where n = 1) and producto_id = 1), 'verde', 'el mango queda como llegó: verde');
select is((select estado_llegada::text from movimientos_stock where compra_id = (select id from compra where n = 1) and producto_id = 3), null, 'el plátano, sin decir: no se inventa');
select is((select count(*)::int from movimientos_stock where compra_id = (select id from compra where n = 1)), 2, 'una entrada por ítem');

-- --- El segundo toque devuelve la misma compra y no repite las entradas -------------------------
insert into compra select 2, registrar_compra(jsonb_build_object('condicion', 'contado', 'medio_pago', 'efectivo',
  'comando_voz_id', (select id from comandos_voz where transcripcion like 'llegaron 30%'),
  'items', '[{"producto_id":1,"cantidad":30,"costo_unitario":32,"estado_llegada":"maduro"}]'::jsonb));
select is((select id from compra where n = 2), (select id from compra where n = 1), 'el segundo toque devuelve la misma compra');
select is((select estado_llegada::text from movimientos_stock where compra_id = (select id from compra where n = 1) and producto_id = 1), 'verde', 'y no cambia cómo llegó');

-- --- Borde: una palabra que no es un estado no entra; una cadena vacía es «sin decir» ----------------
select throws_ok(
  $$ select registrar_compra(jsonb_build_object('condicion', 'contado', 'medio_pago', 'efectivo',
       'items', '[{"producto_id":1,"cantidad":1,"costo_unitario":32,"estado_llegada":"podrido"}]'::jsonb)) $$,
  '22P02', null, 'un estado que no existe se rechaza');
select lives_ok(
  $$ select registrar_compra(jsonb_build_object('condicion', 'contado', 'medio_pago', 'efectivo',
       'items', '[{"producto_id":1,"cantidad":1,"costo_unitario":32,"estado_llegada":""}]'::jsonb)) $$,
  'un estado vacío entra como sin decir');

-- --- Borde: solo una entrada «llega»: una merma con estado se rechaza ------------------------------
select throws_ok(
  $$ insert into movimientos_stock (producto_id, tipo, cantidad, motivo, estado_llegada) values (1, 'merma', -1, 'se malogró', 'maduro') $$,
  '23514', null, 'una merma no lleva cómo llegó');

-- --- Contador: solo lee -------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000c19');
select throws_ok(
  $$ select registrar_compra(jsonb_build_object('condicion', 'contado', 'medio_pago', 'efectivo',
       'items', '[{"producto_id":1,"cantidad":1,"costo_unitario":32,"estado_llegada":"verde"}]'::jsonb)) $$,
  '42501', null, 'el contador no registra compras');

select * from finish();
rollback;
