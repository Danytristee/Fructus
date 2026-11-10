-- =============================================================================
-- El producto se identifica como lo vende el puesto: fruta, variedad, marca, selección y calibre (ADR-0016).
--
-- Por qué: el inventario real del dueño («Copia de Inventario de Frutas.xlsx») tiene filas que solo se distinguen por la
-- selección (Membrillo 3era / 4ta / 5ta) o por el calibre (Manzana Roja americana Nordic Premium 113 / 100), y cada una
-- tiene su precio y su stock. Con la llave anterior (nombre, variedad) no se podían guardar.
--
--   1. Columnas nuevas: marca, seleccion, calibre (texto: «125 o 113», «AA», «Jumbo»), kg_por_caja y costo_referencia
--      (precio de compra de referencia, para el margen; precio_referencia sigue siendo el de venta).
--   2. La llave pasa a las cinco partes, sin mirar mayúsculas: «Unifrutti» y «UNIFRUTTI» no pueden ser dos productos.
--      Un texto vacío no es un dato (cero estados imposibles): o tiene letras o es null.
--   3. v_stock expone las partes nuevas al final (create or replace view solo permite agregar columnas al final).
-- =============================================================================

alter table productos
  add column marca            text check (marca is null or btrim(marca) <> ''),
  add column seleccion        text check (seleccion is null or btrim(seleccion) <> ''),
  add column calibre          text check (calibre is null or btrim(calibre) <> ''),
  add column kg_por_caja      numeric(5,2) check (kg_por_caja > 0),
  add column costo_referencia numeric(10,2) check (costo_referencia >= 0);

alter table productos add constraint productos_variedad_no_vacia check (variedad is null or btrim(variedad) <> '');

alter table productos drop constraint productos_nombre_variedad_key;
create unique index productos_identidad_key on productos (
  lower(nombre), lower(coalesce(variedad, '')), lower(coalesce(marca, '')), lower(coalesce(seleccion, '')), lower(coalesce(calibre, ''))
);

comment on column productos.seleccion is 'Super, Premium, Extra, Elegido, 1era…6ta, Comercial. El orden en pantalla vive en lib/productos-reglas.ts.';
comment on column productos.costo_referencia is 'Precio de compra por caja que da el dueño. No es el costo real de un lote: ese está en compra_items.';

create or replace view v_stock with (security_invoker = true) as
select p.id                         as producto_id,
       p.nombre,
       p.variedad,
       p.unidad,
       coalesce(sum(m.cantidad), 0) as stock,
       p.marca,
       p.seleccion,
       p.calibre
from productos p
left join movimientos_stock m on m.producto_id = p.id
where p.activo
group by p.id;
