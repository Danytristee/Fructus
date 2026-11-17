-- =============================================================================
-- El aviso del día sale a la hora y al minuto que elige el dueño (ADR-0024) — pruebas pgTAP.
-- El minuto de cierre, el reloj de la base (llama una vez, con una ficha que vence) y el día que se reclama una sola vez.
-- Los momentos van fijos (p_ahora): la prueba da lo mismo a cualquier hora en que se corra.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d4', 'duenio29@fructus.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'ayudante29@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000d4', 'Dueño', 'duenio'),
  ('00000000-0000-0000-0000-0000000000a4', 'Ayudante', 'ayudante');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- --- El minuto de cierre -------------------------------------------------------------------------------------------------------
select is((select minuto_cierre::int from ajustes_puesto), 0, 'nace en punto: las 7:00 p. m. de siempre');

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000d4');
select is(fijar_hora_cierre(16::smallint, 30::smallint)::int, 16, 'el dueño elige las 4:30 p. m.');
select is((select hora_cierre::int * 100 + minuto_cierre from ajustes_puesto), 1630, 'y quedan la hora y el minuto');
select throws_ok($$ select fijar_hora_cierre(16::smallint, 37::smallint) $$, '22023', null, 'los minutos van de 5 en 5: 4:37 no');
select throws_ok($$ select fijar_hora_cierre(16::smallint, 60::smallint) $$, '22023', null, 'ni 60 minutos');
select is(fijar_hora_cierre(p_hora => 17::smallint)::int, 17, 'sin minuto (la app de antes) sigue funcionando');
select is((select minuto_cierre::int from ajustes_puesto), 0, '… y es en punto');

select pg_temp.como('00000000-0000-0000-0000-0000000000a4');
select throws_ok($$ select fijar_hora_cierre(16::smallint, 30::smallint) $$, '42501', null, 'el ayudante no la cambia');

-- --- El reloj es solo del servidor --------------------------------------------------------------------------------------------
select throws_ok($$ select * from aviso_del_dia $$, '42501', null, 'nadie con sesión lee la ficha del aviso');
select throws_ok($$ select reclamar_resumen_del_dia() $$, '42501', null, 'ni puede reclamar el día');
select throws_ok($$ select llamar_al_aviso_del_dia() $$, '42501', null, 'ni hacer sonar el reloj');
reset role;

-- --- ya_es_hora_de_cierre: compara la hora de Lima con la hora y el minuto ------------------------------------------------------
update ajustes_puesto set hora_cierre = 16, minuto_cierre = 30;
select is(ya_es_hora_de_cierre('2026-11-17 21:29:59+00'), false, '4:29:59 p. m. en Lima: todavía no');
select is(ya_es_hora_de_cierre('2026-11-17 21:30:00+00'), true, '4:30 p. m. en Lima: ya es la hora');

-- --- El reloj: sin dirección no llama a nadie; con dirección, llama una vez por ficha -------------------------------------------
update aviso_del_dia set url = null, ficha = null, ficha_vence = null, reclamado_dia = null;
select llamar_al_aviso_del_dia('2026-11-17 21:31:00+00');
select is((select ficha from aviso_del_dia), null, 'sin dirección de la app, el reloj no hace nada (local y CI)');

update aviso_del_dia set url = 'https://fructus.example.com';
select llamar_al_aviso_del_dia('2026-11-17 21:20:00+00');
select is((select ficha from aviso_del_dia), null, 'antes de las 4:30 no llama');

select llamar_al_aviso_del_dia('2026-11-17 21:31:00+00');
select ok((select ficha ~ '^[0-9a-f]{64}$' from aviso_del_dia), 'a las 4:31 crea una ficha de un solo uso');
select is((select count(*)::int from net.http_request_queue where url = 'https://fructus.example.com/api/cron/resumen-diario'), 1,
  'y deja encolada la llamada a la ruta del aviso');

create temp table ficha_1 as select ficha from aviso_del_dia;
select llamar_al_aviso_del_dia('2026-11-17 21:32:00+00');
select is((select ficha from aviso_del_dia), (select ficha from ficha_1), 'con una llamada en curso no llama otra vez');

-- --- Reclamar el día: con la ficha vigente pasa una vez -------------------------------------------------------------------------
select is(reclamar_resumen_del_dia('0000000000000000000000000000000000000000000000000000000000000000', '2026-11-17 21:32:00+00'),
  'ficha-invalida', 'una ficha que no es la vigente no reclama nada');
select is(reclamar_resumen_del_dia((select ficha from ficha_1), '2026-11-17 21:32:00+00'), 'reclamado', 'la ficha vigente reclama el día');
select is(reclamar_resumen_del_dia(null, '2026-11-17 22:05:00+00'), 'ya-avisado', 'el cron de Vercel de las 5 ya no avisa otra vez');

select llamar_al_aviso_del_dia('2026-11-17 22:40:00+00');
select is((select ficha from aviso_del_dia), null, 'el día ya avisado, el reloj no vuelve a llamar');

-- --- Sin ficha (cron de Vercel) solo a partir de la hora; al día siguiente, otra vez -----------------------------------------------
select is(reclamar_resumen_del_dia(null, '2026-11-18 20:05:00+00'), 'temprano', 'al día siguiente a las 3:05 p. m., todavía no');
select is(reclamar_resumen_del_dia(null, '2026-11-18 22:05:00+00'), 'reclamado', 'a las 5:05 p. m. el cron de Vercel lo reclama (respaldo)');

select * from finish();
rollback;
