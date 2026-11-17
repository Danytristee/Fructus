-- =============================================================================
-- Una venta al crédito con lo que pagó al llevar (ADR-0025) — pruebas pgTAP.
-- «Vendí 10 cajas de mango a don Lucho a 500 y pagó solo 1000»: la venta es de S/ 5,000 al crédito, entra un abono de S/ 1,000
-- atado a ella, y don Lucho debe S/ 4,000. No depende del catálogo cargado.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d8', 'duenio28@fructus.test'),
  ('00000000-0000-0000-0000-0000000000a8', 'ayudante28@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000d8', 'Dueño', 'duenio'),
  ('00000000-0000-0000-0000-0000000000a8', 'Ayudante', 'ayudante');
create temp table datos as
with p  as (insert into productos (nombre, variedad) values ('Mango 28', 'Prueba') returning id),
     c  as (insert into clientes (nombre) values ('Lucho 28') returning id),
     c2 as (insert into clientes (nombre) values ('Rosa 28') returning id)
select (select id from p) as producto, (select id from c) as cliente, (select id from c2) as otro_cliente;
create temp table cmd as
with ins as (
  insert into comandos_voz (transcripcion, registrado_por)
  values ('pagó solo 1000', '00000000-0000-0000-0000-0000000000d8'),
         ('del ayudante', '00000000-0000-0000-0000-0000000000a8')
  returning id, transcripcion)
select * from ins;
grant select on datos, cmd to authenticated;

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
-- 10 cajas a 500 = S/ 5,000.
create function pg_temp.venta(p_condicion text, p_pago jsonb, p_comando text default null) returns jsonb language sql as $$
  select jsonb_build_object(
    'cliente_id', (select cliente from datos), 'condicion', p_condicion,
    'medio_pago', case when p_condicion = 'contado' then 'efectivo' end,
    'comando_voz_id', (select id from cmd where transcripcion = p_comando),
    'pago_inicial', p_pago,
    'items', jsonb_build_array(jsonb_build_object('producto_id', (select producto from datos), 'cantidad', 10, 'precio_unitario', 500)));
$$;
create function pg_temp.saldo(p_cliente bigint) returns numeric language sql as $$
  select saldo from v_saldo_clientes where cliente_id = p_cliente;
$$;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000d8');

-- --- Caso feliz: S/ 5,000 al crédito, pagó S/ 1,000, debe S/ 4,000 ------------------------------------------------------
create temp table hecha as select registrar_venta(pg_temp.venta('credito', '{"monto": 1000, "medio_pago": "yape"}', 'pagó solo 1000')) as id;
select is((select total from ventas where id = (select id from hecha)), 5000.00::numeric(12,2), 'la venta es por el total: S/ 5,000');
select is((select condicion::text from ventas where id = (select id from hecha)), 'credito', 'y queda al crédito');
select is((select monto from abonos where venta_id = (select id from hecha)), 1000.00::numeric(12,2), 'lo que dejó entra como abono atado a la venta');
select is((select medio_pago::text from abonos where venta_id = (select id from hecha)), 'yape', 'con el medio que dijo');
select is((select a.fecha = v.fecha from abonos a join ventas v on v.id = a.venta_id where v.id = (select id from hecha)), true,
  'a la misma hora que la venta');
select is((select comando_voz_id from abonos where venta_id = (select id from hecha)), null, 'el comando lo lleva la venta, no el abono');
select is(pg_temp.saldo((select cliente from datos)), 4000.00::numeric, 'y don Lucho debe S/ 4,000');
select is((select resultado from comandos_voz where transcripcion = 'pagó solo 1000'), 'confirmado', 'el comando queda confirmado');

-- --- Doble toque: la misma venta, un solo abono ---------------------------------------------------------------------------
select is(registrar_venta(pg_temp.venta('credito', '{"monto": 1000, "medio_pago": "yape"}', 'pagó solo 1000')), (select id from hecha),
  'tocar Confirmar otra vez devuelve la misma venta');
select is((select count(*)::int from abonos where cliente_id = (select cliente from datos)), 1, 'y no vuelve a bajar la deuda');

-- --- Rechazos: lo que no es un pago parcial no se guarda -----------------------------------------------------------------
select throws_ok($$ select registrar_venta(pg_temp.venta('contado', '{"monto": 1000, "medio_pago": "efectivo"}')) $$,
  '23514', null, 'una venta al contado no lleva pago al llevar');
select throws_ok($$ select registrar_venta(pg_temp.venta('credito', '{"monto": 5000, "medio_pago": "efectivo"}')) $$,
  '23514', 'Si pagó todo, la venta es al contado', 'pagar el total no es un pago parcial: es contado');
select throws_ok($$ select registrar_venta(pg_temp.venta('credito', '{"monto": 6000, "medio_pago": "efectivo"}')) $$,
  '23514', 'Si pagó todo, la venta es al contado', 'pagar más que el total tampoco');
select throws_ok($$ select registrar_venta(pg_temp.venta('credito', '{"monto": 0, "medio_pago": "efectivo"}')) $$,
  '23514', null, 'pagar cero no es un pago');
select throws_ok($$ select registrar_venta(pg_temp.venta('credito', '{"monto": 100.555, "medio_pago": "efectivo"}')) $$,
  '23514', null, 'ni con más de dos decimales');
select throws_ok($$ select registrar_venta(pg_temp.venta('credito', '{"monto": 1000}')) $$,
  '23502', null, 'sin decir con qué pagó, no se guarda');
select is((select count(*)::int from ventas where cliente_id = (select cliente from datos)), 1, 'ninguno de los rechazos dejó una venta suelta');

-- --- Sin pago al llevar, como siempre -------------------------------------------------------------------------------------
create temp table sin_pago as select registrar_venta(pg_temp.venta('credito', 'null'::jsonb)) as id;
select is((select count(*)::int from abonos where venta_id = (select id from sin_pago)), 0, 'al crédito sin pago al llevar no hay abono');

-- --- El ayudante, con su dictado ------------------------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a8');
select lives_ok($$ select registrar_venta(pg_temp.venta('credito', '{"monto": 500, "medio_pago": "efectivo"}', 'del ayudante')) $$,
  'el ayudante registra una venta con pago al llevar');

-- --- Insert directo: un abono atado a una venta tiene que ser de esa venta ----------------------------------------------
create temp table contado as select registrar_venta(pg_temp.venta('contado', null)) as id;
grant select on hecha, contado, sin_pago to authenticated;
select throws_ok($$ insert into abonos (cliente_id, monto, medio_pago, venta_id)
    values ((select cliente from datos), 100, 'efectivo', (select id from contado)) $$,
  '23514', null, 'no se ata un abono a una venta al contado');
select throws_ok($$ insert into abonos (cliente_id, monto, medio_pago, venta_id)
    values ((select otro_cliente from datos), 100, 'efectivo', (select id from sin_pago)) $$,
  '23514', null, 'ni a la venta de otro cliente');
select throws_ok($$ insert into abonos (cliente_id, monto, medio_pago, venta_id)
    values ((select cliente from datos), 5000, 'efectivo', (select id from sin_pago)) $$,
  '23514', null, 'ni por el total de la venta');

-- --- Anular: lo que dejó queda a favor del cliente (opción A del 2026-11-17) ---------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000d8');
-- Antes: 5,000 − 1,000 (hecha) + 5,000 (sin_pago) + 5,000 − 500 (del ayudante) = 13,500.
select lives_ok($$ select anular_venta((select id from hecha), 'se equivocó de cliente') $$, 'el dueño anula la venta con pago al llevar');
select is(pg_temp.saldo((select cliente from datos)), 8500.00::numeric,
  'la venta deja de contar y los S/ 1,000 que dejó quedan a su favor (13,500 − 5,000)');

select * from finish();
rollback;
