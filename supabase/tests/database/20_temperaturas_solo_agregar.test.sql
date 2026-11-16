-- =============================================================================
-- Las lecturas de temperatura solo se agregan: nadie las edita ni las borra por la API — pruebas pgTAP.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000d20', 'duenio20@fructus.test'),
  ('00000000-0000-0000-0000-000000000e20', 'administrador20@fructus.test'),
  ('00000000-0000-0000-0000-000000000a20', 'ayudante20@fructus.test'),
  ('00000000-0000-0000-0000-000000000c20', 'contador20@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-000000000d20', 'Dueño', 'duenio'),
  ('00000000-0000-0000-0000-000000000e20', 'Administrador', 'administrador'),
  ('00000000-0000-0000-0000-000000000a20', 'Ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-000000000c20', 'Contador', 'contador');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- --- El caso feliz: los tres que registran siguen pudiendo anotar ---------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000d20');
select lives_ok($$ insert into temperaturas (grados) values (36) $$, 'el dueño anota una lectura');
select pg_temp.como('00000000-0000-0000-0000-000000000e20');
select lives_ok($$ insert into temperaturas (grados) values (35) $$, 'el administrador anota una lectura');
select pg_temp.como('00000000-0000-0000-0000-000000000a20');
select lives_ok($$ insert into temperaturas (grados) values (34) $$, 'el ayudante anota una lectura');

-- --- Rechazo por rol: ni el dueño edita o borra lo anotado. Antes podía, por la API ---------
select pg_temp.como('00000000-0000-0000-0000-000000000d20');
select throws_ok($$ update temperaturas set grados = 20 where grados = 36 $$, '42501', null, 'el dueño no puede editar una lectura');
select throws_ok($$ delete from temperaturas where grados = 36 $$, '42501', null, 'el dueño no puede borrar una lectura');
select pg_temp.como('00000000-0000-0000-0000-000000000e20');
select throws_ok($$ delete from temperaturas where grados = 35 $$, '42501', null, 'el administrador tampoco');
select pg_temp.como('00000000-0000-0000-0000-000000000c20');
select throws_ok($$ insert into temperaturas (grados) values (25) $$, '42501', null, 'el contador sigue sin poder anotar');
select is((select count(*)::int from temperaturas where grados in (34, 35, 36)), 3, 'el contador lee las tres lecturas, intactas');

-- --- Borde: corregir sigue siendo anotar otra, y vale la última del día ---------------------
select pg_temp.como('00000000-0000-0000-0000-000000000d20');
insert into temperaturas (grados) values (33);
select is((select grados from v_temperatura_dia where dia = (now() at time zone 'America/Lima')::date), 33.0, 'la corrección se anota como otra lectura y es la del día');

-- --- Sin sesión no se toca la tabla -------------------------------------------------------
reset role;
select ok(not has_table_privilege('anon', 'public.temperaturas', 'update') and not has_table_privilege('anon', 'public.temperaturas', 'delete'),
  'sin sesión no hay permiso de editar ni borrar');

select * from finish();
rollback;
