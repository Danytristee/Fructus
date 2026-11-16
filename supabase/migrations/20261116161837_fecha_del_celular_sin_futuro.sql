-- =============================================================================
-- Nada queda fechado en el futuro (ajuste de ADR-0019; /chaos 2026-11-14).
--
-- El problema: fecha_del_celular() aceptaba la hora del celular hasta 5 minutos adelante, por si el reloj del teléfono iba un
-- poco adelantado. La temperatura de un día es su lectura de fecha más tardía (v_temperatura_dia), así que una lectura que
-- salía de la cola sin conexión con el reloj cuatro minutos adelante le ganaba a la corrección hecha enseguida con señal:
-- la pantalla decía «Hoy hace 33°» y la cuenta de la fruta seguía con 36°. Es como anotar en el cuaderno una hora que
-- todavía no llegó: lo que se anote después, a la hora de verdad, queda «antes».
--
-- La solución: lo que se registra no pudo pasar después de «ahora». Una hora del futuro, aunque sea por un minuto, se cambia
-- por la del servidor, igual que ya se hacía con una de hace más de 48 horas. La operación nunca se pierde.
--   - Vale para todo lo que usa la regla: ventas, compras, abonos, gastos, movimientos de stock y temperaturas.
--   - El orden de lo que sale de la cola no cambia: cada operación queda, como mucho, con la hora en que llegó, y llegan en fila.
--   - Mal hecho sería corregirlo solo en la vista de la temperatura: una venta fechada en el futuro tiene el mismo problema
--     con un abono o una anulación que venga enseguida.
-- =============================================================================

create or replace function fecha_del_celular(p timestamptz)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select case
    when p is not null and p between now() - interval '48 hours' and now() then p
    else now()
  end;
$$;
comment on function fecha_del_celular(timestamptz) is
  'La hora del celular si es creíble (de 48 h atrás hasta ahora, nunca del futuro); si no, la del servidor. ADR-0019.';

-- Ninguna función propia se ejecuta sin sesión (CLAUDE.md, trampas de RLS). Reemplazarla conserva los permisos; se repite por si acaso.
revoke execute on function fecha_del_celular(timestamptz) from public, anon;
