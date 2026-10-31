-- =============================================================================
-- Un abono dictado se guarda una sola vez — pruebas pgTAP (npx supabase test db).
-- Corre sobre la base local con supabase/seed.sql cargado: Luis Paredes = cliente 1.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a6', 'ayudante6@fructus.test'),
  ('00000000-0000-0000-0000-0000000000c6', 'contador6@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000a6', 'Ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-0000000000c6', 'Contador', 'contador');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

create temp table inicio as
select coalesce((select saldo from v_saldo_clientes where cliente_id = 1), 0) as deuda_lucho;
grant select on inicio to authenticated;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000a6');

insert into comandos_voz (transcripcion, intencion, resultado) values
  ('don lucho me dio 80 a cuenta', 'registrar_abono', 'pendiente');

-- --- El caso feliz: el ayudante registra el abono dictado -------------------------------
select lives_ok(
  $$ insert into abonos (cliente_id, monto, medio_pago, comando_voz_id)
     values (1, 80, 'efectivo', (select id from comandos_voz where transcripcion like 'don lucho me dio%')) $$,
  'el ayudante guarda un abono dictado');
select is((select saldo from v_saldo_clientes where cliente_id = 1), (select deuda_lucho - 80 from inicio), 'la deuda de don Lucho baja 80');

-- --- El segundo toque choca con el índice y no baja la deuda otra vez --------------------
select throws_ok(
  $$ insert into abonos (cliente_id, monto, medio_pago, comando_voz_id)
     values (1, 80, 'efectivo', (select id from comandos_voz where transcripcion like 'don lucho me dio%')) $$,
  '23505', null, 'la base rechaza un segundo abono con el mismo comando');
select is((select saldo from v_saldo_clientes where cliente_id = 1), (select deuda_lucho - 80 from inicio), 'la deuda bajó 80, no 160');
select lives_ok(
  $$ insert into abonos (cliente_id, monto, medio_pago) values (1, 10, 'yape') $$,
  'los abonos a mano (sin comando) no chocan entre sí');

-- --- Borde: un abono no es de nadie, ni de cero soles ---------------------------------------
select throws_ok($$ insert into abonos (monto, medio_pago) values (50, 'efectivo') $$, '23502', null, 'un abono sin cliente se rechaza');

-- --- Contador: solo lee -------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000c6');
select throws_ok($$ insert into abonos (cliente_id, monto, medio_pago) values (1, 20, 'efectivo') $$, '42501', null, 'el contador no registra abonos');

select * from finish();
rollback;
