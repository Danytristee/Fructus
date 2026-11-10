-- =============================================================================
-- Catálogo real del puesto, del inventario del dueño («Copia de Inventario de Frutas.xlsx», filas 2 a 51; ADR-0016).
-- Reemplaza a catalogo-proyeccion.sql, que salió de una proyección con precios promedio.
--
-- Qué hace (se puede correr varias veces; no duplica):
--   1. Crea o pone al día un producto por cada fila del Excel. La llave es fruta + variedad + marca + selección + calibre.
--   2. Cómo se leyó el Excel:
--      - «Tipo» se parte en fruta y variedad, en el orden en que lo dice el puesto: «Manzana Roja americana» → Manzana /
--        Roja americana; «Ciruela chilena Fortuna» → Ciruela / chilena Fortuna.
--      - «Pera Gaucho elegido» es Pera Gaucho con selección Elegido. «Bizcocho» es el plátano bizcocho (así sale en las
--        ventas del mismo Excel). «Manzana Nacional delicia» es Manzana Delicia nacional.
--      - «Pink de light» se escribe Pink Lady (lo confirmó quien dirige el proyecto, 2026-11-10).
--      - El calibre va tal cual, como texto: «125 o 113», «AA», «Jumbo».
--      - Un alias nunca es el nombre a secas de una fruta que tiene varias selecciones o calibres: «pera gaucho» o «roja
--        americana» tienen que preguntar cuál (lib/voz/tarjeta-reglas.ts, elegir).
--      - Sin precio en el Excel, sin precio sugerido: Chirimoya, Granadilla y Plátano bizcocho. La cereza trae «280 a 150»
--        y queda sin precio sugerido: nunca se inventa dinero (principio 2); se sugiere el último que se cobró.
--   3. Quedan activas, aunque no estén en la lista, las frutas que el puesto vende según sus ventas diarias (columnas N a
--      R): Níspero HBS y ASV, Cocona y Lima, que ya existían, y se agregan Tumbo, Pepino, Bomba y Plátano bizcocho
--      orgánico, sin precio.
--   4. Todo lo demás queda inactivo. No se borra (CLAUDE.md): las ventas viejas conservan su producto.
--
-- Uso: en local, docker exec -i supabase_db_fructus psql -U postgres -v ON_ERROR_STOP=1 < scripts/demo/catalogo-real.sql
--      en el proyecto, solo con OK de quien dirige el proyecto.
-- =============================================================================

begin;

create temp table catalogo (
  nombre text, variedad text, marca text, seleccion text, calibre text,
  kg numeric, costo numeric, precio numeric, alias text[]
) on commit drop;

insert into catalogo values
  -- Manzana
  ('Manzana', 'Royal',              'Unifrutti',  'Comercial', '150, 125 o 113', 19, 100, 110, '{"manzana royal","royal"}'),
  ('Manzana', 'Royal americana',    'Nordic',     null,        '113',            20, 160, 180, '{"royal americana","manzana royal nordic"}'),
  ('Manzana', 'Buena',              'Unifrutti',  null,        '125 o 113',      19, 130, 140, '{"manzana buena"}'),
  ('Manzana', 'Roja americana',     'Nordic',     'Premium',   '113',            20, 180, 190, '{"roja americana 113","roja americana ciento trece"}'),
  ('Manzana', 'Roja americana',     'Nordic',     'Premium',   '100',            20, 170, 185, '{"roja americana 100","roja americana cien"}'),
  ('Manzana', 'Roja chilena',       'Marinero',   'Comercial', '138',            19, 100, 110, '{"roja chilena","manzana marinero","marinero"}'),
  ('Manzana', 'Pink Lady',          'Moño Azul',  null,        '120',            18, 110, 120, '{"pink lady","pink de light","manzana pink","moño azul"}'),
  ('Manzana', 'Verde',              'Nordic',     'Premium',   '100',            18, 160, 180, '{"manzana verde premium","verde premium"}'),
  ('Manzana', 'Verde',              'Nordic',     'Comercial', '80 o 75',        18, 125, 140, '{"manzana verde comercial","verde comercial"}'),
  ('Manzana', 'Delicia nacional',   null,         '6ta',       null,             18,  90, 100, '{"manzana delicia","delicia","manzana nacional"}'),
  -- Pera
  ('Pera',    'Gaucho',             null,         'Premium',   '100',            18, 140, 150, '{"pera gaucho premium","gaucho premium"}'),
  ('Pera',    'Gaucho',             null,         'Elegido',   '110',            18, 110, 130, '{"gaucho elegido","pera gaucho elegido"}'),
  ('Pera',    'Cesta',              null,         null,        '110',            18, 100, 110, '{"pera cesta","cesta"}'),
  ('Pera',    'Salud',              null,         null,        '150',            18,  90, 100, '{"pera salud","salud"}'),
  ('Pera',    'Italiana chilena',   null,         null,        '60',             10,  60,  70, '{"pera italiana","perita italiana","perita"}'),
  -- Kiwi
  ('Kiwi',    'Riñón chileno',      'VerFruit',   null,        '33',             15, 145, 160, '{"kiwi riñón","kiwi riñon"}'),
  ('Kiwi',    'Cilíndrico chileno', 'VerFruit',   null,        '25 o 27',        15, 200, 220, '{"kiwi cilíndrico chileno","kiwi cilindrico"}'),
  ('Kiwi',    'Cilíndrico americano','California',null,        '23',              9, 190, 220, '{"kiwi americano","kiwi california"}'),
  -- Ciruela
  ('Ciruela', 'chilena Larryaan',   null,         null,        'AA',             15, 150, 160, '{"ciruela larryaan","larry ann","larryaan"}'),
  ('Ciruela', 'chilena Pink Lady',  null,         null,        'AA',             15, 150, 160, '{"ciruela pink lady","ciruela pink de light","ciruela pink"}'),
  ('Ciruela', 'chilena Fortuna',    null,         null,        'AAA o AA',       15, 140, 160, '{"ciruela fortuna","fortuna"}'),
  ('Ciruela', 'chilena Angelino',   null,         null,        '50',             15, 100, 110, '{"ciruela angelino","angelino"}'),
  ('Ciruela', 'chilena Nectarín',   null,         null,        '40',             15, 130, 150, '{"ciruela nectarín","nectarín","nectarin"}'),
  -- Naranja
  ('Naranja', 'Wando',              'Suntreat',   null,        '72',             18, 170, 190, '{"naranja wando","wando","huando","naranja huando"}'),
  ('Naranja', 'Wando nacional',     null,         'Extra',     null,             15,  60,  70, '{"wando nacional","huando nacional"}'),
  ('Naranja', 'Tangelo',            null,         null,        '80',             18,  60,  70, '{"tangelo","naranja tangelo"}'),
  ('Naranja', 'Primavera',          null,         'Extra',     null,             15,  25,  35, '{"naranja primavera","primavera"}'),
  ('Naranja', 'Valencia',           null,         null,        '80',             18,  30,  40, '{"naranja valencia","valencia"}'),
  -- De a una
  ('Cereza',  'chilena',            'Unifrutti',  null,        'Jumbo',          10, null, null, '{"cereza","cerezas"}'),
  ('Durazno', 'chileno',            null,         null,        '40',             15, 140, 150, '{"durazno","duraznos"}'),
  ('Piña',    null,                 null,         null,        null,           null,  34,  38, '{"piña","piñas"}'),
  ('Tuna',    null,                 null,         null,        null,             10,  65,  70, '{"tuna","tunas"}'),
  ('Chirimoya', null,               null,         null,        null,             10, null, null, '{"chirimoya","chirimoyas"}'),
  ('Granadilla', null,              null,         null,        null,             10, null, null, '{"granadilla","granadillas"}'),
  ('Plátano', 'bizcocho',           null,         null,        null,             12, null, null, '{"bizcocho","biscocho","plátano bizcocho","plátanos biscochos"}'),
  ('Uva',     'sin pepa',           null,         null,        null,              7, 100, 110, '{"uva sin pepa","sin pepa"}'),
  ('Uva',     'iqueña',             null,         null,        null,             10,  40,  50, '{"uva iqueña","uva de ica"}'),
  -- Membrillo, Albaricoque y Caqui: se distinguen solo por la selección
  ('Membrillo', null,               null,         '3era',      null,             18, 140, 160, '{"membrillo de tercera"}'),
  ('Membrillo', null,               null,         '4ta',       null,             18, 130, 150, '{"membrillo de cuarta"}'),
  ('Membrillo', null,               null,         '5ta',       null,             18, 110, 130, '{"membrillo de quinta"}'),
  ('Albaricoque', null,             null,         'Premium',   null,             10, 120, 140, '{"albaricoque premium"}'),
  ('Albaricoque', null,             null,         'Extra',     null,             10, 100, 110, '{"albaricoque extra"}'),
  ('Albaricoque', null,             null,         '1era',      null,             10,  85, 100, '{"albaricoque de primera"}'),
  ('Albaricoque', null,             null,         '2da',       null,             10,  70,  90, '{"albaricoque de segunda"}'),
  ('Albaricoque', null,             null,         '3ra',       null,             10,  50,  65, '{"albaricoque de tercera"}'),
  ('Albaricoque', null,             null,         '4ta',       null,             10,  40,  55, '{"albaricoque de cuarta"}'),
  ('Caqui',   null,                 null,         'Super',     null,             10, 120, 140, '{"caqui super","kaki super"}'),
  ('Caqui',   null,                 null,         'Extra',     null,             10, 100, 120, '{"caqui extra","kaki extra"}'),
  ('Caqui',   null,                 null,         '1era',      null,             10,  90, 110, '{"caqui de primera","kaki de primera"}'),
  ('Caqui',   null,                 null,         '2da',       null,             10,  70,  90, '{"caqui de segunda","kaki de segunda"}'),
  -- Las que el puesto vende según sus ventas diarias y no están en la lista (sin precio: no se inventa)
  ('Tumbo',   null,                 null,         null,        null,           null, null, null, '{"tumbo","tumbos"}'),
  ('Pepino',  null,                 null,         null,        null,           null, null, null, '{"pepino","pepinos","pepino dulce"}'),
  ('Bomba',   null,                 null,         null,        null,           null, null, null, '{"bomba","bombas"}'),
  ('Plátano', 'bizcocho orgánico',  null,         null,        null,           null, null, null, '{"bizcocho orgánico","biscocho orgánico","orgánico"}');

insert into productos (nombre, variedad, marca, seleccion, calibre, unidad, kg_por_caja, costo_referencia, precio_referencia, alias, activo)
select nombre, variedad, marca, seleccion, calibre, 'caja', kg, costo, precio, alias, true from catalogo
on conflict ((lower(nombre)), (lower(coalesce(variedad, ''))), (lower(coalesce(marca, ''))), (lower(coalesce(seleccion, ''))), (lower(coalesce(calibre, ''))))
do update set kg_por_caja = excluded.kg_por_caja, costo_referencia = excluded.costo_referencia,
              precio_referencia = excluded.precio_referencia, alias = excluded.alias, activo = true;

-- Todo lo que no está en el catálogo queda inactivo, salvo las frutas que ya existían y el puesto sigue vendiendo.
update productos p set activo = false
 where p.activo
   and not exists (
     select 1 from catalogo c
      where lower(p.nombre) = lower(c.nombre) and lower(coalesce(p.variedad, '')) = lower(coalesce(c.variedad, ''))
        and lower(coalesce(p.marca, '')) = lower(coalesce(c.marca, '')) and lower(coalesce(p.seleccion, '')) = lower(coalesce(c.seleccion, ''))
        and lower(coalesce(p.calibre, '')) = lower(coalesce(c.calibre, ''))
   )
   and (p.nombre, coalesce(p.variedad, '')) not in (('Níspero', 'HBS'), ('Níspero', 'ASV'), ('Cocona', ''), ('Lima', ''));

select count(*) filter (where activo) as activos, count(*) filter (where not activo) as inactivos from productos;

commit;
