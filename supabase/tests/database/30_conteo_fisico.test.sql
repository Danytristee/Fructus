-- =============================================================================
-- Conteo físico con ajuste (ADR-0027) — pruebas pgTAP.
-- Se registra lo contado; la base calcula la diferencia con el stock de ese instante y, si no cuadra, la deja como merma (se malogró)
-- o ajuste. Cuentan dueño, administrador y ayudante; el contador no. Nadie inserta un ajuste directo.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(31);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000d30', 'duenio30@fructus.test'),
  ('00000000-0000-0000-0000-000000000b30', 'admin30@fructus.test'),
  ('00000000-0000-0000-0000-000000000a30', 'ayudante30@fructus.test'),
  ('00000000-0000-0000-0000-000000000a31', 'otroayudante30@fructus.test'),
  ('00000000-0000-0000-0000-000000000c30', 'contador30@fructus.test');
insert into perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-000000000d30', 'Dueño', 'duenio'),
  ('00000000-0000-0000-0000-000000000b30', 'Administradora', 'administrador'),
  ('00000000-0000-0000-0000-000000000a30', 'Ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-000000000a31', 'Otro ayudante', 'ayudante'),
  ('00000000-0000-0000-0000-000000000c30', 'Contador', 'contador');

insert into productos (nombre, variedad) values ('Pitahaya', 'prueba 30'), ('Lúcuma', 'prueba 30'), ('Aguaymanto', 'prueba 30');
insert into productos (nombre, variedad, activo) values ('Camu camu', 'prueba 30', false);

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.fruta(p_nombre text) returns bigint language sql as $$
  select id from public.productos where nombre = p_nombre and variedad = 'prueba 30';
$$;
create function pg_temp.stock(p_nombre text) returns numeric language sql as $$
  select coalesce(sum(cantidad), 0) from public.movimientos_stock where producto_id = pg_temp.fruta(p_nombre);
$$;

-- 20 cajas de pitahaya y 5 de lúcuma, según la app (como superusuario: la compra no es lo que se prueba).
insert into movimientos_stock (producto_id, tipo, cantidad, motivo, registrado_por) values
  (pg_temp.fruta('Pitahaya'), 'entrada_compra', 20, 'prueba 30', '00000000-0000-0000-0000-000000000d30'),
  (pg_temp.fruta('Lúcuma'), 'entrada_compra', 5, 'prueba 30', '00000000-0000-0000-0000-000000000d30');

set local role authenticated;

-- --- Caso feliz: faltan 2 cajas y no se sabe por qué → ajuste de −2, y el stock queda en lo contado ------------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000d30');
select is(
  (registrar_conteo(pg_temp.fruta('Pitahaya'), 18, 'no_se') - 'conteo_id') ,
  '{"segun_app": 20.00, "diferencia": -2.00, "stock": 18, "repetido": false}'::jsonb,
  'el dueño cuenta 18 donde la app decía 20: diferencia −2'
);
select is(pg_temp.stock('Pitahaya'), 18.00, 'el stock queda en lo contado');
select is(
  (select tipo::text || ' ' || cantidad || ' ' || motivo from movimientos_stock where conteo_id is not null and producto_id = pg_temp.fruta('Pitahaya')),
  'ajuste -2.00 conteo: no se sabe',
  'la diferencia entra como ajuste, con la causa escrita'
);
select is(
  (select registrado_por from conteos where producto_id = pg_temp.fruta('Pitahaya')),
  '00000000-0000-0000-0000-000000000d30'::uuid,
  'el conteo lleva la firma de quien contó'
);

-- --- «Se malogró» → merma, no ajuste (decisión del 2026-11-17) ---------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000a30');
select is((registrar_conteo(pg_temp.fruta('Pitahaya'), 15, 'se_malogro') ->> 'diferencia')::numeric, -3.00, 'el ayudante cuenta 15: faltan 3');
select is(
  (select tipo::text || ' ' || cantidad from movimientos_stock where conteo_id = (select max(id) from conteos)),
  'merma -3.00',
  'lo que se malogró entra como merma, y cuenta en el % de merma'
);
select is(pg_temp.stock('Pitahaya'), 15.00, 'y el stock queda en 15');

-- --- Sobra: compra sin anotar → ajuste a favor -----------------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000b30');
select is((registrar_conteo(pg_temp.fruta('Lúcuma'), 9, 'compra_sin_anotar') ->> 'diferencia')::numeric, 4.00, 'la administradora cuenta 9 donde había 5');
select is(pg_temp.stock('Lúcuma'), 9.00, 'sube a 9');

-- --- Cuadra: se guarda el conteo, sin movimiento y sin causa -----------------------------------------------------------------------
select is((registrar_conteo(pg_temp.fruta('Lúcuma'), 9, 'no_se') ->> 'diferencia')::numeric, 0.00, 'contar 9 donde hay 9 cuadra');
select is(
  (select count(*)::int from conteos c where c.producto_id = pg_temp.fruta('Lúcuma') and c.diferencia = 0 and c.causa is null
     and not exists (select 1 from movimientos_stock m where m.conteo_id = c.id)),
  1,
  'el conteo que cuadra queda guardado (para medir cuántos cuadran), sin causa y sin movimiento'
);

-- --- Media caja y fruta sin ninguna caja todavía -----------------------------------------------------------------------------------
select is((registrar_conteo(pg_temp.fruta('Aguaymanto'), 2.5, 'compra_sin_anotar') ->> 'segun_app')::numeric, 0.00, 'una fruta sin movimientos decía 0');
select is(pg_temp.stock('Aguaymanto'), 2.50, 'y queda en media caja más dos');

-- --- Idempotente por dictado: el mismo comando guarda un solo conteo --------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000a30');
insert into comandos_voz (transcripcion, intencion, resultado) values ('conté 12 de pitahaya', 'registrar_conteo', 'pendiente');
select is((registrar_conteo(pg_temp.fruta('Pitahaya'), 12, 'venta_sin_anotar', (select max(id) from comandos_voz)) ->> 'repetido')::boolean, false, 'el dictado se guarda');
select is((registrar_conteo(pg_temp.fruta('Pitahaya'), 12, 'venta_sin_anotar', (select max(id) from comandos_voz)) ->> 'repetido')::boolean, true, 'el mismo dictado otra vez no guarda otro');
select is(pg_temp.stock('Pitahaya'), 12.00, 'y el stock no se ajusta dos veces');
select is((select count(*)::int from conteos where comando_voz_id = (select max(id) from comandos_voz)), 1, 'un solo conteo por dictado');

-- El dictado de otro no se guarda a su nombre (como en toda tabla con comando_voz_id).
select pg_temp.como('00000000-0000-0000-0000-000000000a31');
insert into comandos_voz (transcripcion, intencion, resultado) values ('conté 10 de pitahaya', 'registrar_conteo', 'pendiente');
select pg_temp.como('00000000-0000-0000-0000-000000000a30');
select throws_ok(
  format('select registrar_conteo(%s, 10, ''no_se'', %s)', pg_temp.fruta('Pitahaya'), (select max(id) from comandos_voz)),
  '42501', null, 'el ayudante no guarda el dictado de otro ayudante'
);

-- --- Rechazo por rol ----------------------------------------------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000c30');
select throws_ok(format('select registrar_conteo(%s, 10, ''no_se'')', pg_temp.fruta('Pitahaya')), '42501', null, 'el contador no cuenta');
select is((select count(*)::int from conteos where producto_id = pg_temp.fruta('Pitahaya')) > 0, true, 'pero lee los conteos');

-- Nadie inserta un ajuste directo, ni el dueño: solo registrar_conteo.
select pg_temp.como('00000000-0000-0000-0000-000000000a30');
select throws_ok(
  format('insert into movimientos_stock (producto_id, tipo, cantidad) values (%s, ''ajuste'', 100)', pg_temp.fruta('Pitahaya')),
  '42501', null, 'el ayudante no inserta un ajuste directo'
);
select pg_temp.como('00000000-0000-0000-0000-000000000d30');
select throws_ok(
  format('insert into movimientos_stock (producto_id, tipo, cantidad) values (%s, ''ajuste'', 100)', pg_temp.fruta('Pitahaya')),
  '42501', null, 'ni el dueño'
);
select throws_ok(
  format('insert into movimientos_stock (producto_id, tipo, cantidad, conteo_id) values (%s, ''merma'', -1, %s)', pg_temp.fruta('Pitahaya'), (select max(id) from conteos)),
  '42501', null, 'nadie ata a mano un movimiento a un conteo'
);
select throws_ok(
  format('insert into conteos (producto_id, contado, segun_app) values (%s, 1, 1)', pg_temp.fruta('Pitahaya')),
  '42501', null, 'ni inserta un conteo directo'
);
select pg_temp.como('00000000-0000-0000-0000-000000000a30');
select lives_ok(
  format('insert into movimientos_stock (producto_id, tipo, cantidad, motivo) values (%s, ''merma'', -1, ''se pasó'')', pg_temp.fruta('Pitahaya')),
  'la merma suelta del ayudante sigue igual'
);

-- --- Casos borde ------------------------------------------------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000d30');
-- Pitahaya está en 11 (la merma de recién): contar 10 sin decir por qué no se guarda.
select throws_ok(format('select registrar_conteo(%s, 10)', pg_temp.fruta('Pitahaya')), 'P0C01', null, 'si no cuadra, hay que decir por qué');
select throws_ok(
  format('select registrar_conteo(%s, 14, ''se_malogro'')', pg_temp.fruta('Pitahaya')),
  'P0C01', null, '«se malogró» no explica que sobren cajas (pasa si alguien vendió mientras se contaba)'
);
select throws_ok(format('select registrar_conteo(%s, -1, ''no_se'')', pg_temp.fruta('Pitahaya')), '22023', null, 'no se cuentan cajas negativas');
select throws_ok(format('select registrar_conteo(%s, 1.234, ''no_se'')', pg_temp.fruta('Pitahaya')), '22023', null, 'ni fracciones más finas que centésimas');
select throws_ok(format('select registrar_conteo(%s, 3, ''no_se'')', pg_temp.fruta('Camu camu')), '23503', null, 'una fruta que ya no está en el catálogo no se cuenta');
select is(pg_temp.stock('Pitahaya'), 11.00, 'ningún intento rechazado tocó el stock');

select * from finish();
rollback;
