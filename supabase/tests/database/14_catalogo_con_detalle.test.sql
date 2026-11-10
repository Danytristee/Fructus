-- =============================================================================
-- El producto se identifica por fruta, variedad, marca, selección y calibre (ADR-0016) — pruebas pgTAP (npx supabase test db).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

insert into productos (nombre, seleccion, kg_por_caja, costo_referencia, precio_referencia) values
  ('Membrillo', '3era', 18, 140, 160),
  ('Membrillo', '4ta',  18, 130, 150);
select is((select count(*) from productos where nombre = 'Membrillo'), 2::bigint, 'la misma fruta con otra selección es otro producto');

insert into productos (nombre, variedad, marca, seleccion, calibre) values
  ('Manzana', 'Roja americana', 'Nordic', 'Premium', '113'),
  ('Manzana', 'Roja americana', 'Nordic', 'Premium', '100');
select is((select count(*) from productos where variedad = 'Roja americana'), 2::bigint, 'con otro calibre también es otro producto');

select throws_ok(
  $$insert into productos (nombre, variedad, marca, seleccion, calibre) values ('manzana', 'ROJA americana', 'NORDIC', 'premium', '113')$$,
  '23505', null, 'el mismo producto con otras mayúsculas no entra dos veces');

select throws_ok($$insert into productos (nombre, seleccion) values ('Membrillo', '4ta')$$, '23505', null,
  'sin marca ni calibre, la llave también se cumple (null cuenta como igual)');

select throws_ok($$insert into productos (nombre, marca) values ('Pera', '  ')$$, '23514', null, 'una marca vacía no es un dato');
select throws_ok($$insert into productos (nombre, kg_por_caja) values ('Tuna', 0)$$, '23514', null, 'una caja no pesa 0 kg');

-- Caso borde: el producto de siempre, sin las partes nuevas, se sigue guardando como antes.
insert into productos (nombre) values ('Tumbo');
select is((select stock from v_stock where nombre = 'Tumbo'), 0::numeric, 'un producto sin detalle sigue apareciendo en el stock');

select is((select seleccion from v_stock where nombre = 'Membrillo' order by seleccion limit 1), '3era', 'v_stock trae la selección');

select * from finish();
rollback;
