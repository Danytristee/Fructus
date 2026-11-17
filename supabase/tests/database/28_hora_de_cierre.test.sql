-- =============================================================================
-- La hora de cierre del puesto la elige el dueño (ADR-0023) — pruebas pgTAP.
-- Una sola fila, la lee quien tiene sesión, la cambian solo el dueño y el administrador, y deja la firma de quien la cambió.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d3', 'duenio28@fructus.test'),
  ('00000000-0000-0000-0000-0000000000b3', 'admin28@fructus.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'ayudante28@fructus.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'contador28@fructus.test'),
  ('00000000-0000-0000-0000-0000000000e3', 'inactivo28@fructus.test');
insert into perfiles (id, nombre, rol, activo) values
  ('00000000-0000-0000-0000-0000000000d3', 'Dueño', 'duenio', true),
  ('00000000-0000-0000-0000-0000000000b3', 'Administradora', 'administrador', true),
  ('00000000-0000-0000-0000-0000000000a3', 'Ayudante', 'ayudante', true),
  ('00000000-0000-0000-0000-0000000000c3', 'Contador', 'contador', true),
  ('00000000-0000-0000-0000-0000000000e3', 'Exayudante', 'ayudante', false);

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- --- La fila nace con la hora de siempre ---------------------------------------------------------------------------------------
select is((select count(*)::int from ajustes_puesto), 1, 'hay una sola fila de ajustes del puesto');
select is((select hora_cierre::int from ajustes_puesto), 19, 'nace con las 7 p. m., la hora que ya tenía el aviso');
select throws_ok($$ insert into ajustes_puesto (id) values (false) $$, '23514', null, 'no puede haber una segunda fila');

set local role authenticated;

-- --- Caso feliz: el dueño la cambia y queda su firma -----------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000d3');
select is(fijar_hora_cierre(15::smallint)::int, 15, 'el dueño la pone a las 3 p. m.');
select is((select hora_cierre::int from ajustes_puesto), 15, 'y queda guardada');
select is((select actualizado_por from ajustes_puesto), '00000000-0000-0000-0000-0000000000d3'::uuid, 'con la firma del dueño');

select pg_temp.como('00000000-0000-0000-0000-0000000000b3');
select is(fijar_hora_cierre(21::smallint)::int, 21, 'la administradora también puede');

-- --- Rechazo por rol: los demás la leen pero no la cambian -----------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a3');
select is((select hora_cierre::int from ajustes_puesto), 21, 'el ayudante la lee (la fila del aviso dice la hora)');
select throws_ok($$ select fijar_hora_cierre(9::smallint) $$, '42501', null, 'el ayudante no la cambia: se rechaza, no pasa en silencio');
select throws_ok($$ update ajustes_puesto set hora_cierre = 9 $$, '42501', null, 'ni con un update directo');

select pg_temp.como('00000000-0000-0000-0000-0000000000c3');
select throws_ok($$ select fijar_hora_cierre(9::smallint) $$, '42501', null, 'el contador tampoco');

select pg_temp.como('00000000-0000-0000-0000-0000000000e3');
select is((select count(*)::int from ajustes_puesto), 0, 'una cuenta desactivada no la lee');

-- --- Caso borde: fuera de las horas que se pueden elegir -------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000d3');
select throws_ok($$ select fijar_hora_cierre(3::smallint) $$, '22023', null, 'las 3 a. m. no es una hora de cierre');

select * from finish();
rollback;
