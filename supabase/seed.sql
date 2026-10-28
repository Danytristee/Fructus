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
    ('10000000-0000-0000-0000-000000000004'::uuid, 'contador@puesto.test',      'Contador de prueba',      'contador'::rol_usuario)
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
select c.id, c.nombre, c.rol from cuentas c join identidades i on i.user_id = c.id;
