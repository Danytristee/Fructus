-- =============================================================================
-- Catálogo del puesto según la proyección del dueño (Proyeccion_Frutas_Mensual.xlsx, «Desglose por tipo de fruta»).
--
-- Qué hace (se puede correr varias veces; no duplica):
--   1. Crea un producto por cada fruta y variedad del Excel. Lo que va entre paréntesis son variedades, y cada una
--      tiene su propio stock: «Manzana (Royal, Roja, Verde, Crispin)» son 4 productos.
--   2. precio_referencia = el precio de venta PROYECTADO por caja. No es un precio real: solo se usa como precio
--      «sugerido» (siempre marcado y confirmado por la persona) hasta que exista la primera venta real a ese cliente.
--   3. Marca como inactivos los productos de demo del seed que no están en el Excel. No se borran (CLAUDE.md).
--
-- Pendiente: el origen (Chile, Argentina, nacional) también separa el stock, pero el Excel no dice qué
-- combinaciones existen. Se agregan cuando el dueño las confirme; no se inventan.
--
-- Uso: en local, npx supabase db query --local -f scripts/demo/catalogo-proyeccion.sql
--      en el proyecto, solo con OK de quien dirige el proyecto.
-- =============================================================================

with catalogo (nombre, variedad, precio, alias) as (
  values
    ('Manzana',    'Royal',      128.72, '{"manzana royal","royal"}'::text[]),
    ('Manzana',    'Roja',       128.72, '{"manzana roja"}'),
    ('Manzana',    'Verde',      128.72, '{"manzana verde"}'),
    ('Manzana',    'Crispin',    128.72, '{"manzana crispin","crispin"}'),
    ('Pera',       'Gaucho',     121.21, '{"pera gaucho","gaucho"}'),
    ('Pera',       'Zaledias',   121.21, '{"pera zaledias","zaledias"}'),
    ('Pera',       'chilena',    121.21, '{"pera chilena"}'),
    ('Ciruela',    'nacional',   123.35, '{"ciruela nacional","ciruela"}'),
    ('Ciruela',    'chilena',    123.35, '{"ciruela chilena"}'),
    ('Kiwi',       'importado',  139.44, '{"kiwi importado","kiwi"}'),
    ('Kiwi',       'AAA',        139.44, '{"kiwi aaa","kiwi triple a"}'),
    ('Kiwi',       'Cope',       139.44, '{"kiwi cope","cope"}'),
    ('Naranja',    null,          75.08, '{"naranja"}'),
    ('Tangelo',    null,          75.08, '{"tangelo"}'),
    ('Lima',       null,          75.08, '{"lima"}'),
    ('Uva',        'Bolón',      134.08, '{"uva bolón","uva bolon","bolón"}'),
    ('Uva',        'chilena',    134.08, '{"uva chilena"}'),
    ('Uva',        'Ica',        134.08, '{"uva de ica","uva ica"}'),
    ('Piña',       'C8',          42.91, '{"piña c8","piña ce ocho"}'),
    ('Piña',       'C10',         42.91, '{"piña c10","piña ce diez"}'),
    ('Piña',       'golden',      42.91, '{"piña golden","golden","piña"}'),
    ('Plátano',    'biscocho',    21.45, '{"plátano biscocho","biscocho","plátano"}'),
    ('Chirimoya',  'selección',   58.99, '{"chirimoya"}'),
    ('Granadilla', 'selección',   53.63, '{"granadilla"}'),
    ('Níspero',    'HBS',        128.72, '{"níspero hbs","nispero hbs"}'),
    ('Níspero',    'ASV',        107.26, '{"níspero asv","nispero asv"}'),
    ('Tuna',       'selección',   64.36, '{"tuna","tunas"}'),
    ('Mango',      'Kent',       101.90, '{"mango kent","kent","mango"}'),
    ('Kaki',       null,         112.63, '{"kaki","caqui"}'),
    ('Arándano',   null,          91.17, '{"arándano","arándanos","arandanos"}'),
    ('Sandía',     null,          48.27, '{"sandía","sandia"}'),
    ('Papaya',     null,          48.27, '{"papaya"}'),
    ('Aguaymanto', null,          58.99, '{"aguaymanto"}'),
    ('Cocona',     null,          58.99, '{"cocona"}'),
    ('Carambola',  null,          58.99, '{"carambola"}')
),
-- Los que ya existen (por nombre y variedad, sin mirar mayúsculas) se ponen al día y se reactivan.
actualizados as (
  update productos p
     set precio_referencia = c.precio, alias = c.alias, activo = true
    from catalogo c
   where lower(p.nombre) = lower(c.nombre) and lower(coalesce(p.variedad, '')) = lower(coalesce(c.variedad, ''))
  returning p.id
)
insert into productos (nombre, variedad, unidad, alias, precio_referencia)
select c.nombre, c.variedad, 'caja', c.alias, c.precio
  from catalogo c
 where not exists (
   select 1 from productos p
    where lower(p.nombre) = lower(c.nombre) and lower(coalesce(p.variedad, '')) = lower(coalesce(c.variedad, ''))
 );

-- Los productos de demo del seed que el puesto no vende quedan inactivos (no se borran).
update productos set activo = false
 where (nombre, coalesce(variedad, '')) in (
   ('Mango', 'Edward'), ('Plátano', 'de seda'), ('Plátano', 'isla'), ('Mandarina', ''),
   ('Uva', 'red globe'), ('Palta', 'fuerte'), ('Limón', '')
 );

select count(*) filter (where activo) as activos, count(*) filter (where not activo) as inactivos from productos;
