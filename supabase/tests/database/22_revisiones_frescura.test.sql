-- =============================================================================
-- «Sigue buena»: revisiones de una llegada que pasó su día — pruebas pgTAP.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000d22', 'duenio22@fructus.test'),
  ('00000000-0000-0000-0000-000000000e22', 'administrador22@fructus.test'),
  ('00000000-0000-0000-0000-000000000a22', 'ayudante22@fructus.test'),
  ('00000000-0000-0000-0000-000000000c22', 'contador22@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-000000000d22', 'Dueño', 'duenio'),
  ('00000000-0000-0000-0000-000000000e22', 'Administrador', 'administrador'),
  ('00000000-0000-0000-0000-000000000a22', 'Ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-000000000c22', 'Contador', 'contador');

insert into productos (nombre, variedad) values ('Pitahaya', 'prueba 22');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.fruta() returns bigint language sql as $$
  select id from public.productos where nombre = 'Pitahaya' and variedad = 'prueba 22';
$$;
create function pg_temp.hoy() returns date language sql as $$
  select (now() at time zone 'America/Lima')::date;
$$;

-- Las llegadas de la fruta: hace 6 días llegaron cajas maduras y otras sin decir cómo; hace 9 y hace 3, sin decir cómo.
-- La base no acepta fechas de hace más de 48 horas al insertar: entran hoy y se mueven.
create function pg_temp.llegaron(p_dias int, p_estado estado_llegada default null) returns void language plpgsql as $$
declare v_id bigint;
begin
  insert into public.movimientos_stock (producto_id, tipo, cantidad, motivo, estado_llegada, registrado_por)
  values (pg_temp.fruta(), 'ajuste', 5, 'prueba 22', p_estado, '00000000-0000-0000-0000-000000000d22') returning id into v_id;
  update public.movimientos_stock set fecha = ((pg_temp.hoy() - p_dias)::timestamp + interval '10 hours') at time zone 'America/Lima' where id = v_id;
end $$;
select pg_temp.llegaron(6, 'maduro');
select pg_temp.llegaron(6);
select pg_temp.llegaron(9);
select pg_temp.llegaron(3);

set local role authenticated;

-- --- El caso feliz: los tres que registran anotan que una llegada sigue buena -----------------
select pg_temp.como('00000000-0000-0000-0000-000000000d22');
select lives_ok(
  $$ insert into revisiones_frescura (producto_id, llegada_dia, llegada_estado) values (pg_temp.fruta(), pg_temp.hoy() - 6, 'maduro') $$,
  'el dueño anota que la llegada madura de hace 6 días sigue buena');
select is((select dia from revisiones_frescura where producto_id = pg_temp.fruta() and llegada_estado = 'maduro'), pg_temp.hoy(), 'queda con el día de Lima de hoy');
select is((select registrado_por from revisiones_frescura where producto_id = pg_temp.fruta() and llegada_estado = 'maduro'),
  '00000000-0000-0000-0000-000000000d22'::uuid, 'y con quién la revisó');
select pg_temp.como('00000000-0000-0000-0000-000000000a22');
select lives_ok(
  $$ insert into revisiones_frescura (producto_id, llegada_dia) values (pg_temp.fruta(), pg_temp.hoy() - 6) $$,
  'el ayudante anota otra llegada del mismo día (no se dijo cómo llegó): es otra llegada');
select pg_temp.como('00000000-0000-0000-0000-000000000e22');
select lives_ok(
  $$ insert into revisiones_frescura (producto_id) values (pg_temp.fruta()) $$,
  'el administrador anota las cajas de hace más de 45 días (sin día de llegada)');

-- --- Borde: una por llegada y por día, también cuando no se sabe el día de llegada ------------
select throws_ok(
  $$ insert into revisiones_frescura (producto_id, llegada_dia, llegada_estado) values (pg_temp.fruta(), pg_temp.hoy() - 6, 'maduro') $$,
  '23505', null, 'el doble toque no deja dos revisiones de la misma llegada');
select throws_ok(
  $$ insert into revisiones_frescura (producto_id) values (pg_temp.fruta()) $$,
  '23505', null, 'tampoco de las cajas sin día de llegada');

-- --- Borde: la revisión es de hoy, y la llegada no puede ser del futuro -----------------------
select throws_ok(
  $$ insert into revisiones_frescura (producto_id, llegada_dia, dia) values (pg_temp.fruta(), pg_temp.hoy() - 3, pg_temp.hoy() + 1) $$,
  '42501', null, 'no se anota una revisión con fecha de mañana: callaría el aviso sin mirar la fruta');
select throws_ok(
  $$ insert into revisiones_frescura (producto_id, llegada_dia) values (pg_temp.fruta(), pg_temp.hoy() + 3) $$,
  '23514', null, 'una llegada no puede ser de después de la revisión');
select throws_ok(
  $$ insert into revisiones_frescura (producto_id, llegada_dia, registrado_por) values (pg_temp.fruta(), pg_temp.hoy() - 9, '00000000-0000-0000-0000-000000000d22') $$,
  '42501', null, 'nadie anota una revisión a nombre de otro');

-- --- Borde: la revisión es de una llegada que existe (/chaos 2026-11-16) -----------------------
select pg_temp.como('00000000-0000-0000-0000-000000000a22');
select throws_ok(
  $$ insert into revisiones_frescura (producto_id, llegada_dia) values (pg_temp.fruta(), pg_temp.hoy() - 40) $$,
  '23514', null, 'no se anota la revisión de un día en que no llegó nada de esa fruta');
select throws_ok(
  $$ insert into revisiones_frescura (producto_id, llegada_dia, llegada_estado) values (pg_temp.fruta(), pg_temp.hoy() - 9, 'verde') $$,
  '23514', null, 'ni de una llegada que ese día no llegó así (llegó sin decir cómo, no verde)');
select throws_ok(
  $$ insert into revisiones_frescura (producto_id, llegada_dia) values ((select id from productos where id <> pg_temp.fruta() limit 1), pg_temp.hoy() - 9) $$,
  '23514', null, 'ni con la llegada de otra fruta');

-- --- Rechazo por rol --------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000c22');
select throws_ok(
  $$ insert into revisiones_frescura (producto_id, llegada_dia) values (pg_temp.fruta(), pg_temp.hoy() - 3) $$,
  '42501', null, 'el contador no puede anotar una revisión');
select is((select count(*)::int from revisiones_frescura where producto_id = pg_temp.fruta()), 3, 'pero lee las tres');
select pg_temp.como('00000000-0000-0000-0000-000000000d22');
select throws_ok(
  $$ delete from revisiones_frescura where producto_id = pg_temp.fruta() $$,
  '42501', null, 'ni el dueño borra una revisión');
select throws_ok(
  $$ update revisiones_frescura set llegada_dia = pg_temp.hoy() where producto_id = pg_temp.fruta() $$,
  '42501', null, 'ni la edita');

select * from finish();
rollback;
