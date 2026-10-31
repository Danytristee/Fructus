-- =============================================================================
-- Una compra dictada se guarda una sola vez y nunca se asume contado — pruebas pgTAP (npx supabase test db).
-- Corre sobre la base local con supabase/seed.sql cargado: Mango Kent = producto 1, Agrícola Chao = proveedor 2.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a9', 'ayudante9@fructus.test'),
  ('00000000-0000-0000-0000-0000000000c9', 'contador9@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000a9', 'Ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-0000000000c9', 'Contador', 'contador');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

create temp table inicio as
select (select count(*) from compras) as compras, coalesce((select stock from v_stock where producto_id = 1), 0) as stock_mango;
create temp table compra (n int, id bigint);
grant select on inicio to authenticated;
grant all on compra to authenticated;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000a9');

insert into comandos_voz (transcripcion, intencion, resultado) values
  ('el de chao me trajo 10 de mango a 30 se lo debo', 'registrar_compra', 'pendiente'),
  ('compré 2 de mango a 28', 'registrar_compra', 'pendiente');

-- --- Nunca se asume contado ----------------------------------------------------------------
select throws_ok(
  $$ select registrar_compra(jsonb_build_object('proveedor_id', 2,
       'comando_voz_id', (select id from comandos_voz where transcripcion like 'compré 2%'),
       'items', '[{"producto_id":1,"cantidad":2,"costo_unitario":28}]'::jsonb)) $$,
  '23502', 'Falta decir si la compra se pagó o se debe', 'una compra sin condición se rechaza');

-- --- Confirmar dos veces el mismo comando ------------------------------------------------------
insert into compra select 1, registrar_compra(jsonb_build_object('proveedor_id', 2, 'condicion', 'credito',
  'comando_voz_id', (select id from comandos_voz where transcripcion like 'el de chao%'),
  'items', '[{"producto_id":1,"cantidad":10,"costo_unitario":30}]'::jsonb));
insert into compra select 2, registrar_compra(jsonb_build_object('proveedor_id', 2, 'condicion', 'credito',
  'comando_voz_id', (select id from comandos_voz where transcripcion like 'el de chao%'),
  'items', '[{"producto_id":1,"cantidad":10,"costo_unitario":30}]'::jsonb));

select is((select id from compra where n = 2), (select id from compra where n = 1), 'el segundo toque devuelve la misma compra');
select is((select count(*) from compras), (select compras + 1 from inicio), 'se guardó una sola compra');
select is((select stock from v_stock where producto_id = 1), (select stock_mango + 10 from inicio), 'el stock sube 10 cajas, no 20');
select is((select condicion::text from compras where id = (select id from compra where n = 1)), 'credito', 'queda al crédito, como se dijo');
select is((select resultado from comandos_voz where transcripcion like 'el de chao%'), 'confirmado', 'el comando queda confirmado');

-- --- Corregido -------------------------------------------------------------------------------
select lives_ok(
  $$ select registrar_compra(jsonb_build_object('condicion', 'contado', 'medio_pago', 'yape', 'corregido', true,
       'comando_voz_id', (select id from comandos_voz where transcripcion like 'compré 2%'),
       'items', '[{"producto_id":1,"cantidad":2,"costo_unitario":29}]'::jsonb)) $$,
  'una compra al contado sin proveedor se guarda');
select is((select resultado from comandos_voz where transcripcion like 'compré 2%'), 'corregido', 'el comando queda como corregido');

-- --- Borde: al crédito hay que saber a quién se le debe ------------------------------------------
select throws_ok(
  $$ select registrar_compra(jsonb_build_object('condicion', 'credito',
       'items', '[{"producto_id":1,"cantidad":1,"costo_unitario":30}]'::jsonb)) $$,
  '23514', null, 'una compra al crédito sin proveedor se rechaza');

-- --- Contador: no registra ----------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000c9');
select throws_ok(
  $$ select registrar_compra(jsonb_build_object('proveedor_id', 2, 'condicion', 'contado', 'medio_pago', 'efectivo',
       'items', '[{"producto_id":1,"cantidad":1,"costo_unitario":30}]'::jsonb)) $$,
  '42501', null, 'el contador no registra compras');

select * from finish();
rollback;
