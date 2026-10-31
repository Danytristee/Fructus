-- =============================================================================
-- Una merma dictada se guarda una sola vez — pruebas pgTAP (npx supabase test db).
-- Corre sobre la base local con supabase/seed.sql cargado: Mango Kent = producto 1.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', 'ayudante7@fructus.test'),
  ('00000000-0000-0000-0000-0000000000c7', 'contador7@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000a7', 'Ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-0000000000c7', 'Contador', 'contador');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

create temp table inicio as select coalesce((select stock from v_stock where producto_id = 1), 0) as stock_mango;
grant select on inicio to authenticated;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000a7');

insert into comandos_voz (transcripcion, intencion, resultado) values
  ('se malograron 3 de mango', 'registrar_merma', 'pendiente'),
  ('vendí 2 de mango y 1 de piña', 'registrar_venta', 'pendiente');

-- --- El caso feliz: el ayudante registra la merma dictada --------------------------------
select lives_ok(
  $$ insert into movimientos_stock (producto_id, tipo, cantidad, motivo, comando_voz_id)
     values (1, 'merma', -3, 'se malogró', (select id from comandos_voz where transcripcion like 'se malograron%')) $$,
  'el ayudante guarda una merma dictada');
select is((select stock from v_stock where producto_id = 1), (select stock_mango - 3 from inicio), 'el stock de mango baja 3 cajas');

-- --- El segundo toque choca con el índice -------------------------------------------------
select throws_ok(
  $$ insert into movimientos_stock (producto_id, tipo, cantidad, motivo, comando_voz_id)
     values (1, 'merma', -3, 'se malogró', (select id from comandos_voz where transcripcion like 'se malograron%')) $$,
  '23505', null, 'la base rechaza una segunda merma con el mismo comando');
select is((select stock from v_stock where producto_id = 1), (select stock_mango - 3 from inicio), 'el stock bajó 3, no 6');

-- --- Borde: una venta con dos frutas deja dos salidas con el mismo comando, y eso sigue valiendo ---
select lives_ok(
  $$ select registrar_venta(jsonb_build_object('condicion', 'contado', 'medio_pago', 'efectivo',
       'comando_voz_id', (select id from comandos_voz where transcripcion like 'vendí 2%'),
       'items', '[{"producto_id":1,"cantidad":2,"precio_unitario":45},{"producto_id":2,"cantidad":1,"precio_unitario":40}]'::jsonb)) $$,
  'el índice de mermas no frena las salidas de una venta con varias frutas');

-- --- Borde: una merma siempre resta ------------------------------------------------------------
select throws_ok($$ insert into movimientos_stock (producto_id, tipo, cantidad) values (1, 'merma', 3) $$, '23514', null, 'una merma en positivo se rechaza');

-- --- Contador: solo lee ---------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000c7');
select throws_ok($$ insert into movimientos_stock (producto_id, tipo, cantidad) values (1, 'merma', -1) $$, '42501', null, 'el contador no registra mermas');

select * from finish();
rollback;
