-- =============================================================================
-- Un cliente no se crea dos veces con el mismo nombre; solo el dueño y el administrador los gestionan —
-- pruebas pgTAP (npx supabase test db). Corre sobre la base local con supabase/seed.sql: Luis Paredes = cliente 1.
-- Todo ocurre dentro de una transacción que se deshace al final.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d7', 'duenio7@fructus.test'),
  ('00000000-0000-0000-0000-0000000000a7', 'ayudante7@fructus.test'),
  ('00000000-0000-0000-0000-0000000000c7', 'contador7@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000d7', 'Dueño',    'duenio'),
  ('00000000-0000-0000-0000-0000000000a7', 'Ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-0000000000c7', 'Contador', 'contador');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000d7');

-- --- El caso feliz: el dueño da de alta a un cliente con apodos y documento ----------------
select lives_ok(
  $$ insert into clientes (nombre, alias, tipo_documento, numero_documento, telefono)
     values ('Doña Marta Vega', '{"doña marta","la marta"}', 'DNI', '41234567', '987 654 321') $$,
  'el dueño da de alta a un cliente');

-- --- Dos veces el mismo nombre: no, con otras mayúsculas ni con espacios de más -----------
select throws_ok(
  $$ insert into clientes (nombre) values ('Doña Marta Vega') $$,
  '23505', null, 'el mismo nombre no se repite');
select throws_ok(
  $$ insert into clientes (nombre) values ('  DOÑA MARTA VEGA ') $$,
  '23505', null, 'ni con otras mayúsculas ni con espacios de más');
select throws_ok(
  $$ insert into clientes (nombre) values ('luis paredes') $$,
  '23505', null, 'ni el de un cliente que ya estaba (don Lucho)');

-- --- Dos personas distintas con el mismo apellido sí se pueden --------------------------------
select lives_ok(
  $$ insert into clientes (nombre) values ('Doña Marta Vega (puesto 12)') $$,
  'con algo que las distinga, dos Marta conviven');

-- --- Un cliente desactivado libera su nombre --------------------------------------------------
select lives_ok(
  $$ update clientes set activo = false where nombre = 'Doña Marta Vega (puesto 12)';
     insert into clientes (nombre) values ('Doña Marta Vega (puesto 12)') $$,
  'el nombre de un cliente desactivado queda libre');

-- --- Roles: el ayudante y el contador no gestionan clientes -----------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a7');
select throws_ok(
  $$ insert into clientes (nombre) values ('Cliente del ayudante') $$,
  '42501', null, 'el ayudante no da de alta clientes');
-- Un update sin permiso no falla: simplemente no toca filas. Se mira que el teléfono siga igual.
select lives_ok($$ update clientes set telefono = '999 000 111' where id = 1 $$, 'el ayudante intenta editar a don Lucho');
select isnt((select telefono from clientes where id = 1), '999 000 111', 'y el teléfono de don Lucho no cambió');

select pg_temp.como('00000000-0000-0000-0000-0000000000c7');
select throws_ok(
  $$ insert into clientes (nombre) values ('Cliente del contador') $$,
  '42501', null, 'el contador solo lee');

select * from finish();
rollback;
