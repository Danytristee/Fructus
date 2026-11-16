-- =============================================================================
-- Cuánto aguanta cada fruta, estimado por la IA (aviso de frescura, actividad 5; ADR-0021).
--
-- El problema: «por malograrse» parte de una tabla fija de días por fruta (lib/vida-util-reglas.ts). La tabla dice lo mismo
-- para la manzana Fuji y para la Delicia, y nadie la ajusta. Es como pesar todas las cajas con la misma tara.
--
-- La solución: una vez al día, junto al aviso de la noche, el servidor le pide a un modelo (Claude Sonnet) que estime cuánto
-- aguanta cada fruta a temperatura normal, y guarda aquí lo que contesta con su motivo. Stock cuenta con la última de cada
-- fruta (v_vida_util); la fruta que no tiene ninguna sigue con la tabla.
--   1. Solo se agregan filas. Cambiar una estimación es guardar otra, de otro día: queda el rastro de qué se creyó y cuándo.
--      Mal hecho sería un renglón por fruta que se pisa: el aviso de ayer ya no se podría explicar.
--   2. Una por fruta y por día: si el envío de la noche se repite, no duplica.
--   3. Solo las escribe el servidor (service role), como los comprobantes. Nadie con sesión las edita: una estimación
--      cambiada a mano mueve el aviso de todo el puesto sin decir quién fue. Todos los roles las leen.
--   4. Entre 1 y 120 días: el tope de la cuenta (lib/frescura-reglas.ts). El margen fino (la mitad de la tabla, para arriba
--      o para abajo) lo aplica la regla antes de guardar (lib/vida-estimada-reglas.ts).
-- =============================================================================

create table vida_util_estimada (
  id          bigint generated always as identity primary key,
  producto_id bigint not null references productos (id),
  dia         date not null,                                   -- el día de Lima en que se estimó
  -- A temperatura normal (24°) y si la fruta llega pintona. El calor y cómo llegó se cuentan aparte, llegada por llegada.
  dias        numeric(4,1) not null check (dias between 1 and 120),
  motivo      text not null check (char_length(motivo) between 1 and 300),   -- por qué, en lenguaje de puesto
  modelo      text not null check (char_length(modelo) between 1 and 80),    -- quién la estimó: 'claude-sonnet-5-5'
  creado_en   timestamptz not null default now(),
  constraint vida_util_estimada_una_por_dia unique (producto_id, dia)
);
comment on table vida_util_estimada is
  'Cuántos días aguanta cada fruta a temperatura normal, estimado por la IA. Solo se agregan y solo las escribe el servidor; rige la última de cada fruta (v_vida_util).';

-- La estimación que rige para cada fruta: la del día más reciente.
create view v_vida_util with (security_invoker = true) as
select distinct on (producto_id)
  producto_id,
  dias,
  motivo,
  dia,
  modelo
from vida_util_estimada
order by producto_id, dia desc, id desc;
comment on view v_vida_util is 'La estimación de vida útil que rige para cada fruta: la del día más reciente.';

alter table vida_util_estimada enable row level security;

create policy vida_util_estimada_leer on vida_util_estimada for select to authenticated
  using (rol_actual() is not null);

-- Nadie con sesión escribe: sin el permiso de la tabla el intento falla con 42501, en vez de «no tocar filas» en silencio.
revoke insert, update, delete, truncate on vida_util_estimada from authenticated, anon;
