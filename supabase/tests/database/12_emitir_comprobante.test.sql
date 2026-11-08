-- =============================================================================
-- Emitir un comprobante (A9): el número se reserva en la base, una sola vez por venta —
-- pruebas pgTAP (npx supabase test db). Corre sobre la base local con supabase/seed.sql: Mango Kent = producto 1 y «Juguería El Paraíso» tiene RUC. Todo ocurre dentro de una transacción que se deshace al final.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(23);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d9', 'duenio9@fructus.test'),
  ('00000000-0000-0000-0000-0000000000c9', 'contador9@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000d9', 'Dueño',    'duenio'),
  ('00000000-0000-0000-0000-0000000000c9', 'Contador', 'contador');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- Clientes propios: uno sin documento y uno con DNI (los de la semilla cambian con las pruebas e2e). El de RUC trae la semilla.
insert into clientes (nombre) values ('Cliente sin documento de prueba');
insert into clientes (nombre, tipo_documento, numero_documento) values ('Cliente con DNI de prueba', 'DNI', '12345678');

create temp table ventas_de_prueba (nombre text primary key, id bigint);
grant select, insert on ventas_de_prueba to authenticated, service_role;
create temp table inicio as
select coalesce((select ultimo_numero from series_comprobante where serie = 'B001'), 0) as b,
       coalesce((select ultimo_numero from series_comprobante where serie = 'F001'), 0) as f;
grant select on inicio to authenticated, service_role;

-- Las ventas las hace el dueño (como en la app).
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000d9');
insert into ventas_de_prueba values
  ('al_paso',        registrar_venta('{"condicion": "contado", "medio_pago": "efectivo", "items": [{"producto_id": 1, "cantidad": 2, "precio_unitario": 45}]}'::jsonb)),
  ('a_lucho',        registrar_venta(format('{"cliente_id": %s, "condicion": "credito", "items": [{"producto_id": 1, "cantidad": 1, "precio_unitario": 50}]}',
                      (select id from clientes where nombre = 'Cliente sin documento de prueba'))::jsonb)),
  ('grande_sin_doc', registrar_venta(format('{"cliente_id": %s, "condicion": "credito", "items": [{"producto_id": 1, "cantidad": 20, "precio_unitario": 50}]}',
                      (select id from clientes where nombre = 'Cliente sin documento de prueba'))::jsonb)),
  ('grande_con_dni', registrar_venta(format('{"cliente_id": %s, "condicion": "credito", "items": [{"producto_id": 1, "cantidad": 20, "precio_unitario": 50}]}',
                      (select id from clientes where nombre = 'Cliente con DNI de prueba'))::jsonb)),
  ('con_ruc',        registrar_venta(format('{"cliente_id": %s, "condicion": "credito", "items": [{"producto_id": 1, "cantidad": 1, "precio_unitario": 50}]}',
                      (select id from clientes where nombre = 'Juguería El Paraíso'))::jsonb)),
  ('paso_factura',   registrar_venta('{"condicion": "contado", "medio_pago": "efectivo", "items": [{"producto_id": 1, "cantidad": 1, "precio_unitario": 45}]}'::jsonb)),
  ('para_anular',    registrar_venta('{"condicion": "contado", "medio_pago": "efectivo", "items": [{"producto_id": 1, "cantidad": 1, "precio_unitario": 45}]}'::jsonb)),
  ('anular_pend',    registrar_venta('{"condicion": "contado", "medio_pago": "efectivo", "items": [{"producto_id": 1, "cantidad": 1, "precio_unitario": 45}]}'::jsonb)),
  ('anular_rech',    registrar_venta('{"condicion": "contado", "medio_pago": "efectivo", "items": [{"producto_id": 1, "cantidad": 1, "precio_unitario": 45}]}'::jsonb));
reset role;

-- Solo el servidor reserva números (service role): los usuarios no pueden ni ejecutar la función.
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000d9');
select throws_ok($$ select reservar_comprobante(1, '03') $$, '42501', null, 'ni el dueño puede reservar un número: solo el servidor');
reset role;

set local role service_role;

-- --- La boleta nueva: queda pendiente, con el siguiente número de su serie -------------------------------------------------------
select lives_ok($$ create temp table r1 as select reservar_comprobante((select id from ventas_de_prueba where nombre = 'al_paso'), '03') as r $$,
  'una boleta se reserva para una venta registrada');
select is((select r ->> 'estado' from r1), 'pendiente', 'nace pendiente: se guarda antes de enviarse');
select is((select r ->> 'serie' from r1) || '-' || (select (r ->> 'numero') from r1),
          'B001-' || (select b + 1 from inicio), 'toma el siguiente número de la serie de boletas');
select is((select (r ->> 'nuevo')::boolean from r1), true, 'dice que es nueva: quien la reservó es quien la envía');
select is((select ultimo_numero from series_comprobante where serie = 'B001'), (select b + 1 from inicio), 'la serie avanzó un número');

-- --- Pedirla otra vez no gasta otro número: devuelve la misma ---------------------------------------------------------------------
select is((select reservar_comprobante((select id from ventas_de_prueba where nombre = 'al_paso'), '03') ->> 'nuevo'), 'false', 'pedirla otra vez devuelve la misma, no una nueva');
select is((select ultimo_numero from series_comprobante where serie = 'B001'), (select b + 1 from inicio), 'y no gasta otro número de la serie');
select is((select reservar_comprobante((select id from ventas_de_prueba where nombre = 'al_paso'), '01') ->> 'tipo'), '03', 'pedir una factura cuando ya hay una boleta vigente devuelve la boleta: una sola por venta');
select throws_ok($$ insert into comprobantes (venta_id, tipo, serie, numero) values ((select id from ventas_de_prueba where nombre = 'al_paso'), '03', 'B001', 99999) $$,
  '23505', null, 'ni a mano se puede dejar una segunda vigente en la misma venta (índice único)');

-- --- La factura solo es para clientes con RUC -------------------------------------------------------------------------------------
select throws_ok($$ select reservar_comprobante((select id from ventas_de_prueba where nombre = 'a_lucho'), '01') $$,
  '23514', 'Una factura va a un cliente con RUC', 'no hay factura para un cliente sin RUC');
select throws_ok($$ select reservar_comprobante((select id from ventas_de_prueba where nombre = 'paso_factura'), '01') $$, '23514', 'Una factura va a un cliente con RUC', 'tampoco para una venta al paso (sin cliente)');
select is((select ultimo_numero from series_comprobante where serie = 'F001'), (select f from inicio), 'rechazarla no gasta un número de la serie de facturas');
select is((select reservar_comprobante((select id from ventas_de_prueba where nombre = 'con_ruc'), '01') ->> 'serie'), 'F001', 'a un cliente con RUC sí se le hace factura, en la serie F001');

-- --- La boleta de más de S/ 700 lleva el documento del cliente --------------------------------------------------------------------
select throws_ok($$ select reservar_comprobante((select id from ventas_de_prueba where nombre = 'grande_sin_doc'), '03') $$,
  '23514', 'Una boleta de más de S/ 700 lleva el DNI del cliente', 'una boleta de S/ 1,000 sin el documento del cliente no sale');
select lives_ok($$ select reservar_comprobante((select id from ventas_de_prueba where nombre = 'grande_con_dni'), '03') $$, 'con el DNI del cliente, sí');
select lives_ok($$ select reservar_comprobante((select id from ventas_de_prueba where nombre = 'a_lucho'), '03') $$, 'una boleta de S/ 50 no pide documento');

-- --- Lo que no se puede emitir ----------------------------------------------------------------------------------------------------
reset role;
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000d9');
select anular_venta((select id from ventas_de_prueba where nombre = 'para_anular'), 'prueba de una venta anulada');
reset role;
set local role service_role;
select throws_ok($$ select reservar_comprobante((select id from ventas_de_prueba where nombre = 'para_anular'), '03') $$, '22023', null, 'a una venta anulada no se le emite comprobante');
select throws_ok($$ select reservar_comprobante((select id from ventas_de_prueba where nombre = 'al_paso'), '99') $$, '22023', null, 'un tipo que no es 01 ni 03 se rechaza');

-- --- Un rechazado ya no cuenta: se puede pedir uno nuevo, con otro número -------------------------------------------------------
update comprobantes set estado = 'rechazado' where venta_id = (select id from ventas_de_prueba where nombre = 'al_paso');
select is((select (reservar_comprobante((select id from ventas_de_prueba where nombre = 'al_paso'), '03') ->> 'numero')::int), (select b + 4 from inicio),
  'tras un rechazo se reserva uno nuevo con el siguiente número (B001: ya se habían usado el de al_paso, grande_con_dni y a_lucho)');

-- --- Anular una venta con comprobante en proceso: no ---------------------------------------------------------------------------
select reservar_comprobante((select id from ventas_de_prueba where nombre = 'anular_pend'), '03');
select reservar_comprobante((select id from ventas_de_prueba where nombre = 'anular_rech'), '03');
update comprobantes set estado = 'rechazado' where venta_id = (select id from ventas_de_prueba where nombre = 'anular_rech');
reset role;
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000d9');
select throws_like($$ select anular_venta((select id from ventas_de_prueba where nombre = 'anular_pend'), 'prueba de anular con comprobante') $$, '%comprobante en proceso%',
  'no se anula una venta cuyo comprobante está en proceso: podría quedar aceptado después');
select lives_ok($$ select anular_venta((select id from ventas_de_prueba where nombre = 'anular_rech'), 'prueba de anular con rechazado') $$, 'con un comprobante rechazado sí se puede anular');

-- --- Quién lee: cualquier perfil activo (la política que ya existía); el contador también ----------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000c9');
select ok((select count(*) from comprobantes) > 0, 'el contador lee los comprobantes');
reset role;

select * from finish();
rollback;
