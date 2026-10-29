-- =============================================================================
-- Fructus — datos de demo
-- Clientes y precios ficticios. Reemplazar por los reales del puesto antes de
-- probar en La Hermelinda.
-- =============================================================================

insert into productos (nombre, variedad, unidad, alias, precio_referencia) values
  ('Mango',     'Kent',          'caja', '{"mango kent","kent"}',                45.00),
  ('Mango',     'Edward',        'caja', '{"mango edward","edward"}',            38.00),
  ('Plátano',   'de seda',       'caja', '{"plátano seda","seda","platano"}',    32.00),
  ('Plátano',   'isla',          'caja', '{"plátano isla","isla"}',              28.00),
  ('Papaya',    null,            'caja', '{"papaya"}',                           35.00),
  ('Piña',      'golden',        'caja', '{"piña golden","golden","piña"}',      40.00),
  ('Mandarina', null,            'caja', '{"mandarina"}',                        30.00),
  ('Uva',       'red globe',     'caja', '{"uva roja","red globe","uva"}',       60.00),
  ('Palta',     'fuerte',        'caja', '{"palta fuerte","palta"}',             70.00),
  ('Limón',     null,            'caja', '{"limón","limon"}',                    50.00);

insert into clientes (nombre, alias, tipo_documento, numero_documento) values
  ('Luis Paredes',        '{"don lucho","lucho"}',                  'DNI', '40123456'),
  ('Rosa Quispe',         '{"la señora rosa","puesto 12"}',         null,  null),
  ('Juguería El Paraíso', '{"el paraíso","juguería","paraíso"}',    'RUC', '20601234567'),
  ('Bodega Santa Ana',    '{"santa ana","la bodega"}',              'RUC', '10456789012'),
  ('Carlos Mendoza',      '{"el flaco","flaco carlos"}',            null,  null),
  ('Restaurante Mochica', '{"el mochica","mochica"}',               'RUC', '20609876543');

insert into proveedores (nombre, alias) values
  ('Transportes Piura Norte', '{"el de piura","piura"}'),
  ('Agrícola Chao',           '{"chao","el de chao"}');

-- Series de prueba para el sandbox. En producción, confirmar con SUNAT que
-- estas series no hayan sido usadas antes por otro sistema del mismo RUC.
insert into series_comprobante (serie, tipo) values
  ('F001', '01'),
  ('B001', '03');

-- -----------------------------------------------------------------------------
-- Cuentas de prueba (solo local y CI). Una por rol, todas con la misma clave de prueba.
-- La clave vive también en tests/e2e/cuentas.ts. No sirve en el proyecto alojado: allí las cuentas reales
-- se crean por invitación (A2). Los correos .test no existen fuera de esta base.
-- -----------------------------------------------------------------------------
with cuentas (id, correo, nombre, rol) as (
  values
    ('10000000-0000-0000-0000-000000000001'::uuid, 'duenio@puesto.test',        'Dueño de prueba',         'duenio'::rol_usuario),
    ('10000000-0000-0000-0000-000000000002'::uuid, 'administrador@puesto.test', 'Administrador de prueba', 'administrador'::rol_usuario),
    ('10000000-0000-0000-0000-000000000003'::uuid, 'ayudante@puesto.test',      'Ayudante de prueba',      'ayudante'::rol_usuario),
    ('10000000-0000-0000-0000-000000000004'::uuid, 'contador@puesto.test',      'Contador de prueba',      'contador'::rol_usuario),
    -- Entra, pero sin perfil: así se ve una cuenta que todavía no activaron.
    ('10000000-0000-0000-0000-000000000005'::uuid, 'sinperfil@puesto.test',     null,                      null)
),
usuarios as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', correo,
         extensions.crypt('puesto-prueba-2026', extensions.gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  from cuentas
  returning id, email
),
identidades as (
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
         'email', now(), now(), now()
  from usuarios
  returning user_id
)
insert into perfiles (id, nombre, rol)
select c.id, c.nombre, c.rol from cuentas c join identidades i on i.user_id = c.id where c.rol is not null;

-- -----------------------------------------------------------------------------
-- Un día de demo (solo local y CI): lo que «Hoy» muestra al abrir.
-- Todo entra por las RPC reales, como el dueño de prueba, para que el stock y las invariantes cuadren igual que en el puesto.
-- Las RPC no reciben fecha: después de registrar, cada operación se mueve a su hora, repartida entre las 6 a. m. de hoy (Lima)
-- y unos minutos antes de ahora, para que el gráfico por hora tenga forma. Nunca queda en el futuro.
-- -----------------------------------------------------------------------------
create function pg_temp.mover(p_tabla text, p_id bigint, p_fecha timestamptz) returns void language plpgsql as $$
begin
  execute format('update %I set fecha = $1 where id = $2', p_tabla) using p_fecha, p_id;
  if p_tabla = 'ventas' then update movimientos_stock set fecha = p_fecha where venta_id = p_id; end if;
  if p_tabla = 'compras' then update movimientos_stock set fecha = p_fecha where compra_id = p_id; end if;
end $$;

do $$
declare
  v_hoy    timestamptz := ((now() at time zone 'America/Lima')::date)::timestamp at time zone 'America/Lima';
  v_desde  timestamptz;
  v_hasta  timestamptz := now() - interval '5 minutes';
  v_ayer   timestamptz;
  v_id     bigint;
  -- Ventas de hoy: [cliente_id | null, condición, medio, items, momento entre 0 y 1 del tramo de la mañana].
  v_ventas jsonb := '[
    [3,    "contado", "yape",          [[3, 5, 32], [6, 3, 40]],  0.05],
    [1,    "credito", null,            [[1, 10, 45]],             0.15],
    [4,    "credito", null,            [[1, 8, 44]],              0.28],
    [null, "contado", "efectivo",      [[5, 4, 35]],              0.38],
    [6,    "contado", "transferencia", [[6, 6, 40], [1, 4, 45]],  0.47],
    [5,    "credito", null,            [[3, 5, 32]],              0.58],
    [2,    "contado", "efectivo",      [[1, 3, 45]],              0.72],
    [null, "contado", "yape",          [[3, 6, 30]],              0.84],
    [3,    "credito", null,            [[5, 4, 35]],              0.93]
  ]';
  v_v      jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

  -- Si recién empieza el día (antes de las 7 a. m.), el tramo arranca a medianoche.
  v_desde := case when v_hasta > v_hoy + interval '7 hours' then v_hoy + interval '6 hours' else v_hoy end;
  v_ayer  := v_hoy - interval '6 hours';

  -- Ayer: compras y dos ventas al crédito, para que hoy existan deudas y abonos que las bajen.
  v_id := registrar_compra('{"proveedor_id": 2, "condicion": "contado", "medio_pago": "efectivo",
    "items": [{"producto_id": 2, "cantidad": 10, "costo_unitario": 30}, {"producto_id": 4, "cantidad": 20, "costo_unitario": 21}]}');
  perform pg_temp.mover('compras', v_id, v_ayer - interval '4 hours');
  v_id := registrar_venta('{"cliente_id": 1, "condicion": "credito", "items": [{"producto_id": 2, "cantidad": 5, "precio_unitario": 46}]}');
  perform pg_temp.mover('ventas', v_id, v_ayer - interval '2 hours');
  v_id := registrar_venta('{"cliente_id": 2, "condicion": "credito", "items": [{"producto_id": 4, "cantidad": 10, "precio_unitario": 30}]}');
  perform pg_temp.mover('ventas', v_id, v_ayer - interval '1 hour');

  -- Hoy, temprano: llega la fruta de Chao.
  v_id := registrar_compra('{"proveedor_id": 2, "condicion": "contado", "medio_pago": "efectivo", "items": [
    {"producto_id": 1, "cantidad": 40, "costo_unitario": 30}, {"producto_id": 3, "cantidad": 50, "costo_unitario": 22},
    {"producto_id": 6, "cantidad": 20, "costo_unitario": 28}, {"producto_id": 5, "cantidad": 20, "costo_unitario": 25}]}');
  perform pg_temp.mover('compras', v_id, v_desde);

  for v_v in select * from jsonb_array_elements(v_ventas) loop
    v_id := registrar_venta(jsonb_build_object(
      'cliente_id', v_v -> 0, 'condicion', v_v ->> 1, 'medio_pago', v_v -> 2,
      'items', (select jsonb_agg(jsonb_build_object('producto_id', i -> 0, 'cantidad', i -> 1, 'precio_unitario', i -> 2))
                from jsonb_array_elements(v_v -> 3) i)));
    perform pg_temp.mover('ventas', v_id, v_desde + (v_hasta - v_desde) * (v_v ->> 4)::numeric);
  end loop;

  -- Un flete, una merma y un abono, a su hora.
  insert into gastos (categoria, monto, medio_pago, descripcion, fecha)
  values ('flete', 40, 'efectivo', 'Flete del mercado', v_desde + (v_hasta - v_desde) * 0.2);
  insert into movimientos_stock (producto_id, tipo, cantidad, motivo, fecha)
  values (5, 'merma', -2, 'se malogró', v_desde + (v_hasta - v_desde) * 0.65);
  insert into abonos (cliente_id, monto, medio_pago, fecha)
  values (2, 200, 'efectivo', v_desde + (v_hasta - v_desde) * 0.78);
end $$;
