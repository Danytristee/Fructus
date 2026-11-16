-- =============================================================================
-- Cada merma con el stock que había justo antes (v_mermas_con_stock) — pruebas pgTAP.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000d23', 'duenio23@fructus.test'),
  ('00000000-0000-0000-0000-000000000c23', 'contador23@fructus.test'),
  ('00000000-0000-0000-0000-000000000f23', 'sinperfil23@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-000000000d23', 'Dueño', 'duenio'),
  ('00000000-0000-0000-0000-000000000c23', 'Contador', 'contador');

insert into productos (nombre, variedad) values ('Pitahaya', 'prueba 23'), ('Lúcuma', 'prueba 23');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.fruta(p_nombre text) returns bigint language sql as $$
  select id from public.productos where nombre = p_nombre and variedad = 'prueba 23';
$$;
-- Un movimiento de hace `p_horas` horas (dentro de las 48 que la base acepta como fecha del celular).
create function pg_temp.mover(p_nombre text, p_tipo tipo_movimiento, p_cajas numeric, p_horas numeric) returns void language sql as $$
  insert into public.movimientos_stock (producto_id, tipo, cantidad, motivo, fecha, registrado_por)
  values (pg_temp.fruta(p_nombre), p_tipo, p_cajas, 'prueba 23', now() - make_interval(secs => p_horas * 3600), '00000000-0000-0000-0000-000000000d23');
$$;

-- Pitahaya: entran 10, salen 3, se malogran 2, entran 5, se malogra 1. Lúcuma: entran 4 y se malogra 1 (no se mezcla).
select pg_temp.mover('Pitahaya', 'ajuste', 10, 40);
select pg_temp.mover('Pitahaya', 'ajuste', -3, 30);
select pg_temp.mover('Pitahaya', 'merma', -2, 20);
select pg_temp.mover('Pitahaya', 'ajuste', 5, 10);
select pg_temp.mover('Pitahaya', 'merma', -1, 5);
select pg_temp.mover('Lúcuma', 'ajuste', 4, 25);
select pg_temp.mover('Lúcuma', 'merma', -1, 15);

-- --- El caso feliz: cada merma con lo que había justo antes -----------------------------------
select is((select count(*)::int from v_mermas_con_stock where producto_id = pg_temp.fruta('Pitahaya')), 2, 'salen las dos mermas de la fruta, y nada más');
select results_eq(
  $$ select cajas, stock_antes from v_mermas_con_stock where producto_id = pg_temp.fruta('Pitahaya') order by fecha $$,
  $$ values (2.00::numeric, 7::numeric), (1.00::numeric, 10::numeric) $$,
  'las cajas en positivo, y el stock de antes cuenta entradas, salidas y mermas anteriores (no las de después)');
select is((select stock_antes from v_mermas_con_stock where producto_id = pg_temp.fruta('Lúcuma')), 4::numeric, 'cada fruta suma solo lo suyo');

-- --- Borde: dos mermas en el mismo instante — la segunda ya cuenta la primera -----------------
insert into movimientos_stock (producto_id, tipo, cantidad, motivo, fecha, registrado_por)
select pg_temp.fruta('Lúcuma'), 'merma', -1, 'prueba 23', t, '00000000-0000-0000-0000-000000000d23'
from (select now() - interval '2 hours' as t) x, generate_series(1, 2);
select results_eq(
  $$ select stock_antes from v_mermas_con_stock where producto_id = pg_temp.fruta('Lúcuma') order by fecha, id offset 1 $$,
  $$ values (3::numeric), (2::numeric) $$,
  'con la misma hora manda el orden en que se guardaron');

-- --- Borde: una merma sin nada antes (se registró más de lo que la app contaba) ----------------
insert into productos (nombre, variedad) values ('Sachatomate', 'prueba 23');
select pg_temp.mover('Sachatomate', 'merma', -2, 1);
select is((select stock_antes from v_mermas_con_stock where producto_id = pg_temp.fruta('Sachatomate')), 0::numeric, 'sin movimientos antes, había cero');

set local role authenticated;

-- --- Quién la lee: lo mismo que los movimientos (la vista corre con los permisos de quien pregunta) --
select pg_temp.como('00000000-0000-0000-0000-000000000c23');
select is((select count(*)::int from v_mermas_con_stock where producto_id = pg_temp.fruta('Pitahaya')), 2, 'el contador la lee');
select pg_temp.como('00000000-0000-0000-0000-000000000f23');
select is((select count(*)::int from v_mermas_con_stock), 0, 'una cuenta sin perfil no ve ninguna merma');

-- --- Es solo para leer: ni el dueño edita un movimiento a través de la vista -------------------
select pg_temp.como('00000000-0000-0000-0000-000000000d23');
select throws_ok(
  $$ update v_mermas_con_stock set fecha = now() where producto_id = pg_temp.fruta('Pitahaya') $$,
  '42501', null, 'la vista no deja editar los movimientos');

select * from finish();
rollback;
