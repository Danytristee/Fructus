-- =============================================================================
-- Dos semanas de demo (los 13 días antes de hoy), para que Clientes, Stock, Ventas y Cierre se vean como un puesto que ya
-- trabaja. Va después de catalogo-proyeccion.sql y antes de dia-demo.sql (que agrega el día de hoy).
--
-- - Todo entra por las RPC reales (registrar_compra, registrar_venta): cuadran stock, deudas e invariantes.
-- - Queda a nombre del primer perfil activo de dueño o administrador.
-- - Deja a propósito lotes que el dashboard de inventario tiene que detectar (lib/inventario-reglas.ts):
--     por malograrse: papaya (5 días), chirimoya (5 días), tuna (6 días)
--     sobrestock:     kiwi Cope (80 cajas, se vende 1 al día)
--     por reponer:    pera Gaucho (casi no queda y se vende todos los días)
--     se acabó:       arándano (se vendió todo)
--     sin movimiento: kaki (6 cajas, ninguna venta en la semana)
-- - Son datos falsos: en el proyecto quedan en el historial y se anulan, no se borran (CLAUDE.md).
--
-- Uso: en local, docker exec -i supabase_db_fructus psql -U postgres < scripts/demo/historia-demo.sql
--      en el proyecto, solo con OK de quien dirige el proyecto.
-- =============================================================================

create or replace function pg_temp.producto(p_nombre text, p_variedad text) returns bigint language sql stable as $$
  select id from productos
   where lower(nombre) = lower(p_nombre) and lower(coalesce(variedad, '')) = lower(coalesce(p_variedad, ''))
$$;

create or replace function pg_temp.mover(p_tabla text, p_id bigint, p_fecha timestamptz) returns void language plpgsql as $$
begin
  execute format('update %I set fecha = $1 where id = $2', p_tabla) using p_fecha, p_id;
  if p_tabla = 'ventas' then update movimientos_stock set fecha = p_fecha where venta_id = p_id; end if;
  if p_tabla = 'compras' then update movimientos_stock set fecha = p_fecha where compra_id = p_id; end if;
end $$;

create or replace function pg_temp.items(p jsonb, p_clave text) returns jsonb language sql stable as $$
  select jsonb_agg(jsonb_build_object('producto_id', pg_temp.producto(i ->> 0, i ->> 1), 'cantidad', i -> 2, p_clave, i -> 3))
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
    ["Juguería El Paraíso", "contado", "yape",          [["Naranja", null, 6, 75]],                            7.2],
    ["Luis Paredes",        "credito", null,            [["Manzana", "Royal", 8, 129]],                        8.0],
    [null,                  "contado", "efectivo",      [["Manzana", "Crispin", 3, 130]],                      8.6],
    ["Restaurante Mochica", "contado", "transferencia", [["Pera", "Gaucho", 5, 121], ["Kiwi", "importado", 2, 140]], 9.3],
    ["Bodega Santa Ana",    "credito", null,            [["Pera", "chilena", 3, 121]],                         10.1],
    ["Rosa Quispe",         "contado", "efectivo",      [["Mango", "Kent", 2, 102], ["Arándano", null, 2, 91]], 11.0],
    ["Carlos Mendoza",      "credito", null,            [["Manzana", "Royal", 4, 129]],                        12.4],
    [null,                  "contado", "yape",          [["Granadilla", "selección", 2, 54], ["Naranja", null, 2, 75]], 14.2],
    ["Juguería El Paraíso", "contado", "plin",          [["Pera", "Gaucho", 2, 121]],                          16.5]
  ]';
begin
  if v_perfil is null then raise exception 'No hay un perfil activo de dueño o administrador'; end if;
  if pg_temp.producto('Manzana', 'Royal') is null then raise exception 'Falta el catálogo: corre antes scripts/demo/catalogo-proyeccion.sql'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_perfil, 'role', 'authenticated')::text, true);

  -- Mercadería con la que arrancan las dos semanas.
  perform pg_temp.comprar('Agrícola Chao', '[["Manzana", "Royal", 40, 124.56], ["Manzana", "Crispin", 12, 124.56], ["Naranja", null, 30, 72.66],
    ["Pera", "Gaucho", 25, 117.30], ["Kiwi", "importado", 10, 134.94], ["Pera", "chilena", 12, 117.30], ["Mango", "Kent", 8, 98.61],
    ["Granadilla", "selección", 8, 51.90], ["Arándano", null, 14, 88.23]]', v_hoy - interval '14 days' + interval '6 hours');

  for d in reverse 13..1 loop
    v_dia := v_hoy - make_interval(days => d);

    -- Cada 3 días llega fruta (la pera Gaucho llega corta a propósito: termina por reponer).
    if d % 3 = 1 then
      perform pg_temp.comprar(case when d % 2 = 0 then 'Transportes Piura Norte' else 'Agrícola Chao' end,
        '[["Manzana", "Royal", 36, 124.56], ["Manzana", "Crispin", 9, 124.56], ["Naranja", null, 24, 72.66], ["Pera", "Gaucho", 15, 117.30],
          ["Kiwi", "importado", 6, 134.94], ["Pera", "chilena", 9, 117.30], ["Mango", "Kent", 6, 98.61], ["Granadilla", "selección", 6, 51.90]]',
        v_dia + interval '6 hours');
      insert into gastos (categoria, monto, medio_pago, descripcion, fecha) values ('flete', 120, 'efectivo', 'Flete', v_dia + interval '6 hours 30 minutes');
    end if;

    -- El arándano se vende hasta acabarse (14 iniciales + 12 a mitad de semana = 26 = 13 días × 2).
    if d = 7 then perform pg_temp.comprar('Agrícola Chao', '[["Arándano", null, 12, 88.23]]', v_dia + interval '6 hours'); end if;

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
      values (pg_temp.producto('Naranja', null), 'merma', -1, 'se malogró', v_dia + interval '17 hours 30 minutes');
    end if;
  end loop;

  -- Lotes que el dashboard tiene que encontrar.
  perform pg_temp.comprar('Agrícola Chao', '[["Kaki", null, 6, 108.99]]', v_hoy - interval '9 days' + interval '6 hours');          -- sin movimiento
  perform pg_temp.comprar('Agrícola Chao', '[["Tuna", "selección", 15, 62.28]]', v_hoy - interval '6 days' + interval '6 hours');    -- por malograrse
  perform pg_temp.comprar('Agrícola Chao', '[["Papaya", null, 20, 46.71], ["Chirimoya", "selección", 12, 57.09]]', v_hoy - interval '5 days' + interval '6 hours');
  perform pg_temp.comprar('Transportes Piura Norte', '[["Kiwi", "Cope", 80, 134.94]]', v_hoy - interval '2 days' + interval '6 hours'); -- sobrestock
  for d in reverse 5..1 loop
    perform pg_temp.vender('Rosa Quispe', 'contado', 'efectivo', '[["Papaya", null, 2, 48]]', v_hoy - make_interval(days => d) + interval '13 hours');
    perform pg_temp.vender(null, 'contado', 'yape', '[["Chirimoya", "selección", 1, 59]]', v_hoy - make_interval(days => d) + interval '15 hours');
    if d <= 2 then
      perform pg_temp.vender('Restaurante Mochica', 'contado', 'transferencia', '[["Kiwi", "Cope", 1, 139]]', v_hoy - make_interval(days => d) + interval '10 hours');
    end if;
  end loop;
  for d in reverse 6..1 loop
    perform pg_temp.vender('Juguería El Paraíso', 'credito', null, '[["Tuna", "selección", 1, 64]]', v_hoy - make_interval(days => d) + interval '12 hours');
  end loop;
end $$;

select p.nombre || coalesce(' ' || p.variedad, '') as producto, s.stock
  from v_stock s join productos p on p.id = s.producto_id
 where s.stock <> 0 order by s.stock;
