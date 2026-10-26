-- =============================================================================
-- Invariantes de Fructus: lo que la base NO impide sola y que nunca debe pasar.
--
-- Uso:   psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/invariantes.sql
-- Sale:  con un aviso «todas en orden», o con ERROR listando cada invariante rota.
-- Corre: en el CI (contra la base local con el seed), en /chaos después de cada
--        ataque que escribe, y cuando algo «no cuadra».
--
-- Solo lee. No escribe nada. Corre como superusuario (no pasa por RLS), porque
-- tiene que ver todas las filas.
-- =============================================================================
do $$
declare
  v_n   bigint;
  v_msg text := '';
begin
  -- INV-01 · El total de cada venta es exactamente la suma de sus ítems.
  select count(*) into v_n
  from ventas v
  where v.total <> (select coalesce(sum(i.subtotal), 0) from venta_items i where i.venta_id = v.id);
  if v_n > 0 then v_msg := v_msg || format(E'\n  INV-01: %s venta(s) cuyo total no es la suma de sus ítems', v_n); end if;

  -- INV-02 · Ninguna venta queda sin ítems.
  select count(*) into v_n
  from ventas v
  where not exists (select 1 from venta_items i where i.venta_id = v.id);
  if v_n > 0 then v_msg := v_msg || format(E'\n  INV-02: %s venta(s) sin ítems', v_n); end if;

  -- INV-03 · Lo vendido de cada producto en cada venta salió del stock, ni más ni menos.
  select count(*) into v_n
  from (
    select i.venta_id, i.producto_id, sum(i.cantidad) as vendido
    from venta_items i
    group by i.venta_id, i.producto_id
  ) x
  where x.vendido <> coalesce((
    select sum(-m.cantidad) from movimientos_stock m
    where m.venta_id = x.venta_id and m.producto_id = x.producto_id and m.tipo = 'salida_venta'
  ), 0);
  if v_n > 0 then v_msg := v_msg || format(E'\n  INV-03: %s ítem(s) de venta cuya salida de stock no coincide', v_n); end if;

  -- INV-04 · Una venta anulada devolvió al stock exactamente lo que vendió;
  --          una venta registrada no tiene devoluciones.
  select count(*) into v_n
  from (
    select i.venta_id, i.producto_id, sum(i.cantidad) as vendido, v.estado
    from venta_items i join ventas v on v.id = i.venta_id
    group by i.venta_id, i.producto_id, v.estado
  ) x
  where coalesce((
    select sum(m.cantidad) from movimientos_stock m
    where m.venta_id = x.venta_id and m.producto_id = x.producto_id and m.tipo = 'devolucion'
  ), 0) <> case when x.estado = 'anulada' then x.vendido else 0 end;
  if v_n > 0 then v_msg := v_msg || format(E'\n  INV-04: %s ítem(s) con devolución que no corresponde al estado de la venta', v_n); end if;

  -- INV-05 · El total de cada compra es la suma de sus ítems.
  select count(*) into v_n
  from compras c
  where c.total <> (select coalesce(sum(i.subtotal), 0) from compra_items i where i.compra_id = c.id);
  if v_n > 0 then v_msg := v_msg || format(E'\n  INV-05: %s compra(s) cuyo total no es la suma de sus ítems', v_n); end if;

  -- INV-06 · Lo comprado entró al stock, ni más ni menos.
  select count(*) into v_n
  from (
    select i.compra_id, i.producto_id, sum(i.cantidad) as comprado
    from compra_items i
    group by i.compra_id, i.producto_id
  ) x
  where x.comprado <> coalesce((
    select sum(m.cantidad) from movimientos_stock m
    where m.compra_id = x.compra_id and m.producto_id = x.producto_id and m.tipo = 'entrada_compra'
  ), 0);
  if v_n > 0 then v_msg := v_msg || format(E'\n  INV-06: %s ítem(s) de compra cuya entrada de stock no coincide', v_n); end if;

  -- INV-07 · Cada movimiento de venta o compra apunta a su documento, y uno de merma o ajuste no apunta a ninguno.
  select count(*) into v_n
  from movimientos_stock m
  where (m.tipo in ('salida_venta', 'devolucion') and m.venta_id is null)
     or (m.tipo = 'entrada_compra' and m.compra_id is null)
     or (m.tipo in ('merma', 'ajuste') and (m.venta_id is not null or m.compra_id is not null));
  if v_n > 0 then v_msg := v_msg || format(E'\n  INV-07: %s movimiento(s) de stock sin el documento que les corresponde', v_n); end if;

  -- INV-08 · Una venta tiene a lo más un comprobante vigente (no anulado ni rechazado).
  select count(*) into v_n
  from (
    select venta_id from comprobantes
    where estado not in ('anulado', 'rechazado')
    group by venta_id having count(*) > 1
  ) x;
  if v_n > 0 then v_msg := v_msg || format(E'\n  INV-08: %s venta(s) con más de un comprobante vigente', v_n); end if;

  -- INV-09 · Una venta anulada no tiene un comprobante enviado o aceptado sin anular (correspondía nota de crédito).
  select count(*) into v_n
  from comprobantes c join ventas v on v.id = c.venta_id
  where v.estado = 'anulada' and c.estado in ('enviado', 'aceptado');
  if v_n > 0 then v_msg := v_msg || format(E'\n  INV-09: %s comprobante(s) vigente(s) de ventas anuladas', v_n); end if;

  -- INV-10 · Ningún comprobante usa un número que su serie todavía no entregó.
  select count(*) into v_n
  from comprobantes c join series_comprobante s on s.serie = c.serie
  where c.numero > s.ultimo_numero or c.numero < 1 or c.tipo <> s.tipo;
  if v_n > 0 then v_msg := v_msg || format(E'\n  INV-10: %s comprobante(s) con número o tipo que no calza con su serie', v_n); end if;

  -- INV-11 · Una factura (01) es de un cliente con RUC.
  select count(*) into v_n
  from comprobantes c
  join ventas v on v.id = c.venta_id
  left join clientes cl on cl.id = v.cliente_id
  where c.tipo = '01' and c.estado <> 'anulado'
    and (cl.id is null or cl.tipo_documento is distinct from 'RUC');
  if v_n > 0 then v_msg := v_msg || format(E'\n  INV-11: %s factura(s) a clientes sin RUC', v_n); end if;

  -- INV-12 · Un comando de voz confirmado está enlazado a lo que registró
  --          (solo para las intenciones que registran algo con comando_voz_id).
  select count(*) into v_n
  from comandos_voz cv
  where cv.resultado = 'confirmado'
    and cv.intencion in ('registrar_venta', 'registrar_abono', 'registrar_compra', 'registrar_merma', 'registrar_gasto')
    and not exists (select 1 from ventas            x where x.comando_voz_id = cv.id)
    and not exists (select 1 from abonos            x where x.comando_voz_id = cv.id)
    and not exists (select 1 from compras           x where x.comando_voz_id = cv.id)
    and not exists (select 1 from movimientos_stock x where x.comando_voz_id = cv.id and x.tipo = 'merma')
    and not exists (select 1 from gastos            x where x.comando_voz_id = cv.id);
  if v_n > 0 then v_msg := v_msg || format(E'\n  INV-12: %s comando(s) de voz confirmado(s) sin operación registrada', v_n); end if;

  if v_msg <> '' then
    raise exception 'Invariantes rotas:%', v_msg;
  end if;

  raise notice 'Invariantes de Fructus: las 12 en orden.';
end $$;
