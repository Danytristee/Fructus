-- =============================================================================
-- La temperatura del puesto: una lectura por comando, la última del día manda — pruebas pgTAP (npx supabase test db).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a18', 'ayudante18@fructus.test'),
  ('00000000-0000-0000-0000-000000000c18', 'contador18@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-000000000a18', 'Ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-000000000c18', 'Contador', 'contador');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- El día de Lima de «ahora», para leer la vista. La semilla puede traer lecturas de otros días: aquí solo se mira hoy.
create function pg_temp.hoy() returns date language sql as $$ select (now() at time zone 'America/Lima')::date $$;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-000000000a18');

insert into comandos_voz (transcripcion, intencion, resultado) values ('hoy hizo 29 grados', 'registrar_temperatura', 'pendiente');

-- --- El caso feliz: el ayudante anota lo que marca el termómetro ---------------------------
select lives_ok(
  $$ insert into temperaturas (grados, comando_voz_id) values (29, (select id from comandos_voz where transcripcion = 'hoy hizo 29 grados')) $$,
  'el ayudante anota la temperatura dictada');
select is((select grados from v_temperatura_dia where dia = pg_temp.hoy()), 29.0, 'la temperatura de hoy es la que se anotó');

-- --- El segundo toque choca con el índice -------------------------------------------------
select throws_ok(
  $$ insert into temperaturas (grados, comando_voz_id) values (29, (select id from comandos_voz where transcripcion = 'hoy hizo 29 grados')) $$,
  '23505', null, 'la base rechaza una segunda lectura con el mismo comando');

-- --- Corregir es anotar otra: vale la última del día, y la primera no se pierde -------------
select lives_ok($$ insert into temperaturas (grados) values (31.5) $$, 'se anota otra lectura a mano el mismo día');
select is((select grados from v_temperatura_dia where dia = pg_temp.hoy()), 31.5, 'la temperatura del día es la última lectura');
select is((select count(*)::int from temperaturas where (fecha at time zone 'America/Lima')::date = pg_temp.hoy()), 2, 'las dos lecturas quedan guardadas');

-- --- Borde: un número que no es clima se rechaza ----------------------------------------------
select throws_ok($$ insert into temperaturas (grados) values (290) $$, '23514', null, '290 grados se rechaza');
select throws_ok($$ insert into temperaturas (grados) values (-3) $$, '23514', null, 'una temperatura bajo cero se rechaza');

-- --- Borde: una fecha que no es creíble (una semana atrás) se cambia por la del servidor (ADR-0019) ---
insert into temperaturas (grados, fecha) values (20, now() - interval '7 days');
select is((select count(*)::int from temperaturas where grados = 20 and fecha > now() - interval '1 minute'), 1, 'una fecha de hace una semana no se acepta: queda la del servidor');

-- --- El ayudante registra, pero no cambia lo anotado (un update sin permiso no toca filas) ----
update temperaturas set grados = 10 where grados = 31.5;
select is((select count(*)::int from temperaturas where grados = 31.5), 1, 'el ayudante no puede cambiar una lectura ya anotada');

-- --- Contador: solo lee -------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000c18');
select throws_ok($$ insert into temperaturas (grados) values (25) $$, '42501', null, 'el contador no anota temperaturas');

select * from finish();
rollback;
