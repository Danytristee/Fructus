-- =============================================================================
-- Proveedores: lo que les debes baja cuando les pagas, y las compras se suman por fruta — pruebas pgTAP.
-- Corre sobre la base local con supabase/seed.sql cargado: Agrícola Chao = proveedor 2, Mango Kent = producto 1.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', 'ayudante16@fructus.test'),
  ('00000000-0000-0000-0000-0000000000c7', 'contador16@fructus.test'),
  ('00000000-0000-0000-0000-0000000000d7', 'duenio16@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000a7', 'Ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-0000000000c7', 'Contador', 'contador'),
  ('00000000-0000-0000-0000-0000000000d7', 'Dueño', 'duenio');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

create temp table inicio as
select coalesce((select saldo from v_saldo_proveedores where proveedor_id = 2), 0) as deuda_chao,
       now() - interval '1 minute' as desde;
grant select on inicio to authenticated;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000a7');

-- --- Caso feliz: una compra al crédito sube la deuda, y un pago la baja ------------------------
select lives_ok(
  $$ select registrar_compra('{"proveedor_id": 2, "condicion": "credito", "items": [
       {"producto_id": 1, "cantidad": 10, "costo_unitario": 30}, {"producto_id": 3, "cantidad": 5, "costo_unitario": 20}]}') $$,
  'el ayudante registra una compra al crédito a Chao');
select is((select saldo from v_saldo_proveedores where proveedor_id = 2), (select deuda_chao + 400 from inicio), 'le debes 400 más a Chao');
select lives_ok(
  $$ insert into pagos_proveedor (proveedor_id, monto, medio_pago) values (2, 150, 'yape') $$,
  'el ayudante anota un pago a Chao');
select is((select saldo from v_saldo_proveedores where proveedor_id = 2), (select deuda_chao + 250 from inicio), 'la deuda con Chao baja 150');

-- --- Compras por fruta: una fila por proveedor y fruta, con su último costo ----------------------
select lives_ok(
  $$ select registrar_compra('{"proveedor_id": 2, "condicion": "contado", "medio_pago": "efectivo", "items": [
       {"producto_id": 1, "cantidad": 4, "costo_unitario": 33}]}') $$,
  'una segunda compra de mango Kent, más cara');
select results_eq(
  $$ select compras, cajas, total, ultimo_costo, costo_promedio
       from compras_por_proveedor((select desde from inicio)) where proveedor_id = 2 and producto_id = 1 $$,
  $$ values (2, 14::numeric, 432::numeric, 33::numeric, 30.86::numeric) $$,
  'el mango Kent de Chao: 2 compras, 14 cajas, S/ 432, último costo 33, promedio 30.86');
select is((select count(*)::int from compras_por_proveedor((select desde from inicio))), 2, 'solo las compras desde la fecha pedida');

-- --- Doble toque: un comando de voz, un solo pago -----------------------------------------------
insert into comandos_voz (transcripcion, intencion, resultado) values ('le pagué 100 a chao', 'registrar_pago_proveedor', 'pendiente');
select lives_ok(
  $$ insert into pagos_proveedor (proveedor_id, monto, medio_pago, comando_voz_id)
     values (2, 100, 'efectivo', (select id from comandos_voz where transcripcion = 'le pagué 100 a chao')) $$,
  'el primer toque guarda el pago');
select throws_ok(
  $$ insert into pagos_proveedor (proveedor_id, monto, medio_pago, comando_voz_id)
     values (2, 100, 'efectivo', (select id from comandos_voz where transcripcion = 'le pagué 100 a chao')) $$,
  '23505', null, 'el segundo toque choca y no paga dos veces');

-- --- Bordes: un pago es de alguien y de más de cero soles ---------------------------------------
select throws_ok($$ insert into pagos_proveedor (monto, medio_pago) values (50, 'efectivo') $$, '23502', null, 'un pago sin proveedor se rechaza');
select throws_ok($$ insert into pagos_proveedor (proveedor_id, monto, medio_pago) values (2, 0, 'efectivo') $$, '23514', null, 'un pago de cero se rechaza');

-- --- Roles: el ayudante no edita pagos; el contador solo lee ------------------------------------
select is_empty($$ update pagos_proveedor set monto = 1 where proveedor_id = 2 returning id $$, 'el ayudante no puede cambiar un pago (no toca filas)');
select pg_temp.como('00000000-0000-0000-0000-0000000000c7');
select throws_ok($$ insert into pagos_proveedor (proveedor_id, monto, medio_pago) values (2, 20, 'efectivo') $$, '42501', null, 'el contador no registra pagos');

-- --- El nombre no se repite entre los activos ---------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000d7');
select throws_ok($$ insert into proveedores (nombre) values ('  agrícola CHAO ') $$, '23505', null, 'no hay dos «Agrícola Chao» activos');

select * from finish();
rollback;
