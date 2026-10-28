-- La unidad de venta se llama «caja», no «jaba» (ADR-0008).
-- El dueño pidió el cambio: en pantalla, en la base y en la voz se dice «caja».
-- Por voz se sigue aceptando «jaba» como sinónimo: eso vive en el intérprete, no aquí.
--
-- Qué cambia:
--   1. productos.unidad nace como 'caja' y las filas que decían 'jaba' pasan a 'caja'.
--      Es una corrección de nombre, no de cantidad: una jaba de ayer es una caja de hoy.
--   2. resumen_dia() devuelve 'cajas_vendidas' en vez de 'jabas_vendidas'.
--      Ninguna pantalla leía todavía esa llave, así que nada se rompe del lado de la app.
-- create or replace conserva los permisos que ya tenía resumen_dia().

alter table productos alter column unidad set default 'caja';

update productos set unidad = 'caja' where unidad = 'jaba';

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
    'cajas_vendidas',   coalesce((select sum(vi.cantidad) from venta_items vi join v on v.id = vi.venta_id), 0),
    'abonos',           coalesce((select sum(monto) from abonos, r where fecha >= r.desde and fecha < r.hasta), 0),
    'compras',          coalesce((select sum(total) from compras, r where fecha >= r.desde and fecha < r.hasta), 0),
    'gastos',           coalesce((select sum(monto) from gastos, r where fecha >= r.desde and fecha < r.hasta), 0),
    'por_cobrar_total', coalesce((select sum(saldo) from v_saldo_clientes where saldo > 0), 0)
  )
$$;
