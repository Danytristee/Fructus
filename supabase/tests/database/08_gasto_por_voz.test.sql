-- =============================================================================
-- Un gasto dictado se guarda una sola vez — pruebas pgTAP (npx supabase test db).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a8', 'ayudante8@fructus.test'),
  ('00000000-0000-0000-0000-0000000000c8', 'contador8@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000a8', 'Ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-0000000000c8', 'Contador', 'contador');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000a8');

insert into comandos_voz (transcripcion, intencion, resultado) values ('le di 50 al cargador', 'registrar_gasto', 'pendiente');

-- --- El caso feliz: el ayudante registra el gasto dictado --------------------------------
select lives_ok(
  $$ insert into gastos (categoria, monto, medio_pago, descripcion, comando_voz_id)
     values ('personal', 50, 'efectivo', 'cargador', (select id from comandos_voz where transcripcion like 'le di 50%')) $$,
  'el ayudante guarda un gasto dictado');

-- --- El segundo toque choca con el índice -------------------------------------------------
select throws_ok(
  $$ insert into gastos (categoria, monto, medio_pago, descripcion, comando_voz_id)
     values ('personal', 50, 'efectivo', 'cargador', (select id from comandos_voz where transcripcion like 'le di 50%')) $$,
  '23505', null, 'la base rechaza un segundo gasto con el mismo comando');
select is((select count(*)::int from gastos where descripcion = 'cargador'), 1, 'queda un solo gasto de 50, no dos');

-- --- Borde: la categoría es una de las cinco y el monto es más que cero ------------------------
select throws_ok($$ insert into gastos (categoria, monto) values ('almuerzo', 10) $$, '23514', null, 'una categoría que no existe se rechaza');
select throws_ok($$ insert into gastos (categoria, monto) values ('otros', 0) $$, '23514', null, 'un gasto de cero soles se rechaza');

-- --- Contador: solo lee -------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000c8');
select throws_ok($$ insert into gastos (categoria, monto) values ('otros', 10) $$, '42501', null, 'el contador no registra gastos');

select * from finish();
rollback;
