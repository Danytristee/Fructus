-- =============================================================================
-- Un dictado lo guarda quien lo dictó, o el dueño o el administrador, en TODA tabla con comando de voz (/chaos 2026-11-16).
--
-- El problema: 20261116182112 puso la regla en registrar_venta y registrar_compra, pero el abono, la merma, el gasto, la
-- temperatura y el pago a proveedor se insertan directo en su tabla, y las ventas y compras también aceptan un insert directo
-- sin pasar por la RPC. Ahí la RLS solo miraba el rol. Un ayudante podía guardar con el comando de otra cuenta:
--   - el comando quedaba «pendiente» (el update que lo marca no toca filas ajenas y no falla: la trampa de CLAUDE.md);
--   - y, peor, si guardaba primero, el índice de un registro por comando hacía que la confirmación del dueño chocara con «ya
--     guardado» y se diera por buena, con el monto que había puesto el ayudante.
-- Desde la app es casi imposible (el comando vive en un solo celular y la cola es por cuenta), pero el estado era posible.
--
-- La solución, en la RLS y no en cada acción: la política de inserción del ayudante pide además que el comando, si lo hay,
-- sea suyo. El dueño y el administrador gestionan todo y siguen pudiendo guardar con cualquier comando. Sin comando (lo
-- registrado a mano) nada cambia. El rechazo es 42501, el mismo que ya traduce cada acción («Tu cuenta no puede…»).
-- =============================================================================

-- ¿El comando lo dictó quien está guardando? Invoker: lee comandos_voz con la RLS de la persona, que deja leer a todo rol.
create function comando_propio(p_comando_voz_id bigint)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from comandos_voz where id = p_comando_voz_id and registrado_por = (select auth.uid()));
$$;
revoke execute on function comando_propio(bigint) from public, anon;
grant execute on function comando_propio(bigint) to authenticated;

drop policy abonos_registrar_ayudante on abonos;
create policy abonos_registrar_ayudante on abonos for insert to authenticated
  with check (rol_actual() = 'ayudante' and (comando_voz_id is null or comando_propio(comando_voz_id)));

drop policy movimientos_stock_registrar_ayudante on movimientos_stock;
create policy movimientos_stock_registrar_ayudante on movimientos_stock for insert to authenticated
  with check (rol_actual() = 'ayudante' and (comando_voz_id is null or comando_propio(comando_voz_id)));

drop policy gastos_registrar_ayudante on gastos;
create policy gastos_registrar_ayudante on gastos for insert to authenticated
  with check (rol_actual() = 'ayudante' and (comando_voz_id is null or comando_propio(comando_voz_id)));

drop policy pagos_proveedor_registrar_ayudante on pagos_proveedor;
create policy pagos_proveedor_registrar_ayudante on pagos_proveedor for insert to authenticated
  with check ((select rol_actual()) = 'ayudante' and (comando_voz_id is null or comando_propio(comando_voz_id)));

drop policy ventas_registrar_ayudante on ventas;
create policy ventas_registrar_ayudante on ventas for insert to authenticated
  with check (rol_actual() = 'ayudante' and (comando_voz_id is null or comando_propio(comando_voz_id)));

drop policy compras_registrar_ayudante on compras;
create policy compras_registrar_ayudante on compras for insert to authenticated
  with check (rol_actual() = 'ayudante' and (comando_voz_id is null or comando_propio(comando_voz_id)));

-- La temperatura tenía una sola política para los tres roles (20261116181418): el dueño y el administrador, como antes; el
-- ayudante, con su comando o sin ninguno.
drop policy temperaturas_registrar on temperaturas;
create policy temperaturas_registrar on temperaturas for insert to authenticated
  with check (
    rol_actual() in ('duenio', 'administrador')
    or (rol_actual() = 'ayudante' and (comando_voz_id is null or comando_propio(comando_voz_id)))
  );
