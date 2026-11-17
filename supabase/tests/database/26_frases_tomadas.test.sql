-- =============================================================================
-- «Hola Fructus» con dos celulares: la misma frase se toma una sola vez (ADR-0022, /chaos 2026-11-16 hallazgo 1) — pruebas pgTAP.
-- Una venta dicha en voz alta la oyen todos los celulares que escuchan en el puesto: solo el primero abre su tarjeta. No depende del
-- catálogo cargado.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d2', 'duenio26@fructus.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'ayudante26@fructus.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'contador26@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000d2', 'Dueño', 'duenio'),
  ('00000000-0000-0000-0000-0000000000a2', 'Ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-0000000000c2', 'Contador', 'contador');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- --- Caso feliz: el primer celular toma la frase ----------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000d2');
select is(tomar_frase('vendí diez cajas de mango a don Lucho, lo debe.', 'celular-del-duenio'), true,
  'el celular del dueño toma la venta que oyó');

-- --- Rechazo: el otro celular oyó lo mismo (Whisper lo escribe un poco distinto) --------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
select is(tomar_frase('Vendí 10 cajas de mango a don Lucho, lo debe', 'celular-del-ayudante'), false,
  'el celular del ayudante, que oyó la misma venta, no abre otra tarjeta');
select pg_temp.como('00000000-0000-0000-0000-0000000000d2');
select is(tomar_frase('vendí diez cajas de mango a don Lucho, lo debe.', 'otro-celular-del-duenio'), false,
  'tampoco otro celular con la misma cuenta');

-- --- Casos borde ---------------------------------------------------------------------------------------------------------------
select is(tomar_frase('vendí diez cajas de mango a don Lucho, lo debe.', 'celular-del-duenio'), true,
  'el mismo celular sí la repite (descartó la tarjeta y la dice otra vez)');
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
select is(tomar_frase('se malograron tres cajas de papaya', 'celular-del-ayudante'), true,
  'otra cosa dicha en el otro celular sí abre su tarjeta');

-- Pasaron los 10 s: la misma venta dicha otra vez es otra venta. (Se corre la hora como dueño de la tabla, no como la app.)
reset role;
update frases_tomadas set tomada_en = tomada_en - interval '11 seconds';
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
select is(tomar_frase('vendí diez cajas de mango a don Lucho, lo debe', 'celular-del-ayudante'), true,
  'pasados 10 s, la misma venta en otro celular ya es otra venta');

select throws_ok($$ select tomar_frase('', 'celular-del-ayudante') $$, 'P0001', null, 'sin frase no se toma nada');

-- --- Rechazo por rol: el contador solo lee ----------------------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000c2');
select throws_ok($$ select tomar_frase('vendí cinco cajas de uva', 'celular-del-contador') $$, '42501', null, 'el contador no toma frases');

-- --- Nadie toca la tabla directo: solo tomar_frase -------------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000d2');
select is((select count(*)::int from frases_tomadas), 0, 'la app no lee las frases tomadas (RLS sin políticas)');
select throws_ok($$ insert into frases_tomadas (frase, celular) values ('a mano', 'celular-a-mano') $$, '42501', null,
  'ni las escribe a mano');

reset role;
select ok(not has_function_privilege('anon', 'public.tomar_frase(text, text)', 'execute'), 'sin sesión no se ejecuta');

select * from finish();
rollback;
