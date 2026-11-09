-- =============================================================================
-- Aviso del día por Web Push: la tabla de suscripciones es solo del servidor (npx supabase test db).
-- Una dirección de aviso es como una llave de ese teléfono: nadie con sesión (ni el dueño) la lee ni la escribe desde el navegador;
-- solo el servidor. Y la tabla no deja guardar contradicciones: dirección que no es https, claves rotas, o «activa» con fecha de baja.
-- Todo ocurre dentro de una transacción que se deshace al final.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d7', 'duenio7@fructus.test'),
  ('00000000-0000-0000-0000-0000000000a7', 'ayudante7@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000d7', 'Dueño',    'duenio'),
  ('00000000-0000-0000-0000-0000000000a7', 'Ayudante', 'ayudante');

-- Claves con la forma real: 87 caracteres la pública (65 bytes) y 22 el secreto (16 bytes), en base64url.
create temp table claves as
select 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM'::text as p256dh,
       'tBHItJI5svbpez7KI4CCXg'::text as auth;
grant select on claves to service_role, authenticated, anon;

-- 1 · RLS activada: sin políticas, nadie con sesión ve ni toca filas.
select ok((select relrowsecurity from pg_class where oid = 'public.suscripciones_push'::regclass), 'la tabla tiene RLS activada');
select is((select count(*)::int from pg_policy where polrelid = 'public.suscripciones_push'::regclass), 0, 'y no tiene políticas: solo el servidor la toca');

-- 2 · El servidor guarda una suscripción (el caso feliz).
set local role service_role;
select lives_ok(
  $$insert into suscripciones_push (usuario_id, endpoint, clave_p256dh, clave_auth)
    select '00000000-0000-0000-0000-0000000000d7', 'https://fcm.googleapis.com/fcm/send/prueba-dueno', p256dh, auth from claves$$,
  'el servidor guarda la suscripción de un teléfono');
select is((select activa from suscripciones_push where endpoint = 'https://fcm.googleapis.com/fcm/send/prueba-dueno'), true, 'nace activa');
reset role;

-- 3 · Nadie con sesión la lee ni la escribe, ni el dueño: ni un select ni un insert.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000d7', 'role', 'authenticated')::text, true);
select throws_ok($$select * from suscripciones_push$$, '42501', null, 'el dueño con sesión no la lee desde el navegador');
select throws_ok(
  $$insert into suscripciones_push (usuario_id, endpoint, clave_p256dh, clave_auth)
    select '00000000-0000-0000-0000-0000000000d7', 'https://fcm.googleapis.com/fcm/send/otra', p256dh, auth from claves$$,
  '42501', null, 'ni guarda una suscripción por su cuenta: la regla de qué direcciones se aceptan está en el servidor');
select throws_ok($$update suscripciones_push set activa = false$$, '42501', null, 'ni la desactiva');
reset role;

set local role anon;
select throws_ok($$select * from suscripciones_push$$, '42501', null, 'sin sesión tampoco');
reset role;

-- 4 · Una dirección es de un solo teléfono (la misma no se guarda dos veces).
set local role service_role;
select throws_ok(
  $$insert into suscripciones_push (usuario_id, endpoint, clave_p256dh, clave_auth)
    select '00000000-0000-0000-0000-0000000000a7', 'https://fcm.googleapis.com/fcm/send/prueba-dueno', p256dh, auth from claves$$,
  '23505', null, 'la misma dirección no se guarda dos veces');

-- Si otra persona entra en ese mismo teléfono, la suscripción pasa a ser de ella (el upsert del servidor).
select lives_ok(
  $$insert into suscripciones_push (usuario_id, endpoint, clave_p256dh, clave_auth)
    select '00000000-0000-0000-0000-0000000000a7', 'https://fcm.googleapis.com/fcm/send/prueba-dueno', p256dh, auth from claves
    on conflict (endpoint) do update set usuario_id = excluded.usuario_id, activa = true, desactivada_en = null$$,
  'el upsert del servidor pasa la suscripción a quien entró en ese teléfono');
select is((select usuario_id from suscripciones_push where endpoint = 'https://fcm.googleapis.com/fcm/send/prueba-dueno'),
          '00000000-0000-0000-0000-0000000000a7'::uuid, 'y ahora es del ayudante');

-- 5 · Cero estados imposibles.
select throws_ok(
  $$insert into suscripciones_push (usuario_id, endpoint, clave_p256dh, clave_auth)
    select '00000000-0000-0000-0000-0000000000d7', 'http://fcm.googleapis.com/fcm/send/sin-https', p256dh, auth from claves$$,
  '23514', null, 'una dirección que no es https no se guarda');
select throws_ok(
  $$insert into suscripciones_push (usuario_id, endpoint, clave_p256dh, clave_auth)
    values ('00000000-0000-0000-0000-0000000000d7', 'https://fcm.googleapis.com/fcm/send/claves-rotas', 'corta', 'x')$$,
  '23514', null, 'unas claves que no tienen la forma de las del navegador no se guardan');
select throws_ok(
  $$insert into suscripciones_push (usuario_id, endpoint, clave_p256dh, clave_auth, activa, desactivada_en)
    select '00000000-0000-0000-0000-0000000000d7', 'https://fcm.googleapis.com/fcm/send/activa-con-baja', p256dh, auth, true, now() from claves$$,
  '23514', null, 'una suscripción activa no puede traer fecha de baja');
select throws_ok(
  $$insert into suscripciones_push (usuario_id, endpoint, clave_p256dh, clave_auth, activa)
    select '00000000-0000-0000-0000-0000000000d7', 'https://fcm.googleapis.com/fcm/send/baja-sin-fecha', p256dh, auth, false from claves$$,
  '23514', null, 'ni una desactivada sin su fecha');
select lives_ok(
  $$update suscripciones_push set activa = false, desactivada_en = now(), ultimo_error = '410' where usuario_id = '00000000-0000-0000-0000-0000000000a7'$$,
  'desactivar con su fecha sí se puede (nunca se borra)');
reset role;

select * from finish();
rollback;
