-- =============================================================================
-- buscar_productos entiende la selección y devuelve las partes del producto (ADR-0016) — pgTAP (npx supabase test db).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(6);

insert into productos (nombre, seleccion, alias) values
  ('Membrillo', '3era', '{"membrillo de tercera"}'),
  ('Membrillo', '4ta',  '{"membrillo de cuarta"}'),
  ('Membrillo', '5ta',  '{"membrillo de quinta"}');
insert into productos (nombre, variedad, marca, seleccion, calibre) values
  ('Manzana', 'Verde', 'Nordic', 'Premium',   '100'),
  ('Manzana', 'Verde', 'Nordic', 'Comercial', '80 o 75');

select is((select seleccion from buscar_productos('membrillo 4ta', 1)), '4ta', '«membrillo 4ta» encuentra la 4ta, no la que salga primero');
select is((select seleccion from buscar_productos('membrillo de cuarta', 1)), '4ta', 'como se dice en el puesto, por su alias');
select is((select seleccion from buscar_productos('manzana verde comercial', 1)), 'Comercial', 'la selección dicha decide entre dos de la misma variedad');

-- Caso borde: sin la selección, las dos quedan casi iguales; la tarjeta pregunta cuál (lib/voz/tarjeta-reglas.ts, elegir).
select ok(
  (select max(similitud) - min(similitud) from buscar_productos('manzana verde', 2)) < 0.15,
  '«manzana verde» a secas deja a la Premium y a la Comercial casi empatadas');

select is((select calibre from buscar_productos('manzana verde premium', 1)), '100', 'devuelve el calibre para nombrarla');

-- Rechazo por rol: sin sesión no se busca.
select is(has_function_privilege('anon', 'public.buscar_productos(text, integer)', 'execute'), false, 'sin sesión no se ejecuta');

select * from finish();
rollback;
