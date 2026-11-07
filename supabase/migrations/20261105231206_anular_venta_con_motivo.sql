-- Anular una venta pide el motivo y deja quién la anuló y cuándo (A8).
--
-- El problema: anular_venta(id) cambiaba la venta a «anulada» y devolvía el stock, y nada más. Después no había manera de
-- saber por qué se anuló, quién lo hizo ni cuándo: lo único que quedaba era una venta que desapareció del historial y de la
-- deuda del cliente. Para un negocio que vende al crédito, una venta que se anula sin decir por qué es justo lo que el contador
-- y el dueño tienen que poder revisar (principio 4: se corrige registrando, no borrando; y se dice por qué).
--
-- Qué cambia:
--   1. ventas guarda cuándo se anuló, quién y el motivo (anulada_en, anulada_por, motivo_anulacion).
--   2. Una restricción dice qué es un estado posible: una venta registrada no tiene nada de eso; una anulada siempre tiene el
--      cuándo y un motivo de 3 a 200 letras. Una anulada sin motivo es un estado imposible (principio 3): ni el servidor ni una
--      consulta directa lo pueden dejar así.
--   3. anular_venta pide el motivo: anular_venta(id, motivo). La firma de un solo argumento desaparece, para que nadie la use
--      sin motivo por costumbre.
--
-- Lo que NO cambia: quién puede anular (solo dueño y administrador), que no se anula una venta con comprobante enviado o
-- aceptado (corresponde una nota de crédito), que se devuelve al stock lo vendido, y que se hace en una sola transacción.
--
-- Las ventas que ya estaban anuladas (demo, pruebas) no tienen motivo: se les pone uno que lo diga, para que la restricción
-- no las deje en un estado que ella misma prohíbe.

alter table ventas
  add column anulada_en       timestamptz,
  add column anulada_por      uuid references perfiles (id),
  add column motivo_anulacion text;

update ventas
   set anulada_en = coalesce(creado_en, now()),
       motivo_anulacion = 'Anulada antes de pedir el motivo'
 where estado = 'anulada';

alter table ventas add constraint venta_anulada_con_motivo check (
     (estado = 'registrada' and anulada_en is null and anulada_por is null and motivo_anulacion is null)
  or (estado = 'anulada' and anulada_en is not null and length(btrim(motivo_anulacion)) between 3 and 200)
);

-- Anula una venta y devuelve su stock. No se puede si ya tiene comprobante enviado o aceptado: en ese caso corresponde una
-- nota de crédito. El motivo es obligatorio.
create or replace function anular_venta(p_venta_id bigint, p_motivo text)
returns void
language plpgsql security invoker
set search_path = public
as $$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  -- Con RLS, un update sin permiso no falla: simplemente no toca filas.
  -- Por eso se verifica el rol explícitamente.
  if rol_actual() is distinct from 'duenio' and rol_actual() is distinct from 'administrador' then
    raise exception 'Solo el dueño o el administrador pueden anular ventas';
  end if;

  if length(v_motivo) < 3 then
    raise exception 'Anular una venta pide el motivo' using errcode = '23514';
  end if;
  if length(v_motivo) > 200 then
    raise exception 'El motivo no puede pasar de 200 letras' using errcode = '23514';
  end if;

  if exists (
    select 1 from comprobantes
    where venta_id = p_venta_id and estado in ('enviado', 'aceptado')
  ) then
    raise exception 'La venta % ya tiene comprobante en SUNAT: usar nota de crédito', p_venta_id;
  end if;

  update ventas
     set estado = 'anulada', anulada_en = now(), anulada_por = auth.uid(), motivo_anulacion = v_motivo
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

drop function anular_venta(bigint);

-- Ninguna función propia se ejecuta sin sesión (05_funciones_sin_anon.test.sql): Supabase da EXECUTE a anon y Postgres a public
-- en toda función nueva.
revoke execute on function public.anular_venta(bigint, text) from public, anon;
grant execute on function public.anular_venta(bigint, text) to authenticated;
