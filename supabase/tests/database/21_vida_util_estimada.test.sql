-- =============================================================================
-- La vida útil estimada por la IA: solo la escribe el servidor, todos la leen y rige la última de cada fruta — pruebas pgTAP.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(15);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000d21', 'duenio21@fructus.test'),
  ('00000000-0000-0000-0000-000000000e21', 'administrador21@fructus.test'),
  ('00000000-0000-0000-0000-000000000a21', 'ayudante21@fructus.test'),
  ('00000000-0000-0000-0000-000000000c21', 'contador21@fructus.test'),
  ('00000000-0000-0000-0000-000000000f21', 'sinperfil21@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-000000000d21', 'Dueño', 'duenio'),
  ('00000000-0000-0000-0000-000000000e21', 'Administrador', 'administrador'),
  ('00000000-0000-0000-0000-000000000a21', 'Ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-000000000c21', 'Contador', 'contador');

insert into productos (nombre, variedad) values ('Pitahaya', 'prueba 21'), ('Lúcuma', 'prueba 21');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.fruta(p_nombre text) returns bigint language sql as $$
  select id from public.productos where nombre = p_nombre and variedad = 'prueba 21';
$$;

-- --- El caso feliz: el servidor guarda la estimación de la noche ----------------------------
select lives_ok(
  $$ insert into vida_util_estimada (producto_id, dia, dias, motivo, modelo)
     values (pg_temp.fruta('Pitahaya'), '2026-11-14', 9, 'Cáscara gruesa: aguanta bien.', 'claude-sonnet-5-5') $$,
  'el servidor guarda una estimación');

-- --- Borde: una por fruta y por día; cambiarla es guardar la de otro día, y rige la última ---
select throws_ok(
  $$ insert into vida_util_estimada (producto_id, dia, dias, motivo, modelo)
     values (pg_temp.fruta('Pitahaya'), '2026-11-14', 7, 'Otra de la misma noche.', 'claude-sonnet-5-5') $$,
  '23505', null, 'la misma fruta no tiene dos estimaciones del mismo día: repetir el envío no duplica');
insert into vida_util_estimada (producto_id, dia, dias, motivo, modelo)
  values (pg_temp.fruta('Pitahaya'), '2026-11-15', 8, 'Se vieron mermas antes de tiempo.', 'claude-sonnet-5-5');
select is((select dias from v_vida_util where producto_id = pg_temp.fruta('Pitahaya')), 8.0, 'rige la estimación del día más reciente');
select is((select count(*)::int from vida_util_estimada where producto_id = pg_temp.fruta('Pitahaya')), 2, 'la anterior queda guardada: solo se agregan');
select is((select count(*)::int from v_vida_util where producto_id = pg_temp.fruta('Lúcuma')), 0, 'una fruta sin estimación no aparece: sigue con la tabla');

-- --- Borde: días fuera de rango y motivo vacío -----------------------------------------------
select throws_ok(
  $$ insert into vida_util_estimada (producto_id, dia, dias, motivo, modelo) values (pg_temp.fruta('Lúcuma'), '2026-11-15', 0, 'Cero días.', 'm') $$,
  '23514', null, 'no acepta menos de un día');
select throws_ok(
  $$ insert into vida_util_estimada (producto_id, dia, dias, motivo, modelo) values (pg_temp.fruta('Lúcuma'), '2026-11-15', 400, 'Un año.', 'm') $$,
  '23514', null, 'no acepta más de 120 días');
select throws_ok(
  $$ insert into vida_util_estimada (producto_id, dia, dias, motivo, modelo) values (pg_temp.fruta('Lúcuma'), '2026-11-15', 9, '', 'm') $$,
  '23514', null, 'no acepta una estimación sin motivo');

set local role authenticated;

-- --- Todos los roles la leen: Stock cuenta con ella -----------------------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000a21');
select is((select dias from v_vida_util where producto_id = pg_temp.fruta('Pitahaya')), 8.0, 'el ayudante lee la estimación que rige');
select pg_temp.como('00000000-0000-0000-0000-000000000c21');
select is((select count(*)::int from vida_util_estimada where producto_id = pg_temp.fruta('Pitahaya')), 2, 'el contador lee el historial');
select pg_temp.como('00000000-0000-0000-0000-000000000f21');
select is((select count(*)::int from vida_util_estimada), 0, 'una cuenta sin perfil no lee nada');

-- --- Rechazo por rol: ni el dueño la escribe, la edita o la borra ---------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000d21');
select throws_ok(
  $$ insert into vida_util_estimada (producto_id, dia, dias, motivo, modelo) values (pg_temp.fruta('Lúcuma'), '2026-11-16', 30, 'A mano.', 'yo') $$,
  '42501', null, 'el dueño no puede escribir una estimación');
select throws_ok(
  $$ update vida_util_estimada set dias = 30 where producto_id = pg_temp.fruta('Pitahaya') $$,
  '42501', null, 'ni editar una que ya está');

select throws_ok(
  $$ update v_vida_util set dias = 30 where producto_id = pg_temp.fruta('Pitahaya') $$,
  null, null, 'ni por la vista de lo que rige');
select isnt((select creado_en from v_vida_util where producto_id = pg_temp.fruta('Pitahaya')), null, 'lo que rige dice cuándo se guardó: lo que pase después es evidencia nueva');

select * from finish();
rollback;
