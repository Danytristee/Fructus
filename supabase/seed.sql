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
