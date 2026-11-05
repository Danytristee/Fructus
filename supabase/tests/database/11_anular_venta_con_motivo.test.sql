-- =============================================================================
-- Anular una venta pide motivo, deja quién y cuándo, devuelve el stock y solo lo hacen el dueño y el administrador —
-- pruebas pgTAP (npx supabase test db). Corre sobre la base local con supabase/seed.sql: Mango Kent = producto 1, Luis
-- Paredes («don Lucho») = cliente 1. Todo ocurre dentro de una transacción que se deshace al final.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(15);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d8', 'duenio8@fructus.test'),
  ('00000000-0000-0000-0000-0000000000b8', 'admin8@fructus.test'),
  ('00000000-0000-0000-0000-0000000000a8', 'ayudante8@fructus.test'),
  ('00000000-0000-0000-0000-0000000000c8', 'contador8@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000d8', 'Dueño',         'duenio'),
  ('00000000-0000-0000-0000-0000000000b8', 'Administrador', 'administrador'),
  ('00000000-0000-0000-0000-0000000000a8', 'Ayudante',      'ayudante'),
  ('00000000-0000-0000-0000-0000000000c8', 'Contador',      'contador');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- Una venta al crédito de 4 cajas de Mango Kent a don Lucho, hecha por el dueño; y otra para el ayudante.
create temp table ventas_de_prueba (nombre text primary key, id bigint);
grant select, insert on ventas_de_prueba to authenticated;
create temp table inicio as
select coalesce((select stock from v_stock where producto_id = 1), 0)          as stock_mango,
       coalesce((select saldo from v_saldo_clientes where cliente_id = 1), 0) as deuda_lucho;
grant select on inicio to authenticated;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000d8');
insert into ventas_de_prueba values
  ('a', registrar_venta('{"cliente_id": 1, "condicion": "credito", "items": [{"producto_id": 1, "cantidad": 4, "precio_unitario": 50}]}'::jsonb)),
  ('b', registrar_venta('{"cliente_id": 1, "condicion": "credito", "items": [{"producto_id": 1, "cantidad": 1, "precio_unitario": 50}]}'::jsonb)),
  ('c', registrar_venta('{"cliente_id": 1, "condicion": "credito", "items": [{"producto_id": 1, "cantidad": 1, "precio_unitario": 50}]}'::jsonb));

-- --- Sin motivo no se anula: ni vacío, ni en blanco, ni de dos letras, ni de 201 --------------------------------------------
select throws_ok($$ select anular_venta((select id from ventas_de_prueba where nombre = 'a'), null) $$, '23514', 'Anular una venta pide el motivo', 'sin motivo no se anula');
select throws_ok($$ select anular_venta((select id from ventas_de_prueba where nombre = 'a'), '    ') $$, '23514', 'Anular una venta pide el motivo', 'un motivo en blanco tampoco');
select throws_ok($$ select anular_venta((select id from ventas_de_prueba where nombre = 'a'), 'ay') $$, '23514', 'Anular una venta pide el motivo', 'ni uno de dos letras');
select throws_ok($$ select anular_venta((select id from ventas_de_prueba where nombre = 'a'), repeat('x', 201)) $$, '23514', 'El motivo no puede pasar de 200 letras', 'ni uno de más de 200');
select is((select estado from ventas where id = (select id from ventas_de_prueba where nombre = 'a')), 'registrada', 'y la venta sigue registrada después de esos intentos');

-- --- El caso feliz: el dueño anula con motivo ------------------------------------------------------------------------------
select lives_ok($$ select anular_venta((select id from ventas_de_prueba where nombre = 'a'), '  Se registró dos veces  ') $$, 'el dueño anula con motivo');
select results_eq(
  $$ select estado, motivo_anulacion, anulada_por::text, anulada_en is not null from ventas where id = (select id from ventas_de_prueba where nombre = 'a') $$,
  $$ values ('anulada'::text, 'Se registró dos veces'::text, '00000000-0000-0000-0000-0000000000d8'::text, true) $$,
  'queda anulada, con el motivo sin espacios de más, quién y cuándo');
select is((select stock from v_stock where producto_id = 1), (select stock_mango - 2 from inicio), 'el stock devuelve las 4 cajas de la venta anulada: solo quedan vendidas la b y la c (2 cajas)');
select is((select saldo from v_saldo_clientes where cliente_id = 1), (select deuda_lucho + 100 from inicio), 'la deuda de don Lucho no cuenta la anulada: solo las dos ventas que siguen (2 × 50)');

-- --- No se anula dos veces: el segundo intento dice qué pasó y no devuelve el stock otra vez --------------------------------
select throws_ok($$ select anular_venta((select id from ventas_de_prueba where nombre = 'a'), 'Otra vez') $$, 'P0001', null, 'una venta anulada no se anula de nuevo');
select is((select count(*)::int from movimientos_stock where venta_id = (select id from ventas_de_prueba where nombre = 'a') and tipo = 'devolucion'), 1, 'y la devolución sigue siendo una sola');

-- --- Roles: el ayudante y el contador no anulan ---------------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a8');
select throws_ok($$ select anular_venta((select id from ventas_de_prueba where nombre = 'b'), 'Quiero anularla') $$, 'P0001', 'Solo el dueño o el administrador pueden anular ventas', 'el ayudante no anula');
select pg_temp.como('00000000-0000-0000-0000-0000000000c8');
select throws_ok($$ select anular_venta((select id from ventas_de_prueba where nombre = 'b'), 'Quiero anularla') $$, 'P0001', 'Solo el dueño o el administrador pueden anular ventas', 'el contador tampoco');

-- --- El administrador sí; y una consulta directa no puede dejar una anulada sin motivo ------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000b8');
select lives_ok($$ select anular_venta((select id from ventas_de_prueba where nombre = 'b'), 'El cliente la devolvió') $$, 'el administrador anula con motivo');
select throws_ok(
  $$ update ventas set estado = 'anulada' where id = (select id from ventas_de_prueba where nombre = 'c') $$,
  '23514', null, 'un update directo no puede dejar una venta anulada sin motivo (estado imposible)');

select * from finish();
rollback;
