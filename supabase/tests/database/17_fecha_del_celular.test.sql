-- =============================================================================
-- La fecha del celular (ADR-0019): lo confirmado sin señal queda con la hora del toque, si es creíble — pruebas pgTAP.
-- Corre sobre la base local con supabase/seed.sql cargado: Mango Kent = producto 1, Agrícola Chao = proveedor 2.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a8', 'ayudante17@fructus.test'),
  ('00000000-0000-0000-0000-0000000000c8', 'contador17@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000a8', 'Ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-0000000000c8', 'Contador', 'contador');
create temp table cli as with c as (insert into clientes (nombre) values ('Cliente fecha 17') returning id) select id from c;
grant select on cli to authenticated;

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000a8');

-- --- Caso feliz: una venta confirmada anoche a las 11:40 entra con esa hora, y su stock también ----------------
create temp table v as
select registrar_venta(jsonb_build_object(
  'cliente_id', (select id from cli), 'condicion', 'credito', 'fecha', (now() - interval '6 hours 20 minutes')::text,
  'items', jsonb_build_array(jsonb_build_object('producto_id', 1, 'cantidad', 2, 'precio_unitario', 40)))) as id;
select is((select fecha from ventas where id = (select id from v)), now() - interval '6 hours 20 minutes', 'la venta queda con la hora del toque');
select is((select fecha from movimientos_stock where venta_id = (select id from v)), now() - interval '6 hours 20 minutes', 'su salida de stock, con la misma hora');
select ok((select creado_en from ventas where id = (select id from v)) = now(), 'creado_en sigue siendo la hora del servidor');

-- La compra igual, con su entrada de stock.
create temp table c as
select registrar_compra(jsonb_build_object(
  'proveedor_id', 2, 'condicion', 'contado', 'medio_pago', 'efectivo', 'fecha', (now() - interval '2 hours')::text,
  'items', jsonb_build_array(jsonb_build_object('producto_id', 1, 'cantidad', 3, 'costo_unitario', 20)))) as id;
select is((select fecha from compras where id = (select id from c)), now() - interval '2 hours', 'la compra queda con la hora del toque');
select is((select fecha from movimientos_stock where compra_id = (select id from c)), now() - interval '2 hours', 'su entrada de stock, con la misma hora');

-- Un abono directo (sin RPC) también respeta la hora del toque.
insert into abonos (cliente_id, monto, medio_pago, fecha) values ((select id from cli), 10, 'efectivo', now() - interval '30 minutes');
select is((select fecha from abonos where cliente_id = (select id from cli)), now() - interval '30 minutes', 'el abono queda con la hora del toque');

-- --- Casos borde: una hora que no es creíble se cambia por la del servidor, y la operación no se pierde ---------
select is(fecha_del_celular(now() - interval '3 days'), now(), 'de hace 3 días: la del servidor');
select is(fecha_del_celular(now() + interval '1 hour'), now(), 'del futuro (celular adelantado): la del servidor');
select is(fecha_del_celular(null), now(), 'sin hora: la del servidor');
insert into gastos (categoria, monto, medio_pago, fecha) values ('flete', 15, 'efectivo', '2020-01-01');
select is((select fecha from gastos where monto = 15 and categoria = 'flete' order by id desc limit 1), now(), 'un insert directo con una fecha vieja queda con la del servidor');

-- --- Rechazo por rol: el contador no registra ventas, con o sin fecha -----------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000c8');
select throws_ok(
  $$ select registrar_venta('{"condicion": "contado", "medio_pago": "efectivo", "fecha": "2026-11-12T05:00:00Z",
       "items": [{"producto_id": 1, "cantidad": 1, "precio_unitario": 40}]}') $$,
  '42501', null, 'el contador no puede registrar una venta');

-- Sin sesión, la función de la fecha no se puede llamar.
reset role;
select ok(not has_function_privilege('anon', 'fecha_del_celular(timestamptz)', 'execute'), 'anon no ejecuta fecha_del_celular');

select * from finish();
rollback;
