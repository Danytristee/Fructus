-- =============================================================================
-- Fructus — esquema inicial
-- ERP por voz para un mayorista de frutas de La Hermelinda (Trujillo).
--
-- Principios que este esquema protege:
--   1. El stock es la suma de movimientos (nunca un número que se edita a mano).
--   2. La deuda de un cliente = ventas al crédito − abonos (nunca un saldo editable).
--   3. Todo lo que entra por voz deja rastro en comandos_voz (para medir precisión).
--   4. Las ventas se registran por RPC (registrar_venta) para que venta, ítems y
--      salida de stock ocurran juntos o no ocurran.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type rol_usuario        as enum ('duenio', 'administrador', 'ayudante', 'contador');
create type condicion_pago     as enum ('contado', 'credito');
create type medio_pago         as enum ('efectivo', 'yape', 'plin', 'transferencia', 'otro');
create type tipo_movimiento    as enum ('entrada_compra', 'salida_venta', 'merma', 'ajuste', 'devolucion');
create type estado_comprobante as enum ('pendiente', 'enviado', 'aceptado', 'rechazado', 'anulado');

-- -----------------------------------------------------------------------------
-- Usuarios y roles
-- -----------------------------------------------------------------------------
create table perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null,
  rol        rol_usuario not null default 'ayudante',
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- Rol del usuario autenticado (null si no tiene perfil activo).
create or replace function rol_actual()
returns rol_usuario
language sql stable security definer
set search_path = public
as $$
  select rol from perfiles where id = auth.uid() and activo
$$;

-- -----------------------------------------------------------------------------
-- Comandos de voz (se crea primero: varias tablas la referencian)
-- -----------------------------------------------------------------------------
create table comandos_voz (
  id                bigint generated always as identity primary key,
  transcripcion     text not null,
  intencion         text,                       -- registrar_venta, registrar_abono, ...
  interpretacion    jsonb,                      -- salida cruda del intérprete
  resultado         text not null default 'pendiente'
                    check (resultado in ('pendiente', 'confirmado', 'corregido', 'descartado', 'no_entendido')),
  duracion_audio_ms integer,
  latencia_ms       integer,                    -- de soltar el botón a ver la tarjeta
  modelo_stt        text,
  modelo_llm        text,
  registrado_por    uuid not null default auth.uid() references perfiles (id),
  creado_en         timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Catálogos
-- -----------------------------------------------------------------------------
create table productos (
  id                bigint generated always as identity primary key,
  nombre            text not null,              -- 'Mango'
  variedad          text,                       -- 'Kent'
  unidad            text not null default 'jaba',
  alias             text[] not null default '{}',
  precio_referencia numeric(10,2) check (precio_referencia >= 0),
  -- Catálogo 07 SUNAT. '20' = exonerado (frutas frescas, Apéndice I Ley del IGV).
  -- Confirmar con el contador antes de producción.
  afectacion_igv    text not null default '20',
  activo            boolean not null default true,
  creado_en         timestamptz not null default now(),
  unique nulls not distinct (nombre, variedad)
);

create table clientes (
  id               bigint generated always as identity primary key,
  nombre           text not null,
  alias            text[] not null default '{}',  -- 'don Lucho', 'la señora del puesto 12'
  tipo_documento   text check (tipo_documento in ('RUC', 'DNI')),
  numero_documento text,
  direccion        text,
  telefono         text,
  limite_credito   numeric(12,2) check (limite_credito >= 0),
  notas            text,
  activo           boolean not null default true,
  creado_en        timestamptz not null default now(),
  check (
       (tipo_documento is null  and numero_documento is null)
    or (tipo_documento = 'RUC'  and numero_documento ~ '^\d{11}$')
    or (tipo_documento = 'DNI'  and numero_documento ~ '^\d{8}$')
  )
);

create table proveedores (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  alias      text[] not null default '{}',
  ruc        text check (ruc ~ '^\d{11}$'),
  telefono   text,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Ventas
-- -----------------------------------------------------------------------------
create table ventas (
  id             bigint generated always as identity primary key,
  cliente_id     bigint references clientes (id),
  fecha          timestamptz not null default now(),
  condicion      condicion_pago not null,
  medio_pago     medio_pago,
  total          numeric(12,2) not null default 0 check (total >= 0),
  estado         text not null default 'registrada' check (estado in ('registrada', 'anulada')),
  comando_voz_id bigint references comandos_voz (id),
  registrado_por uuid not null default auth.uid() references perfiles (id),
  creado_en      timestamptz not null default now(),
  -- Al contado hay que saber cómo pagó; al crédito hay que saber quién debe.
  constraint venta_contado_requiere_medio_pago check (condicion = 'credito' or medio_pago is not null),
  constraint venta_credito_requiere_cliente    check (condicion = 'contado' or cliente_id is not null)
);

create table venta_items (
  id              bigint generated always as identity primary key,
  venta_id        bigint not null references ventas (id) on delete cascade,
  producto_id     bigint not null references productos (id),
  cantidad        numeric(10,2) not null check (cantidad > 0),
  precio_unitario numeric(10,2) not null check (precio_unitario >= 0),
  descuento       numeric(10,2) not null default 0 check (descuento >= 0),  -- la "rebaja"
  subtotal        numeric(12,2) generated always as (cantidad * precio_unitario - descuento) stored,
  check (descuento <= cantidad * precio_unitario)
);

-- Pagos de clientes contra su deuda (el "cuaderno").
create table abonos (
  id             bigint generated always as identity primary key,
  cliente_id     bigint not null references clientes (id),
  monto          numeric(12,2) not null check (monto > 0),
  medio_pago     medio_pago not null,
  fecha          timestamptz not null default now(),
  nota           text,
  comando_voz_id bigint references comandos_voz (id),
  registrado_por uuid not null default auth.uid() references perfiles (id)
);

-- -----------------------------------------------------------------------------
-- Compras y gastos (egresos)
-- -----------------------------------------------------------------------------
create table compras (
  id                 bigint generated always as identity primary key,
  proveedor_id       bigint references proveedores (id),
  fecha              timestamptz not null default now(),
  condicion          condicion_pago not null default 'contado',
  medio_pago         medio_pago,
  total              numeric(12,2) not null default 0 check (total >= 0),
  numero_comprobante text,                       -- factura del proveedor, si la dio
  comando_voz_id     bigint references comandos_voz (id),
  registrado_por     uuid not null default auth.uid() references perfiles (id),
  creado_en          timestamptz not null default now()
);

create table compra_items (
  id             bigint generated always as identity primary key,
  compra_id      bigint not null references compras (id) on delete cascade,
  producto_id    bigint not null references productos (id),
  cantidad       numeric(10,2) not null check (cantidad > 0),
  costo_unitario numeric(10,2) not null check (costo_unitario >= 0),
  subtotal       numeric(12,2) generated always as (cantidad * costo_unitario) stored
);

create table gastos (
  id             bigint generated always as identity primary key,
  categoria      text not null check (categoria in ('flete', 'alquiler', 'servicios', 'personal', 'otros')),
  monto          numeric(12,2) not null check (monto > 0),
  medio_pago     medio_pago not null default 'efectivo',
  descripcion    text,
  fecha          timestamptz not null default now(),
  comando_voz_id bigint references comandos_voz (id),
  registrado_por uuid not null default auth.uid() references perfiles (id)
);

-- -----------------------------------------------------------------------------
-- Stock: libro de movimientos. El stock actual es la suma (ver v_stock).
-- -----------------------------------------------------------------------------
create table movimientos_stock (
  id             bigint generated always as identity primary key,
  producto_id    bigint not null references productos (id),
  tipo           tipo_movimiento not null,
  cantidad       numeric(10,2) not null check (cantidad <> 0),  -- + entra, − sale
  venta_id       bigint references ventas (id) on delete cascade,
  compra_id      bigint references compras (id) on delete cascade,
  motivo         text,                                          -- 'se malogró', 'conteo'
  fecha          timestamptz not null default now(),
  comando_voz_id bigint references comandos_voz (id),
  registrado_por uuid not null default auth.uid() references perfiles (id),
  check (
       (tipo in ('salida_venta', 'merma')         and cantidad < 0)
    or (tipo in ('entrada_compra', 'devolucion')  and cantidad > 0)
    or  tipo = 'ajuste'
  )
);

-- -----------------------------------------------------------------------------
-- Comprobantes electrónicos (demo: sandbox de Lucode)
-- -----------------------------------------------------------------------------
create table series_comprobante (
  serie         text primary key,
  tipo          text not null check (tipo in ('01', '03')),  -- 01 factura, 03 boleta
  ultimo_numero integer not null default 0
);

create table comprobantes (
  id             bigint generated always as identity primary key,
  venta_id       bigint not null references ventas (id),
  tipo           text not null check (tipo in ('01', '03')),
  serie          text not null references series_comprobante (serie),
  numero         integer not null,
  estado         estado_comprobante not null default 'pendiente',
  ambiente       text not null default 'sandbox' check (ambiente in ('sandbox', 'produccion')),
  respuesta      jsonb,                                       -- respuesta cruda del proveedor
  pdf_url        text,
  xml_url        text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (serie, numero, ambiente)
);

-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------
create index on ventas (fecha);
create index on ventas (cliente_id);
create index on venta_items (venta_id);
create index on abonos (cliente_id);
create index on abonos (fecha);
create index on movimientos_stock (producto_id);
create index on gastos (fecha);
create index on compras (fecha);
create index on comprobantes (venta_id);

-- -----------------------------------------------------------------------------
-- Vistas (security_invoker: respetan el RLS de quien consulta)
-- -----------------------------------------------------------------------------
create view v_stock with (security_invoker = true) as
select p.id                         as producto_id,
       p.nombre,
       p.variedad,
       p.unidad,
       coalesce(sum(m.cantidad), 0) as stock
from productos p
left join movimientos_stock m on m.producto_id = p.id
where p.activo
group by p.id;

create view v_saldo_clientes with (security_invoker = true) as
select c.id                                                  as cliente_id,
       c.nombre,
       c.alias,
       coalesce(v.total_credito, 0) - coalesce(a.total_abonos, 0) as saldo,
       v.ultima_venta_credito,
       a.ultimo_abono
from clientes c
left join (
  select cliente_id, sum(total) as total_credito, max(fecha) as ultima_venta_credito
  from ventas
  where condicion = 'credito' and estado = 'registrada'
  group by cliente_id
) v on v.cliente_id = c.id
left join (
  select cliente_id, sum(monto) as total_abonos, max(fecha) as ultimo_abono
  from abonos
  group by cliente_id
) a on a.cliente_id = c.id;

-- -----------------------------------------------------------------------------
-- Funciones de negocio (RPC)
-- -----------------------------------------------------------------------------

-- Registra una venta completa en una sola transacción.
-- p = {
--   "cliente_id": 12 | null,
--   "condicion": "contado" | "credito",
--   "medio_pago": "yape" | ... | null,
--   "comando_voz_id": 33 | null,
--   "items": [{"producto_id": 1, "cantidad": 10, "precio_unitario": 45, "descuento": 0}]
-- }
create or replace function registrar_venta(p jsonb)
returns bigint
language plpgsql security invoker
set search_path = public
as $$
declare
  v_id    bigint;
  v_item  jsonb;
  v_voz   bigint := (p ->> 'comando_voz_id')::bigint;
  v_total numeric(12,2);
begin
  if jsonb_array_length(coalesce(p -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  -- El total se calcula antes de insertar: el ayudante puede insertar ventas
  -- pero no actualizarlas (RLS), así que no hay un "update total" después.
  select sum((i ->> 'cantidad')::numeric * (i ->> 'precio_unitario')::numeric
             - coalesce((i ->> 'descuento')::numeric, 0))
    into v_total
    from jsonb_array_elements(p -> 'items') i;

  insert into ventas (cliente_id, condicion, medio_pago, total, comando_voz_id)
  values ((p ->> 'cliente_id')::bigint,
          (p ->> 'condicion')::condicion_pago,
          (p ->> 'medio_pago')::medio_pago,
          v_total,
          v_voz)
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    insert into venta_items (venta_id, producto_id, cantidad, precio_unitario, descuento)
    values (v_id,
            (v_item ->> 'producto_id')::bigint,
            (v_item ->> 'cantidad')::numeric,
            (v_item ->> 'precio_unitario')::numeric,
            coalesce((v_item ->> 'descuento')::numeric, 0));

    insert into movimientos_stock (producto_id, tipo, cantidad, venta_id, comando_voz_id)
    values ((v_item ->> 'producto_id')::bigint,
            'salida_venta',
            -((v_item ->> 'cantidad')::numeric),
            v_id,
            v_voz);
  end loop;

  if v_voz is not null then
    update comandos_voz set resultado = 'confirmado' where id = v_voz and resultado = 'pendiente';
  end if;

  return v_id;
end;
$$;

-- Registra una compra a proveedor (egreso + entrada de stock).
-- p = { "proveedor_id", "condicion", "medio_pago", "numero_comprobante", "comando_voz_id",
--       "items": [{"producto_id", "cantidad", "costo_unitario"}] }
create or replace function registrar_compra(p jsonb)
returns bigint
language plpgsql security invoker
set search_path = public
as $$
declare
  v_id    bigint;
  v_item  jsonb;
  v_voz   bigint := (p ->> 'comando_voz_id')::bigint;
  v_total numeric(12,2);
begin
  if jsonb_array_length(coalesce(p -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'La compra no tiene productos';
  end if;

  select sum((i ->> 'cantidad')::numeric * (i ->> 'costo_unitario')::numeric)
    into v_total
    from jsonb_array_elements(p -> 'items') i;

  insert into compras (proveedor_id, condicion, medio_pago, total, numero_comprobante, comando_voz_id)
  values ((p ->> 'proveedor_id')::bigint,
          coalesce((p ->> 'condicion')::condicion_pago, 'contado'),
          (p ->> 'medio_pago')::medio_pago,
          v_total,
          p ->> 'numero_comprobante',
          v_voz)
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    insert into compra_items (compra_id, producto_id, cantidad, costo_unitario)
    values (v_id,
            (v_item ->> 'producto_id')::bigint,
            (v_item ->> 'cantidad')::numeric,
            (v_item ->> 'costo_unitario')::numeric);

    insert into movimientos_stock (producto_id, tipo, cantidad, compra_id, comando_voz_id)
    values ((v_item ->> 'producto_id')::bigint,
            'entrada_compra',
            (v_item ->> 'cantidad')::numeric,
            v_id,
            v_voz);
  end loop;

  if v_voz is not null then
    update comandos_voz set resultado = 'confirmado' where id = v_voz and resultado = 'pendiente';
  end if;

  return v_id;
end;
$$;

-- Anula una venta y devuelve su stock. No se puede si ya tiene comprobante
-- enviado o aceptado: en ese caso corresponde una nota de crédito.
create or replace function anular_venta(p_venta_id bigint)
returns void
language plpgsql security invoker
set search_path = public
as $$
begin
  -- Con RLS, un update sin permiso no falla: simplemente no toca filas.
  -- Por eso se verifica el rol explícitamente.
  if rol_actual() is distinct from 'duenio' and rol_actual() is distinct from 'administrador' then
    raise exception 'Solo el dueño o el administrador pueden anular ventas';
  end if;

  if exists (
    select 1 from comprobantes
    where venta_id = p_venta_id and estado in ('enviado', 'aceptado')
  ) then
    raise exception 'La venta % ya tiene comprobante en SUNAT: usar nota de crédito', p_venta_id;
  end if;

  update ventas set estado = 'anulada'
  where id = p_venta_id and estado = 'registrada';

  if not found then
    raise exception 'La venta % no existe o ya estaba anulada', p_venta_id;
  end if;

  insert into movimientos_stock (producto_id, tipo, cantidad, venta_id, motivo)
  select producto_id, 'devolucion', cantidad, p_venta_id, 'anulación de venta'
  from venta_items
  where venta_id = p_venta_id;
end;
$$;

-- Búsqueda difusa de clientes por nombre o apodo ("lucho" → "Luis Paredes").
create or replace function buscar_clientes(q text, limite integer default 5)
returns table (id bigint, nombre text, alias text[], similitud real)
language sql stable security invoker
set search_path = public, extensions
as $$
  select c.id, c.nombre, c.alias, s.similitud
  from clientes c
  cross join lateral (
    select greatest(
      similarity(lower(c.nombre), lower(q)),
      coalesce((select max(similarity(lower(a), lower(q))) from unnest(c.alias) a), 0)
    ) as similitud
  ) s
  where c.activo
  order by s.similitud desc
  limit limite
$$;

-- Búsqueda difusa de productos ("mango ken" → "Mango Kent").
create or replace function buscar_productos(q text, limite integer default 5)
returns table (id bigint, nombre text, variedad text, similitud real)
language sql stable security invoker
set search_path = public, extensions
as $$
  select p.id, p.nombre, p.variedad, s.similitud
  from productos p
  cross join lateral (
    select greatest(
      similarity(lower(p.nombre || ' ' || coalesce(p.variedad, '')), lower(q)),
      coalesce((select max(similarity(lower(a), lower(q))) from unnest(p.alias) a), 0)
    ) as similitud
  ) s
  where p.activo
  order by s.similitud desc
  limit limite
$$;

-- Último precio que se le cobró a un cliente por un producto (para sugerirlo
-- cuando no lo dicta). Si nunca le vendió, el precio de referencia.
create or replace function ultimo_precio(p_cliente_id bigint, p_producto_id bigint)
returns numeric
language sql stable security invoker
set search_path = public
as $$
  select coalesce(
    (select vi.precio_unitario
       from venta_items vi
       join ventas v on v.id = vi.venta_id
      where v.cliente_id = p_cliente_id
        and vi.producto_id = p_producto_id
        and v.estado = 'registrada'
      order by v.fecha desc
      limit 1),
    (select precio_referencia from productos where id = p_producto_id)
  )
$$;

-- Resumen de un día en hora de Lima: lo que el dueño ve al cerrar.
create or replace function resumen_dia(p_fecha date default (now() at time zone 'America/Lima')::date)
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  with r as (
    select (p_fecha::timestamp       at time zone 'America/Lima') as desde,
           ((p_fecha + 1)::timestamp at time zone 'America/Lima') as hasta
  ),
  v as (
    select ventas.* from ventas, r
    where estado = 'registrada' and fecha >= r.desde and fecha < r.hasta
  )
  select jsonb_build_object(
    'fecha',            p_fecha,
    'ventas_total',     coalesce((select sum(total) from v), 0),
    'ventas_contado',   coalesce((select sum(total) from v where condicion = 'contado'), 0),
    'ventas_credito',   coalesce((select sum(total) from v where condicion = 'credito'), 0),
    'numero_ventas',    (select count(*) from v),
    'jabas_vendidas',   coalesce((select sum(vi.cantidad) from venta_items vi join v on v.id = vi.venta_id), 0),
    'abonos',           coalesce((select sum(monto) from abonos, r where fecha >= r.desde and fecha < r.hasta), 0),
    'compras',          coalesce((select sum(total) from compras, r where fecha >= r.desde and fecha < r.hasta), 0),
    'gastos',           coalesce((select sum(monto) from gastos, r where fecha >= r.desde and fecha < r.hasta), 0),
    'por_cobrar_total', coalesce((select sum(saldo) from v_saldo_clientes where saldo > 0), 0)
  )
$$;

-- Toma el siguiente correlativo de una serie. Solo lo llama el servidor
-- (service role) al emitir un comprobante.
create or replace function tomar_numero(p_serie text)
returns integer
language sql volatile security invoker
set search_path = public
as $$
  update series_comprobante
     set ultimo_numero = ultimo_numero + 1
   where serie = p_serie
  returning ultimo_numero
$$;

-- Supabase da EXECUTE a anon y authenticated por defecto: hay que quitarlo explícitamente.
revoke execute on function tomar_numero(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Seguridad (RLS)
--   duenio / administrador : todo
--   ayudante               : lee catálogos y operaciones, registra ventas, abonos,
--                            compras, mermas, gastos y comandos de voz
--   contador               : solo lectura
--   comprobantes y series  : solo el servidor escribe (service role ignora RLS)
-- -----------------------------------------------------------------------------
alter table perfiles           enable row level security;
alter table comandos_voz       enable row level security;
alter table productos          enable row level security;
alter table clientes           enable row level security;
alter table proveedores        enable row level security;
alter table ventas             enable row level security;
alter table venta_items        enable row level security;
alter table abonos             enable row level security;
alter table compras            enable row level security;
alter table compra_items       enable row level security;
alter table gastos             enable row level security;
alter table movimientos_stock  enable row level security;
alter table series_comprobante enable row level security;
alter table comprobantes       enable row level security;

-- Perfiles: cada uno se ve a sí mismo; dueño y administrador ven y gestionan todos.
create policy perfiles_leer_propio on perfiles for select to authenticated
  using (id = auth.uid());
create policy perfiles_gestion on perfiles for all to authenticated
  using (rol_actual() in ('duenio', 'administrador'))
  with check (rol_actual() in ('duenio', 'administrador'));

-- Lectura para cualquier perfil activo.
do $$
declare t text;
begin
  foreach t in array array[
    'comandos_voz', 'productos', 'clientes', 'proveedores', 'ventas', 'venta_items',
    'abonos', 'compras', 'compra_items', 'gastos', 'movimientos_stock', 'comprobantes'
  ] loop
    execute format(
      'create policy %I on %I for select to authenticated using (rol_actual() is not null)',
      t || '_leer', t);
  end loop;
end $$;

-- Gestión completa (editar, borrar) para dueño y administrador.
do $$
declare t text;
begin
  foreach t in array array[
    'comandos_voz', 'productos', 'clientes', 'proveedores', 'ventas', 'venta_items',
    'abonos', 'compras', 'compra_items', 'gastos', 'movimientos_stock'
  ] loop
    execute format(
      'create policy %I on %I for all to authenticated
         using (rol_actual() in (''duenio'', ''administrador''))
         with check (rol_actual() in (''duenio'', ''administrador''))',
      t || '_gestion', t);
  end loop;
end $$;

-- El ayudante puede registrar (insertar) operaciones del día a día.
do $$
declare t text;
begin
  foreach t in array array[
    'comandos_voz', 'ventas', 'venta_items', 'abonos', 'compras',
    'compra_items', 'gastos', 'movimientos_stock'
  ] loop
    execute format(
      'create policy %I on %I for insert to authenticated
         with check (rol_actual() = ''ayudante'')',
      t || '_registrar_ayudante', t);
  end loop;
end $$;

-- El ayudante puede marcar el resultado de sus propios comandos de voz.
create policy comandos_voz_actualizar_propio on comandos_voz for update to authenticated
  using (registrado_por = auth.uid())
  with check (registrado_por = auth.uid());
