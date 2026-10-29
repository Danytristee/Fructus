-- =============================================================================
-- Los montos van en céntimos: el total de una venta o compra es siempre la suma de lo que guardan sus ítems.
-- (/chaos 2026-10-29: «1,299» llegaba como 1.299, el ítem guardaba 1.30 y el total 12.99 → INV-01 roto.)
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(7);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d3', 'duenio3@fructus.test');
insert into perfiles (id, nombre, rol) values ('00000000-0000-0000-0000-0000000000d3', 'Dueño', 'duenio');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000d3', 'role', 'authenticated')::text, true);
set local role authenticated;

-- Más de dos decimales: se rechaza, no se redondea a escondidas.
select throws_ok($$ select registrar_venta('{"condicion":"contado","medio_pago":"efectivo","items":[{"producto_id":1,"cantidad":10,"precio_unitario":1.299}]}') $$,
  'P0001', 'Los montos y las cajas van con dos decimales como máximo', 'una venta con un precio de 3 decimales se rechaza');
select throws_ok($$ select registrar_venta('{"condicion":"contado","medio_pago":"efectivo","items":[{"producto_id":1,"cantidad":2.555,"precio_unitario":45}]}') $$,
  'P0001', 'Los montos y las cajas van con dos decimales como máximo', 'cajas con 3 decimales se rechazan');
select throws_ok($$ select registrar_compra('{"proveedor_id":1,"medio_pago":"efectivo","items":[{"producto_id":1,"cantidad":10,"costo_unitario":30.005}]}') $$,
  'P0001', 'Los montos y las cajas van con dos decimales como máximo', 'una compra con un costo de 3 decimales se rechaza');

-- Media caja a 47.33: el producto tiene más de dos decimales, y el total suma lo mismo que guardan los ítems.
create temp table hecha (tipo text, id bigint);
grant all on hecha to authenticated;
insert into hecha select 'venta', registrar_venta('{"condicion":"contado","medio_pago":"efectivo","items":[
  {"producto_id":1,"cantidad":2.5,"precio_unitario":47.33},{"producto_id":3,"cantidad":1.5,"precio_unitario":20.11,"descuento":0.01}]}');
insert into hecha select 'compra', registrar_compra('{"proveedor_id":1,"medio_pago":"efectivo","items":[
  {"producto_id":1,"cantidad":2.5,"costo_unitario":47.33},{"producto_id":3,"cantidad":1.5,"costo_unitario":20.11}]}');

select is((select total from ventas where id = (select id from hecha where tipo = 'venta')),
          (select sum(subtotal) from venta_items where venta_id = (select id from hecha where tipo = 'venta')),
          'el total de la venta es la suma de sus ítems');
select is((select total from ventas where id = (select id from hecha where tipo = 'venta')), 148.49::numeric, 'el total redondea por ítem: 118.33 (2.5 × 47.33) + 30.16 (1.5 × 20.11 − 0.01)');
select is((select total from compras where id = (select id from hecha where tipo = 'compra')),
          (select sum(subtotal) from compra_items where compra_id = (select id from hecha where tipo = 'compra')),
          'el total de la compra es la suma de sus ítems');

-- Con dos decimales todo sigue igual.
select lives_ok($$ select registrar_venta('{"condicion":"contado","medio_pago":"yape","items":[{"producto_id":1,"cantidad":10,"precio_unitario":47.5}]}') $$,
  'un precio de dos decimales se guarda');

select * from finish();
rollback;
