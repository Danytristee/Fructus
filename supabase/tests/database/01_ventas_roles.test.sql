-- =============================================================================
-- Ventas, deuda, stock y roles — pruebas pgTAP (npx supabase test db).
-- Corre sobre la base local con supabase/seed.sql cargado: Mango Kent = producto 1,
-- Plátano de seda = producto 3, Luis Paredes («don Lucho») = cliente 1.
-- Todo ocurre dentro de una transacción que se deshace al final.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

-- --- Personas de prueba -------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'duenio@fructus.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'ayudante@fructus.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'contador@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000d1', 'Dueño',    'duenio'),
  ('00000000-0000-0000-0000-0000000000a1', 'Ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-0000000000c1', 'Contador', 'contador');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- El seed trae un día de demo con stock y deudas: se mide lo que cambia, no el total.
create temp table inicio as
select coalesce((select stock from v_stock where producto_id = 1), 0)          as stock_mango,
       coalesce((select saldo from v_saldo_clientes where cliente_id = 1), 0) as deuda_lucho;
grant select on inicio to authenticated;

set local role authenticated;

-- --- Dueño: llega fruta -------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000d1');
select lives_ok(
  $$ select registrar_compra('{"proveedor_id":2,"medio_pago":"efectivo","items":[{"producto_id":1,"cantidad":50,"costo_unitario":30},{"producto_id":3,"cantidad":40,"costo_unitario":20}]}') $$,
  'el dueño registra una compra');
select is((select stock from v_stock where producto_id = 1), (select stock_mango + 50 from inicio), 'la compra suma 50 cajas de mango al stock');

-- --- Ayudante: vende a crédito con rebaja y cobra un abono ---------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ select registrar_venta('{"cliente_id":1,"condicion":"credito","items":[{"producto_id":1,"cantidad":10,"precio_unitario":45,"descuento":20}]}') $$,
  'el ayudante registra una venta a crédito');
select is((select total from ventas order by id desc limit 1), 430.00::numeric, 'el total es 10 × 45 − 20 de rebaja');
select is((select stock from v_stock where producto_id = 1), (select stock_mango + 40 from inicio), 'la venta descuenta 10 cajas');
select is((select saldo from v_saldo_clientes where cliente_id = 1), (select deuda_lucho + 430 from inicio), 'don Lucho debe 430 más');

insert into abonos (cliente_id, monto, medio_pago) values (1, 200, 'efectivo');
select is((select saldo from v_saldo_clientes where cliente_id = 1), (select deuda_lucho + 230 from inicio), 'tras abonar 200, la deuda nueva baja a 230');

select throws_ok(
  $$ select anular_venta((select max(id) from ventas)) $$,
  'P0001', 'Solo el dueño o el administrador pueden anular ventas',
  'el ayudante no puede anular');

-- --- Reglas que la base hace cumplir -------------------------------------------
select throws_ok(
  $$ select registrar_venta('{"condicion":"credito","items":[{"producto_id":3,"cantidad":1,"precio_unitario":32}]}') $$,
  '23514', null, 'una venta a crédito necesita cliente');
select throws_ok(
  $$ select registrar_venta('{"condicion":"contado","medio_pago":"yape","items":[]}') $$,
  'P0001', 'La venta no tiene productos', 'una venta sin productos se rechaza');

-- --- Contador: solo lee --------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000c1');
select throws_ok(
  $$ select registrar_venta('{"condicion":"contado","medio_pago":"efectivo","items":[{"producto_id":3,"cantidad":1,"precio_unitario":32}]}') $$,
  '42501', null, 'el contador no puede registrar ventas');

-- --- Dueño: anula y el stock vuelve ---------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000d1');
select lives_ok($$ select anular_venta((select max(id) from ventas)) $$, 'el dueño anula la venta');
select is((select stock from v_stock where producto_id = 1), (select stock_mango + 50 from inicio), 'la anulación devuelve las 10 cajas');

-- --- Funciones reservadas al servidor --------------------------------------------
select throws_ok($$ select tomar_numero('B001') $$, '42501', null, 'un usuario no puede tomar correlativos');

select * from finish();
rollback;
