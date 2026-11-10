-- =============================================================================
-- Un día de demo con el catálogo real del puesto (scripts/demo/catalogo-real.sql), para mostrar Fructus con datos.
--
-- - Todo entra por las RPC reales (registrar_compra, registrar_venta), así cuadran stock, deudas e invariantes.
-- - Queda a nombre del primer perfil activo de dueño (o administrador): toda operación necesita un perfil.
-- - Ayer: compras y 4 ventas al crédito (las deudas). Hoy: compras temprano, 14 ventas, 2 abonos, 1 merma, 2 gastos,
--   repartidos entre las 6 a. m. y unos minutos antes de ahora (Lima). Nunca quedan en el futuro.
-- - Para otro día: select set_config('fructus.demo_fecha', '2026-10-29', false); antes de correrlo.
-- - Son datos falsos. Si se cargan en el proyecto, quedan en el historial: se anulan, no se borran (CLAUDE.md).
--
-- Uso: en local, npx supabase db query --local -f scripts/demo/dia-demo.sql
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

-- [producto, cantidad, precio] → los items que esperan las RPC.
create or replace function pg_temp.items(p jsonb, p_clave text) returns jsonb language sql stable as $$
  select jsonb_agg(jsonb_build_object('producto_id', pg_temp.producto(i ->> 0), 'cantidad', i -> 1, p_clave, i -> 2))
    from jsonb_array_elements(p) i
$$;

do $$
declare
  v_dia    date := coalesce(nullif(current_setting('fructus.demo_fecha', true), '')::date, (now() at time zone 'America/Lima')::date);
  v_inicio timestamptz := (v_dia::timestamp) at time zone 'America/Lima';
  v_desde  timestamptz;
  v_hasta  timestamptz;
  v_ayer   timestamptz := v_inicio - interval '6 hours';
  v_perfil uuid := (select id from perfiles where activo and rol in ('duenio', 'administrador') order by rol limit 1);
  v_id     bigint;
  v        jsonb;
  -- [cliente o null, condición, medio, items, momento del día entre 0 y 1]
  v_ventas jsonb := '[
    ["Juguería El Paraíso", "contado", "yape",          [["Naranja Valencia", 10, 40], ["Piña", 6, 38]],    0.04],
    ["Luis Paredes",        "credito", null,            [["Manzana Royal Comercial", 10, 110]],                            0.11],
    [null,                  "contado", "efectivo",      [["Manzana Verde Comercial", 4, 140]],                           0.18],
    ["Restaurante Mochica", "contado", "transferencia", [["Kiwi Riñón chileno", 5, 160], ["Uva sin pepa", 4, 110]],  0.24],
    ["Bodega Santa Ana",    "credito", null,            [["Pera Gaucho Premium", 12, 150]],                              0.31],
    ["Rosa Quispe",         "contado", "efectivo",      [["Tuna", 8, 70]],                           0.38],
    ["Carlos Mendoza",      "credito", null,            [["Manzana Roja americana Premium 113", 6, 190]],                                0.45],
    ["Juguería El Paraíso", "contado", "yape",          [["Tuna", 15, 70]],                        0.52],
    [null,                  "contado", "efectivo",      [["Pera Salud", 3, 100]],                       0.58],
    ["Restaurante Mochica", "contado", "transferencia", [["Manzana Royal Comercial", 8, 110]],                           0.65],
    ["Luis Paredes",        "credito", null,            [["Uva sin pepa", 6, 110]],                                 0.72],
    [null,                  "contado", "yape",          [["Piña", 10, 38]],                               0.80],
    ["Bodega Santa Ana",    "contado", "efectivo",      [["Pera Cesta", 8, 110]],                            0.88],
    ["Rosa Quispe",         "credito", null,            [["Manzana Verde Comercial", 5, 140]],                           0.95]
  ]';
begin
  if v_perfil is null then raise exception 'No hay un perfil activo de dueño o administrador'; end if;
  perform pg_temp.producto('Manzana Royal Comercial'); -- sin el catálogo real, se para aquí con el aviso
  perform set_config('request.jwt.claims', json_build_object('sub', v_perfil, 'role', 'authenticated')::text, true);

  -- El tramo del día: de 6 a. m. a ahora si es hoy; de 6 a. m. a 7 p. m. si es otro día.
  v_hasta := least(now() - interval '5 minutes', v_inicio + interval '19 hours');
  v_desde := case when v_hasta > v_inicio + interval '7 hours' then v_inicio + interval '6 hours' else v_inicio end;

  -- Ayer: llega fruta y quedan cuatro deudas.
  v_id := registrar_compra(jsonb_build_object('proveedor_id', (select id from proveedores where nombre = 'Transportes Piura Norte'),
    'condicion', 'contado', 'medio_pago', 'transferencia', 'items', pg_temp.items('[
      ["Manzana Royal Comercial", 60, 100], ["Pera Gaucho Premium", 40, 140], ["Kiwi Riñón chileno", 30, 145], ["Naranja Valencia", 50, 30]]', 'costo_unitario')));
  perform pg_temp.mover('compras', v_id, v_ayer - interval '9 hours');
  for v in select * from jsonb_array_elements('[
      ["Luis Paredes", [["Manzana Royal Comercial", 8, 110]], 5], ["Bodega Santa Ana", [["Pera Gaucho Premium", 10, 150]], 4],
      ["Rosa Quispe", [["Kiwi Riñón chileno", 6, 160]], 3], ["Restaurante Mochica", [["Naranja Valencia", 12, 40]], 2]]'::jsonb) loop
    v_id := registrar_venta(jsonb_build_object('cliente_id', (select id from clientes where nombre = v ->> 0), 'condicion', 'credito',
      'items', pg_temp.items(v -> 1, 'precio_unitario')));
    perform pg_temp.mover('ventas', v_id, v_ayer - make_interval(hours => (v ->> 2)::int));
  end loop;

  -- Hoy, temprano: la fruta de Chao.
  -- Una compra de este tamaño se paga por transferencia: en efectivo dejaría la caja del día en negativo.
  v_id := registrar_compra(jsonb_build_object('proveedor_id', (select id from proveedores where nombre = 'Agrícola Chao'),
    'condicion', 'contado', 'medio_pago', 'transferencia', 'items', pg_temp.items('[
      ["Manzana Verde Comercial", 30, 125], ["Uva sin pepa", 25, 100], ["Piña", 40, 34], ["Manzana Roja americana Premium 113", 20, 180],
      ["Tuna", 60, 65], ["Pera Salud", 20, 90], ["Pera Cesta", 20, 100]]', 'costo_unitario')));
  perform pg_temp.mover('compras', v_id, v_desde);

  for v in select * from jsonb_array_elements(v_ventas) loop
    v_id := registrar_venta(jsonb_build_object(
      'cliente_id', (select id from clientes where nombre = v ->> 0), 'condicion', v ->> 1, 'medio_pago', v -> 2,
      'items', pg_temp.items(v -> 3, 'precio_unitario')));
    perform pg_temp.mover('ventas', v_id, v_desde + (v_hasta - v_desde) * (v ->> 4)::numeric);
  end loop;

  insert into abonos (cliente_id, monto, medio_pago, fecha) values
    ((select id from clientes where nombre = 'Luis Paredes'),     500, 'yape',     v_desde + (v_hasta - v_desde) * 0.35),
    ((select id from clientes where nombre = 'Bodega Santa Ana'), 600, 'efectivo', v_desde + (v_hasta - v_desde) * 0.76);
  insert into movimientos_stock (producto_id, tipo, cantidad, motivo, fecha)
  values (pg_temp.producto('Tuna'), 'merma', -2, 'se malogró', v_desde + (v_hasta - v_desde) * 0.62);
  insert into gastos (categoria, monto, medio_pago, descripcion, fecha) values
    ('flete',    120, 'efectivo', 'Flete de Chao', v_desde + (v_hasta - v_desde) * 0.02),
    ('personal',  60, 'efectivo', 'Cargador',      v_desde + (v_hasta - v_desde) * 0.70);
end $$;

select (resumen_dia(((now() at time zone 'America/Lima')::date))) as resumen_de_hoy;
