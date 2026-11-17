-- =============================================================================
-- Un dictado lo guarda quien lo dictó, o el dueño o el administrador, en TODA tabla con comando de voz — pruebas pgTAP.
-- La 25 lo prueba en registrar_venta y registrar_compra. Aquí, en el insert directo: el abono, la merma, el gasto, la
-- temperatura y el pago a proveedor se guardan así, y las ventas y compras también aceptan un insert sin pasar por la RPC.
-- Sin esta regla, un ayudante que guarda con el comando de otra cuenta deja ese comando «pendiente», y si guarda primero, la
-- confirmación de la otra cuenta choca con «ya guardado» y se da por buena con los datos del ayudante.
-- No depende del catálogo cargado.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d2', 'duenio26@fructus.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'ayudante26@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000d2', 'Dueño', 'duenio'),
  ('00000000-0000-0000-0000-0000000000a2', 'Ayudante', 'ayudante');
create temp table datos as
with p as (insert into productos (nombre, variedad) values ('Fruta 26', 'Prueba') returning id),
     c as (insert into clientes (nombre) values ('Cliente 26') returning id),
     v as (insert into proveedores (nombre) values ('Proveedor 26') returning id)
select (select id from p) as producto, (select id from c) as cliente, (select id from v) as proveedor;
-- Un comando por cosa que se va a guardar: los del dueño los intenta usar el ayudante.
create temp table cmd as
with ins as (
  insert into comandos_voz (transcripcion, registrado_por)
  select t, '00000000-0000-0000-0000-0000000000d2'::uuid
    from unnest(array['abono del dueño', 'merma del dueño', 'gasto del dueño', 'temperatura del dueño', 'pago del dueño',
                      'venta del dueño', 'compra del dueño']) t
  union all
  select t, '00000000-0000-0000-0000-0000000000a2'::uuid
    from unnest(array['abono del ayudante', 'venta del ayudante', 'compra del ayudante', 'gasto del ayudante']) t
  returning id, transcripcion)
select * from ins;
grant select on datos, cmd to authenticated;

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.c(p_transcripcion text) returns bigint language sql as $$
  select id from cmd where transcripcion = p_transcripcion;
$$;

set local role authenticated;

-- --- Rechazo: el ayudante no guarda nada con el comando del dueño ---------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
select throws_ok($$ insert into abonos (cliente_id, monto, medio_pago, comando_voz_id)
                    values ((select cliente from datos), 50, 'efectivo', pg_temp.c('abono del dueño')) $$,
  '42501', null, 'un abono con el comando del dueño');
select throws_ok($$ insert into movimientos_stock (producto_id, tipo, cantidad, motivo, comando_voz_id)
                    values ((select producto from datos), 'merma', -2, 'se malogró', pg_temp.c('merma del dueño')) $$,
  '42501', null, 'una merma con el comando del dueño');
select throws_ok($$ insert into gastos (categoria, monto, comando_voz_id) values ('flete', 30, pg_temp.c('gasto del dueño')) $$,
  '42501', null, 'un gasto con el comando del dueño');
select throws_ok($$ insert into temperaturas (grados, comando_voz_id) values (24, pg_temp.c('temperatura del dueño')) $$,
  '42501', null, 'una temperatura con el comando del dueño');
select throws_ok($$ insert into pagos_proveedor (proveedor_id, monto, medio_pago, comando_voz_id)
                    values ((select proveedor from datos), 100, 'efectivo', pg_temp.c('pago del dueño')) $$,
  '42501', null, 'un pago a proveedor con el comando del dueño');
select throws_ok($$ insert into ventas (cliente_id, condicion, total, comando_voz_id)
                    values ((select cliente from datos), 'credito', 80, pg_temp.c('venta del dueño')) $$,
  '42501', null, 'una venta insertada directo, sin registrar_venta, con el comando del dueño');
select throws_ok($$ insert into compras (proveedor_id, condicion, total, comando_voz_id)
                    values ((select proveedor from datos), 'credito', 40, pg_temp.c('compra del dueño')) $$,
  '42501', null, 'una compra insertada directo, sin registrar_compra, con el comando del dueño');
select throws_ok($$ insert into gastos (categoria, monto, comando_voz_id) values ('flete', 30, -1) $$,
  '42501', null, 'tampoco con un comando que no existe');

-- --- El dictado del dueño sigue libre para él: nadie se lo ganó -----------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000d2');
select lives_ok($$ insert into abonos (cliente_id, monto, medio_pago, comando_voz_id)
                   values ((select cliente from datos), 70, 'yape', pg_temp.c('abono del dueño')) $$,
  'el dueño guarda su propio abono');
select is((select monto from abonos where comando_voz_id = pg_temp.c('abono del dueño')), 70.00::numeric(12,2),
  'y queda con su monto, no con uno ajeno');

-- --- Caso feliz: el ayudante guarda con su propio comando, también por las RPC --------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$ insert into abonos (cliente_id, monto, medio_pago, comando_voz_id)
                   values ((select cliente from datos), 20, 'efectivo', pg_temp.c('abono del ayudante')) $$,
  'el ayudante guarda un abono con su propio comando');
select lives_ok($$ update comandos_voz set resultado = 'confirmado' where id = pg_temp.c('abono del ayudante') $$,
  'y marca su comando');
select is((select resultado from comandos_voz where id = pg_temp.c('abono del ayudante')), 'confirmado', 'que queda confirmado');
select lives_ok($$ select registrar_venta(jsonb_build_object(
    'cliente_id', (select cliente from datos), 'condicion', 'credito', 'comando_voz_id', pg_temp.c('venta del ayudante'),
    'items', jsonb_build_array(jsonb_build_object('producto_id', (select producto from datos), 'cantidad', 1, 'precio_unitario', 40)))) $$,
  'registrar_venta con su comando sigue andando (la salida de stock lleva el comando)');
select lives_ok($$ select registrar_compra(jsonb_build_object(
    'proveedor_id', (select proveedor from datos), 'condicion', 'credito', 'comando_voz_id', pg_temp.c('compra del ayudante'),
    'items', jsonb_build_array(jsonb_build_object('producto_id', (select producto from datos), 'cantidad', 3, 'costo_unitario', 20)))) $$,
  'registrar_compra con su comando sigue andando (la entrada de stock lleva el comando)');

-- --- El dueño gestiona todo: guarda con el comando del ayudante ------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000d2');
select lives_ok($$ insert into gastos (categoria, monto, comando_voz_id) values ('flete', 15, pg_temp.c('gasto del ayudante')) $$,
  'el dueño guarda un gasto dictado por el ayudante');

-- --- Caso borde: sin comando (a mano) no hay dictado que revisar ----------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$ insert into movimientos_stock (producto_id, tipo, cantidad, motivo)
                   values ((select producto from datos), 'merma', -1, 'se malogró') $$,
  'sin comando, el ayudante registra una merma como siempre');

select * from finish();
rollback;
