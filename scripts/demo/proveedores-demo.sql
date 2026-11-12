-- =============================================================================
-- 10 proveedores de prueba con 4 meses de compras y pagos, para ver el apartado Proveedores con vida: a quién le compras
-- más, de quién dependes y quién te tiene como cliente fijo. Va después de catalogo-real.sql (usa sus productos).
--
-- - Todo entra por la RPC real (registrar_compra) y por insert en pagos_proveedor: cuadran stock, deudas e invariantes.
-- - Queda a nombre del primer perfil activo de dueño o administrador.
-- - Los casos que el análisis tiene que detectar (lib/proveedores-reglas.ts), a propósito:
--     dependes de él:     Importadora Frutícola del Pacífico (un tercio de tus compras, la única que te trae kiwi; te subió
--                         el precio de la manzana en el último mes)
--     más barato en otro: Distribuidora Andina Import te deja la Manzana Roja americana más barata que el Pacífico
--     cliente fijo:       Agrícola Chao y Transportes Piura Norte (le compras cada pocos días desde hace meses)
--     única fuente:       Frutas del Sur Tacna (la cereza chilena), Pacífico (el kiwi)
--     se enfrió:          Comercial Lambayeque (no le compras hace más de 50 días)
--     ocasional:          Wilmer Rojas, acopiador de Cajamarca
--     le debes:           Pacífico, Tacna y Chao (compras al crédito con pagos a cuenta)
-- - Los teléfonos son de prueba (900 000 1xx): no los uses para escribir de verdad.
-- - Son datos falsos. En el proyecto quedan en el historial; se anulan, no se borran (CLAUDE.md).
-- - No tocan el stock: cada compra de prueba lleva su salida por ajuste, con el motivo «compra de prueba (demo de
--   proveedores)». Para encontrarlas: select * from movimientos_stock where motivo like 'compra de prueba%'.
-- - Se puede correr dos veces: si ya están las compras del Pacífico, no vuelve a comprar.
--
-- Uso: en local, docker exec -i supabase_db_fructus psql -U postgres -v ON_ERROR_STOP=1 < scripts/demo/proveedores-demo.sql
--      en el proyecto, solo con OK de quien dirige el proyecto.
-- =============================================================================

begin;

create or replace function pg_temp.producto(p_clave text) returns bigint language plpgsql stable as $$
declare v_ids bigint[];
begin
  select array_agg(id) into v_ids from productos
   where activo and (lower(concat_ws(' ', nombre, variedad, seleccion)) = lower(p_clave)
                  or lower(concat_ws(' ', nombre, variedad, seleccion, calibre)) = lower(p_clave));
  if coalesce(cardinality(v_ids), 0) <> 1 then
    raise exception '«%»: % productos activos con ese nombre. Corre antes scripts/demo/catalogo-real.sql', p_clave, coalesce(cardinality(v_ids), 0);
  end if;
  return v_ids[1];
end $$;

-- Los 10 proveedores: se crean o se ponen al día por su nombre (Agrícola Chao y Transportes Piura Norte ya existían).
create temp table demo_proveedores (nombre text, alias text[], ruc text, telefono text, contacto text, origen text, direccion text, notas text);
insert into demo_proveedores values
  ('Importadora Frutícola del Pacífico', '{"el pacífico","la importadora","pacífico"}', '20999000101', '900000101', 'Sra. Milagros Vega',
   'Mercado Mayorista de Lima', 'Av. Mariscal Castilla, puesto 214, Santa Anita', 'Fruta importada: manzana americana, kiwi y pera. Da crédito a 15 días.'),
  ('Distribuidora Andina Import', '{"la andina","andina"}', '20999000102', '900000102', 'Jorge Salinas',
   'Mercado Mayorista de Lima', null, 'Trae manzana y pera importada. Pide pago al contado.'),
  ('Agrícola Chao', '{"chao","el de chao"}', '20999000103', '900000103', 'don Wilmer Castillo',
   'Chao, La Libertad', 'Fundo Santa Rosa, Chao', 'Uva y tumbo del valle. Llega dos veces por semana.'),
  ('Transportes Piura Norte', '{"el de piura","piura"}', '20999000104', '900000104', 'Hugo Ramírez',
   'Sullana, Piura', null, 'Plátano bizcocho, orgánico y lima. Llega de madrugada.'),
  ('Fundo Los Naranjos', '{"los naranjos","el de chanchamayo"}', '20999000105', '900000105', 'Rosa Inga',
   'La Merced, Chanchamayo', null, 'Naranja y piña de la selva central.'),
  ('Frutos de la Sierra Otuzco', '{"otuzco","la sierra"}', '20999000106', '900000106', 'Teodoro Alayo',
   'Otuzco, La Libertad', null, 'Membrillo, caqui y níspero de temporada.'),
  ('Agroexportadora Valle de Ica', '{"el de ica","ica"}', '20999000107', '900000107', 'Patricia Muñoz',
   'Santiago, Ica', null, 'Uva iqueña y sin pepa; también albaricoque.'),
  ('Frutas del Sur Tacna', '{"tacna","el del sur"}', '20999000108', '900000108', 'Raúl Condori',
   'Tacna (fruta chilena)', null, 'Ciruela, durazno y cereza chilena. Da crédito a 30 días.'),
  ('Wilmer Rojas', '{"wilmer","el de cajamarca"}', '10999000109', '900000109', null,
   'Cajamarca', null, 'Acopiador: chirimoya, granadilla y tuna cuando hay.'),
  ('Comercial Lambayeque', '{"lambayeque","moshoqueque"}', '20999000110', '900000110', 'Lucía Távara',
   'Mercado Moshoqueque, Chiclayo', null, 'Pepino y cocona. Le dejaste de comprar por la calidad.');

update proveedores p
   set alias = d.alias, ruc = d.ruc, telefono = d.telefono, contacto = d.contacto, origen = d.origen,
       direccion = d.direccion, notas = d.notas
  from demo_proveedores d
 where p.activo and lower(btrim(p.nombre)) = lower(d.nombre);

insert into proveedores (nombre, alias, ruc, telefono, contacto, origen, direccion, notas)
select d.nombre, d.alias, d.ruc, d.telefono, d.contacto, d.origen, d.direccion, d.notas
  from demo_proveedores d
 where not exists (select 1 from proveedores p where p.activo and lower(btrim(p.nombre)) = lower(d.nombre));

-- Qué trae cada uno, cada cuántos días y a qué costo: [fruta, cajas mín, cajas máx, costo por caja].
-- «sube» es cuánto sube el costo de punta a punta del periodo (0.06 = 6 %): el Pacífico subió la manzana.
create temp table demo_ritmo (proveedor text, cada int, desde int, hasta int, credito boolean, sube numeric, items jsonb);
insert into demo_ritmo values
  ('Importadora Frutícola del Pacífico', 3, 120, 1, true, 0.07,
   '[["Manzana Roja americana Premium 113", 6, 10, 176], ["Manzana Royal Comercial", 10, 18, 98], ["Kiwi Cilíndrico chileno", 3, 6, 196],
     ["Kiwi Riñón chileno", 4, 7, 142], ["Pera Gaucho Premium", 6, 12, 138], ["Manzana Verde Comercial", 4, 8, 122]]'),
  ('Distribuidora Andina Import', 9, 110, 4, false, 0,
   '[["Manzana Roja americana Premium 113", 4, 6, 168], ["Pera Gaucho Premium", 3, 6, 141], ["Manzana Royal Comercial", 6, 10, 101]]'),
  ('Agrícola Chao', 4, 120, 1, true, 0,
   '[["Uva sin pepa", 4, 8, 98], ["Tumbo", 3, 6, 45], ["Uva iqueña", 3, 6, 41]]'),
  ('Transportes Piura Norte', 4, 118, 2, false, 0,
   '[["Plátano bizcocho", 8, 14, 32], ["Plátano bizcocho orgánico", 3, 6, 42], ["Lima", 2, 4, 55]]'),
  ('Fundo Los Naranjos', 6, 115, 3, false, 0,
   '[["Naranja Valencia", 10, 18, 29], ["Naranja Tangelo", 4, 8, 58], ["Piña", 6, 10, 33]]'),
  ('Frutos de la Sierra Otuzco', 12, 100, 6, false, 0,
   '[["Membrillo 4ta", 2, 4, 128], ["Caqui 1era", 2, 4, 88], ["Níspero HBS", 2, 3, 70]]'),
  ('Agroexportadora Valle de Ica', 10, 105, 5, false, 0,
   '[["Uva iqueña", 4, 7, 37], ["Uva sin pepa", 2, 4, 94], ["Albaricoque Extra", 2, 4, 99]]'),
  ('Frutas del Sur Tacna', 7, 112, 2, true, 0.03,
   '[["Ciruela chilena Fortuna", 2, 4, 138], ["Durazno chileno", 2, 4, 137], ["Cereza chilena", 1, 2, 240]]'),
  ('Wilmer Rojas', 20, 95, 15, false, 0,
   '[["Chirimoya", 2, 4, 60], ["Granadilla", 2, 3, 45], ["Tuna", 2, 3, 62]]'),
  ('Comercial Lambayeque', 6, 120, 52, false, 0,
   '[["Pepino", 3, 6, 28], ["Cocona", 2, 4, 35]]');

do $$
declare
  v_hoy    timestamptz := ((now() at time zone 'America/Lima')::date)::timestamp at time zone 'America/Lima';
  v_perfil uuid := (select id from perfiles where activo and rol in ('duenio', 'administrador') order by rol limit 1);
  r        record;
  d        int;
  v_items  jsonb;
  v_id     bigint;
  v_prov   bigint;
  v_avance numeric;
  v_credito boolean;
  v_fecha  timestamptz;
  v_n      int := 0;
begin
  if v_perfil is null then raise exception 'No hay un perfil activo de dueño o administrador'; end if;
  perform pg_temp.producto('Kiwi Riñón chileno'); -- sin el catálogo real, se para aquí con el aviso
  if exists (select 1 from compras c join proveedores p on p.id = c.proveedor_id where p.nombre = 'Importadora Frutícola del Pacífico') then
    raise notice 'Las compras de prueba ya estaban: no se vuelven a cargar.';
    return;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_perfil, 'role', 'authenticated')::text, true);
  perform setseed(0.42); -- las mismas cantidades cada vez que se corre en una base nueva

  for r in select * from demo_ritmo loop
    v_prov := (select id from proveedores where activo and nombre = r.proveedor);
    d := r.desde;
    while d >= r.hasta loop
      v_avance := (r.desde - d)::numeric / greatest(r.desde - r.hasta, 1);
      -- Cada compra trae casi todo lo suyo; de vez en cuando falta una fruta.
      select jsonb_agg(jsonb_build_object(
               'producto_id', pg_temp.producto(i ->> 0),
               'cantidad', floor((i ->> 1)::int + random() * ((i ->> 2)::int - (i ->> 1)::int + 1)),
               'costo_unitario', round((i ->> 3)::numeric * (1 + r.sube * v_avance) * (0.97 + random() * 0.06))))
        into v_items
        from jsonb_array_elements(r.items) i
       where random() < 0.85;
      if v_items is not null then
        -- Los que dan crédito: dos de cada tres compras van fiadas.
        v_credito := r.credito and random() < 0.67;
        v_id := registrar_compra(jsonb_build_object(
          'proveedor_id', v_prov,
          'condicion', case when v_credito then 'credito' else 'contado' end,
          'medio_pago', case when v_credito then null when random() < 0.5 then 'efectivo' else 'transferencia' end,
          'items', v_items));
        v_fecha := v_hoy - make_interval(days => d) + make_interval(mins => 300 + floor(random() * 120)::int);
        update compras set fecha = v_fecha where id = v_id;
        update movimientos_stock set fecha = v_fecha where compra_id = v_id;
        -- Sin tocar el stock (decisión del 2026-11-12): cada caja de prueba que entra sale en el mismo minuto por un ajuste
        -- con su motivo. Proveedores se ve completo y Stock sigue diciendo las cajas reales del puesto.
        insert into movimientos_stock (producto_id, tipo, cantidad, motivo, fecha)
        select (i ->> 'producto_id')::bigint, 'ajuste', -(i ->> 'cantidad')::numeric, 'compra de prueba (demo de proveedores)', v_fecha
          from jsonb_array_elements(v_items) i;
        v_n := v_n + 1;
      end if;
      d := d - r.cada;
    end loop;
  end loop;

  -- Pagos a cuenta: Chao queda casi al día; al Pacífico y a Tacna les debes una parte.
  insert into pagos_proveedor (proveedor_id, monto, medio_pago, fecha, nota)
  select p.id, round(s.saldo * x.parte / x.cuotas, -1), x.medio::medio_pago,
         v_hoy - make_interval(days => g * x.cada) + interval '16 hours', 'Pago a cuenta'
    from (values ('Agrícola Chao', 0.92, 8, 14, 'yape'),
                 ('Importadora Frutícola del Pacífico', 0.80, 7, 15, 'transferencia'),
                 ('Frutas del Sur Tacna', 0.55, 3, 30, 'transferencia')) x(nombre, parte, cuotas, cada, medio)
    join proveedores p on p.activo and p.nombre = x.nombre
    join v_saldo_proveedores s on s.proveedor_id = p.id
   cross join lateral generate_series(1, x.cuotas) g
   where g * x.cada < 120;

  raise notice 'Compras de prueba cargadas: %', v_n;
end $$;

commit;
