-- =============================================================================
-- Dos semanas de demo (los 13 días antes de hoy), para que Clientes, Stock, Ventas y Cierre se vean como un puesto que ya
-- trabaja. Va después de catalogo-real.sql y antes de dia-demo.sql (que agrega el día de hoy).
--
-- - Todo entra por las RPC reales (registrar_compra, registrar_venta): cuadran stock, deudas e invariantes.
-- - Queda a nombre del primer perfil activo de dueño o administrador.
-- - Deja a propósito lotes que el dashboard de inventario tiene que detectar (lib/inventario-reglas.ts):
--     por malograrse: caqui super (6 cajas de hace 9 días, dura 10), durazno chileno (5 días, dura 7)
--     sobrestock:     kiwi cilíndrico chileno (80 cajas, se vende 1 al día)
--     por reponer:    pera gaucho premium (casi no queda y se vende todos los días)
--     se acabó:       albaricoque extra (se vendió todo)
-- - Los productos y sus precios son los del inventario del dueño (scripts/demo/catalogo-real.sql). Las cantidades y
--   los clientes son inventados.
-- - Son datos falsos: en el proyecto quedan en el historial y se anulan, no se borran (CLAUDE.md).
--
-- Uso: en local, docker exec -i supabase_db_fructus psql -U postgres < scripts/demo/historia-demo.sql
--      en el proyecto, solo con OK de quien dirige el proyecto.
-- =============================================================================

-- El producto por su nombre completo, como se ve en pantalla: «Pera Gaucho Premium», o con el calibre si hace falta para no
-- confundirlo («Manzana Roja americana Premium 113»). Si no hay exactamente uno, se dice y se para (ADR-0016).
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

create or replace function pg_temp.mover(p_tabla text, p_id bigint, p_fecha timestamptz) returns void language plpgsql as $$
begin
  execute format('update %I set fecha = $1 where id = $2', p_tabla) using p_fecha, p_id;
  if p_tabla = 'ventas' then update movimientos_stock set fecha = p_fecha where venta_id = p_id; end if;
  if p_tabla = 'compras' then update movimientos_stock set fecha = p_fecha where compra_id = p_id; end if;
end $$;

create or replace function pg_temp.items(p jsonb, p_clave text) returns jsonb language sql stable as $$
  select jsonb_agg(jsonb_build_object('producto_id', pg_temp.producto(i ->> 0), 'cantidad', i -> 1, p_clave, i -> 2))
    from jsonb_array_elements(p) i
$$;

create or replace function pg_temp.comprar(p_proveedor text, p_items jsonb, p_fecha timestamptz) returns void language plpgsql as $$
declare v_id bigint;
begin
  v_id := registrar_compra(jsonb_build_object('proveedor_id', (select id from proveedores where nombre = p_proveedor),
    'condicion', 'contado', 'medio_pago', 'transferencia', 'items', pg_temp.items(p_items, 'costo_unitario')));
  perform pg_temp.mover('compras', v_id, p_fecha);
end $$;

create or replace function pg_temp.vender(p_cliente text, p_condicion text, p_medio text, p_items jsonb, p_fecha timestamptz) returns void language plpgsql as $$
declare v_id bigint;
begin
  v_id := registrar_venta(jsonb_build_object('cliente_id', (select id from clientes where nombre = p_cliente),
    'condicion', p_condicion, 'medio_pago', p_medio, 'items', pg_temp.items(p_items, 'precio_unitario')));
  perform pg_temp.mover('ventas', v_id, p_fecha);
end $$;

do $$
declare
  v_hoy    timestamptz := ((now() at time zone 'America/Lima')::date)::timestamp at time zone 'America/Lima';
  v_perfil uuid := (select id from perfiles where activo and rol in ('duenio', 'administrador') order by rol limit 1);
  v_dia    timestamptz;
  v        jsonb;
  -- Las ventas de un día normal: [cliente, condición, medio, items, hora]. Cada día cambia un poco la cantidad.
  v_ventas jsonb := '[
    ["Juguería El Paraíso", "contado", "yape",          [["Naranja Valencia", 6, 40]],                            7.2],
    ["Luis Paredes",        "credito", null,            [["Manzana Royal Comercial", 8, 110]],                        8.0],
    [null,                  "contado", "efectivo",      [["Manzana Verde Comercial", 3, 140]],                      8.6],
    ["Restaurante Mochica", "contado", "transferencia", [["Pera Gaucho Premium", 5, 150], ["Kiwi Riñón chileno", 2, 160]], 9.3],
    ["Bodega Santa Ana",    "credito", null,            [["Pera Cesta", 3, 110]],                         10.1],
    ["Rosa Quispe",         "contado", "efectivo",      [["Manzana Roja americana Premium 113", 2, 190], ["Albaricoque Extra", 2, 110]], 11.0],
    ["Carlos Mendoza",      "credito", null,            [["Manzana Royal Comercial", 4, 110]],                        12.4],
    [null,                  "contado", "yape",          [["Pera Salud", 2, 100], ["Naranja Valencia", 2, 40]], 14.2],
    ["Juguería El Paraíso", "contado", "plin",          [["Pera Gaucho Premium", 2, 150]],                          16.5]
  ]';
begin
  if v_perfil is null then raise exception 'No hay un perfil activo de dueño o administrador'; end if;
  perform pg_temp.producto('Manzana Royal Comercial'); -- sin el catálogo real, se para aquí con el aviso
  perform set_config('request.jwt.claims', json_build_object('sub', v_perfil, 'role', 'authenticated')::text, true);

  -- Mercadería con la que arrancan las dos semanas.
  perform pg_temp.comprar('Agrícola Chao', '[["Manzana Royal Comercial", 40, 100], ["Manzana Verde Comercial", 12, 125], ["Naranja Valencia", 30, 30],
    ["Pera Gaucho Premium", 25, 140], ["Kiwi Riñón chileno", 10, 145], ["Pera Cesta", 12, 100], ["Manzana Roja americana Premium 113", 8, 180],
    ["Pera Salud", 8, 90], ["Albaricoque Extra", 14, 100]]', v_hoy - interval '14 days' + interval '6 hours');

  for d in reverse 13..1 loop
    v_dia := v_hoy - make_interval(days => d);

    -- Cada 3 días llega fruta (la pera Gaucho llega corta a propósito: termina por reponer).
    if d % 3 = 1 then
      perform pg_temp.comprar(case when d % 2 = 0 then 'Transportes Piura Norte' else 'Agrícola Chao' end,
        '[["Manzana Royal Comercial", 36, 100], ["Manzana Verde Comercial", 9, 125], ["Naranja Valencia", 24, 30], ["Pera Gaucho Premium", 15, 140],
          ["Kiwi Riñón chileno", 6, 145], ["Pera Cesta", 9, 100], ["Manzana Roja americana Premium 113", 6, 180], ["Pera Salud", 6, 90]]',
        v_dia + interval '6 hours');
      insert into gastos (categoria, monto, medio_pago, descripcion, fecha) values ('flete', 120, 'efectivo', 'Flete', v_dia + interval '6 hours 30 minutes');
    end if;

    -- El arándano se vende hasta acabarse (14 iniciales + 12 a mitad de semana = 26 = 13 días × 2).
    if d = 7 then perform pg_temp.comprar('Agrícola Chao', '[["Albaricoque Extra", 12, 100]]', v_dia + interval '6 hours'); end if;

    for v in select * from jsonb_array_elements(v_ventas) loop
      perform pg_temp.vender(v ->> 0, v ->> 1, v ->> 2, v -> 3, v_dia + make_interval(mins => round((v ->> 4)::numeric * 60)::int + d));
    end loop;

    insert into gastos (categoria, monto, medio_pago, descripcion, fecha) values ('personal', 60, 'efectivo', 'Cargador', v_dia + interval '17 hours');
    if d % 2 = 0 then
      insert into abonos (cliente_id, monto, medio_pago, fecha) values
        ((select id from clientes where nombre = case when d % 4 = 0 then 'Luis Paredes' else 'Bodega Santa Ana' end), 300 + d * 20,
         (case when d % 4 = 0 then 'yape' else 'efectivo' end)::medio_pago, v_dia + interval '15 hours');
    end if;
    if d % 5 = 0 then
      insert into movimientos_stock (producto_id, tipo, cantidad, motivo, fecha)
      values (pg_temp.producto('Naranja Valencia'), 'merma', -1, 'se malogró', v_dia + interval '17 hours 30 minutes');
    end if;
  end loop;

  -- Lotes que el dashboard tiene que encontrar.
  perform pg_temp.comprar('Agrícola Chao', '[["Caqui Super", 6, 120]]', v_hoy - interval '9 days' + interval '6 hours');          -- sin movimiento
  perform pg_temp.comprar('Agrícola Chao', '[["Naranja Wando", 15, 170]]', v_hoy - interval '6 days' + interval '6 hours');    -- por malograrse
  perform pg_temp.comprar('Agrícola Chao', '[["Ciruela chilena Fortuna", 20, 140], ["Durazno chileno", 12, 140]]', v_hoy - interval '5 days' + interval '6 hours');
  perform pg_temp.comprar('Transportes Piura Norte', '[["Kiwi Cilíndrico chileno", 80, 200]]', v_hoy - interval '2 days' + interval '6 hours'); -- sobrestock
  for d in reverse 5..1 loop
    perform pg_temp.vender('Rosa Quispe', 'contado', 'efectivo', '[["Ciruela chilena Fortuna", 2, 160]]', v_hoy - make_interval(days => d) + interval '13 hours');
    perform pg_temp.vender(null, 'contado', 'yape', '[["Durazno chileno", 1, 150]]', v_hoy - make_interval(days => d) + interval '15 hours');
    if d <= 2 then
      perform pg_temp.vender('Restaurante Mochica', 'contado', 'transferencia', '[["Kiwi Cilíndrico chileno", 1, 220]]', v_hoy - make_interval(days => d) + interval '10 hours');
    end if;
  end loop;
  for d in reverse 6..1 loop
    perform pg_temp.vender('Juguería El Paraíso', 'credito', null, '[["Naranja Wando", 1, 190]]', v_hoy - make_interval(days => d) + interval '12 hours');
  end loop;
end $$;

select p.nombre || coalesce(' ' || p.variedad, '') as producto, s.stock
  from v_stock s join productos p on p.id = s.producto_id
 where s.stock <> 0 order by s.stock;
