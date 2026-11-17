-- =============================================================================
-- La firma de cada registro (registrado_por) es la de quien está conectado, y no cambia después.
--
-- El problema: registrado_por nace con default auth.uid(), pero un default solo aplica si el pedido no trae la columna. Un
-- ayudante podía guardar un abono, un gasto o una merma «registrado por» el dueño, y el dueño podía reescribir la firma de lo
-- que registró otro. No mueve dinero ni stock, pero borra el rastro de quién hizo cada cosa, que es lo que se mira cuando
-- algo no cuadra. La app nunca manda la columna: el estado solo era posible con un pedido armado a mano.
--
-- La solución, en la base y no en cada acción: un trigger en las nueve tablas que firman, que rechaza con 42501 (el mismo
-- código que ya traduce cada acción: «Tu cuenta no puede…»). Es lo que revisiones_frescura ya hacía con su política.
--   - Con sesión, nadie inserta con una firma que no sea la suya. Sin decir la firma, el default pone la de quien está
--     conectado, así que la app nunca choca con esto.
--   - Con sesión, nadie cambia una firma, ni el dueño: quién registró algo es un hecho, no un dato que se edita.
--   - Sin sesión (la semilla, las pruebas con la clave del servidor, el servidor) se respeta lo que venga: ahí no hay a quién
--     creerle más que al que escribe.
-- Una tabla nueva con registrado_por lleva el mismo trigger (supabase/tests/database/27 falla si falta).
-- =============================================================================

create function fijar_registrado_por()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if tg_op = 'INSERT' and new.registrado_por is distinct from (select auth.uid()) then
    raise exception 'Solo puedes registrar a tu nombre' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.registrado_por is distinct from old.registrado_por then
    raise exception 'Quién registró algo no se cambia' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function fijar_registrado_por() from public, anon;

create trigger abonos_firma before insert or update of registrado_por on abonos
  for each row execute function fijar_registrado_por();
create trigger comandos_voz_firma before insert or update of registrado_por on comandos_voz
  for each row execute function fijar_registrado_por();
create trigger compras_firma before insert or update of registrado_por on compras
  for each row execute function fijar_registrado_por();
create trigger gastos_firma before insert or update of registrado_por on gastos
  for each row execute function fijar_registrado_por();
create trigger movimientos_stock_firma before insert or update of registrado_por on movimientos_stock
  for each row execute function fijar_registrado_por();
create trigger pagos_proveedor_firma before insert or update of registrado_por on pagos_proveedor
  for each row execute function fijar_registrado_por();
create trigger revisiones_frescura_firma before insert or update of registrado_por on revisiones_frescura
  for each row execute function fijar_registrado_por();
create trigger temperaturas_firma before insert or update of registrado_por on temperaturas
  for each row execute function fijar_registrado_por();
create trigger ventas_firma before insert or update of registrado_por on ventas
  for each row execute function fijar_registrado_por();
