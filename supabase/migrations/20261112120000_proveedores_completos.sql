-- =============================================================================
-- Proveedores completos: sus datos, lo que les debes y a quién le compras qué (apartado Proveedores, 2026-11-12).
--
-- El problema:
--   1. Una compra al crédito subía la deuda con el proveedor, pero no había dónde anotar que se le pagó: la deuda con él
--      solo podía crecer. Es un estado imposible (principio 3) y deja sin fuente de verdad lo que se le debe (principio 4).
--   2. Del proveedor solo se sabía nombre, apodo, RUC y teléfono: no de dónde trae la fruta ni a quién llamar.
--   3. Para ver de quién dependes había que sumar compra_items a mano, y Supabase corta en 1000 filas.
--
-- Qué cambia:
--   1. pagos_proveedor: lo que le pagas a un proveedor. Solo se agregan filas, como abonos (nada se edita a mano). Un pago
--      puede ser mayor que la deuda: queda a favor (adelanto), igual que el abono de un cliente (decisión del 31-10).
--      Un comando de voz tiene un solo pago (índice único parcial), para cuando llegue el pago por voz.
--   2. v_saldo_proveedores: deuda = compras al crédito − pagos. Lo mismo que v_saldo_clientes, al revés.
--   3. compras_por_proveedor(desde): cuánto, cuántas cajas y a qué costo le compraste cada fruta a cada proveedor. Una fila
--      por proveedor y fruta (decenas, no miles). La compra sin proveedor anotado sale con proveedor_id null: también
--      cuenta en el total, para que el porcentaje de cada uno no se infle.
--   4. proveedores suma contacto, origen, dirección y notas; el nombre no se repite entre los activos (como clientes,
--      20261105231144) y no puede ser un texto vacío.
--
-- Antes de aplicarla a un proyecto con datos: `select lower(btrim(nombre)), count(*) from proveedores where activo group
-- by 1 having count(*) > 1` debe salir vacío.
-- =============================================================================

alter table proveedores
  add column contacto  text check (contacto  is null or btrim(contacto)  <> ''),
  add column origen    text check (origen    is null or btrim(origen)    <> ''),
  add column direccion text check (direccion is null or btrim(direccion) <> ''),
  add column notas     text check (notas     is null or btrim(notas)     <> '');

alter table proveedores add constraint proveedores_nombre_no_vacio check (btrim(nombre) <> '');
create unique index proveedores_nombre_unico on proveedores (lower(btrim(nombre))) where activo;

comment on column proveedores.contacto is 'La persona con la que se habla: «don Wilmer». El teléfono es el suyo.';
comment on column proveedores.origen   is 'De dónde trae la fruta: «Chao, La Libertad», «Mercado Mayorista de Lima».';

-- -----------------------------------------------------------------------------
-- Pagos a proveedores
-- -----------------------------------------------------------------------------
create table pagos_proveedor (
  id             bigint generated always as identity primary key,
  proveedor_id   bigint not null references proveedores (id),
  monto          numeric(12,2) not null check (monto > 0),
  medio_pago     medio_pago not null,
  fecha          timestamptz not null default now(),
  nota           text check (nota is null or btrim(nota) <> ''),
  comando_voz_id bigint references comandos_voz (id),
  registrado_por uuid not null default auth.uid() references perfiles (id)
);

create unique index pagos_proveedor_uno_por_comando_voz on pagos_proveedor (comando_voz_id) where comando_voz_id is not null;
create index pagos_proveedor_proveedor on pagos_proveedor (proveedor_id, fecha desc);
create index compras_proveedor_fecha on compras (proveedor_id, fecha desc);

alter table pagos_proveedor enable row level security;

-- Las mismas reglas que abonos: todos los perfiles leen, dueño y administrador gestionan, el ayudante registra.
create policy pagos_proveedor_leer on pagos_proveedor for select to authenticated
  using ((select rol_actual()) is not null);
create policy pagos_proveedor_gestion on pagos_proveedor for all to authenticated
  using ((select rol_actual()) in ('duenio', 'administrador'))
  with check ((select rol_actual()) in ('duenio', 'administrador'));
create policy pagos_proveedor_registrar_ayudante on pagos_proveedor for insert to authenticated
  with check ((select rol_actual()) = 'ayudante');

-- -----------------------------------------------------------------------------
-- Lo que le debes a cada proveedor
-- -----------------------------------------------------------------------------
create view v_saldo_proveedores with (security_invoker = true) as
select p.id                                                   as proveedor_id,
       p.nombre,
       p.alias,
       coalesce(c.total_credito, 0) - coalesce(g.total_pagos, 0) as saldo,
       c.ultima_compra_credito,
       g.ultimo_pago,
       p.activo
from proveedores p
left join (
  select proveedor_id, sum(total) as total_credito, max(fecha) as ultima_compra_credito
  from compras
  where condicion = 'credito'
  group by proveedor_id
) c on c.proveedor_id = p.id
left join (
  select proveedor_id, sum(monto) as total_pagos, max(fecha) as ultimo_pago
  from pagos_proveedor
  group by proveedor_id
) g on g.proveedor_id = p.id;

-- -----------------------------------------------------------------------------
-- A quién le compras qué, desde una fecha
-- -----------------------------------------------------------------------------
create function compras_por_proveedor(p_desde timestamptz)
returns table (
  proveedor_id   bigint,
  producto_id    bigint,
  compras        integer,
  cajas          numeric,
  total          numeric,
  ultima         timestamptz,
  ultimo_costo   numeric,
  costo_promedio numeric
)
language sql stable security invoker
set search_path = public
as $$
  select c.proveedor_id,
         i.producto_id,
         count(distinct c.id)::integer,
         sum(i.cantidad),
         sum(i.subtotal),
         max(c.fecha),
         (array_agg(i.costo_unitario order by c.fecha desc, i.id desc))[1],
         round(sum(i.subtotal) / sum(i.cantidad), 2)
    from compras c
    join compra_items i on i.compra_id = c.id
   where c.fecha >= p_desde
   group by c.proveedor_id, i.producto_id
$$;

-- Ninguna función propia se ejecuta sin sesión (CLAUDE.md, «Trampas de RLS»).
revoke execute on function compras_por_proveedor(timestamptz) from public, anon;
grant execute on function compras_por_proveedor(timestamptz) to authenticated;
