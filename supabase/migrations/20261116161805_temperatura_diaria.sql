-- =============================================================================
-- La temperatura del puesto, día a día (aviso de frescura, actividad 1).
--
-- El problema: Stock avisa «por malograrse» con una tabla fija de días por fruta (lib/inventario-reglas.ts). La misma caja
-- aguanta menos una semana de 31° que una de 24°, y el sistema no sabe qué temperatura hizo. Es como calcular cuánto dura
-- el hielo sin mirar si hay sol.
--
-- La solución: cada vez que alguien lee el termómetro del puesto queda una lectura, por voz («hoy hizo 29 grados») o a mano.
--   1. No se edita ni se borra desde la app: si se dictó mal, se registra otra y vale la ÚLTIMA del día (v_temperatura_dia).
--      Mal hecho sería un solo renglón por día que se pisa: se pierde quién la cambió y cuándo.
--   2. La fecha sigue la regla de la cola sin conexión (fecha_del_celular, ADR-0019): lo anotado sin señal queda con la
--      hora del toque si es creíble.
--   3. Cada comando de voz deja una sola lectura: un doble toque en Confirmar no la repite.
--   4. Roles como en gastos: dueño y administrador gestionan, el ayudante registra, el contador solo lee.
-- =============================================================================

create table temperaturas (
  id             bigint generated always as identity primary key,
  -- Celsius, a la sombra del puesto. De 0 a 50: «290» o «−3» son un dedo que se fue, no el clima de Trujillo.
  grados         numeric(4,1) not null check (grados between 0 and 50),
  fecha          timestamptz not null default now(),          -- cuándo se leyó el termómetro
  comando_voz_id bigint references comandos_voz (id),
  registrado_por uuid not null default auth.uid() references perfiles (id),
  creado_en      timestamptz not null default now()
);
comment on table temperaturas is 'Lecturas del termómetro del puesto. Solo se agregan: la temperatura de un día es su última lectura (v_temperatura_dia).';

create index temperaturas_fecha on temperaturas (fecha);
create unique index temperaturas_una_por_comando_voz on temperaturas (comando_voz_id) where comando_voz_id is not null;
create trigger temperaturas_fecha_creible before insert on temperaturas for each row execute function fijar_fecha_del_celular();

-- La temperatura de cada día de Lima: la última lectura de ese día (corregir es registrar otra).
create view v_temperatura_dia with (security_invoker = true) as
select distinct on ((fecha at time zone 'America/Lima')::date)
  (fecha at time zone 'America/Lima')::date as dia,
  grados,
  fecha
from temperaturas
order by (fecha at time zone 'America/Lima')::date, fecha desc, id desc;
comment on view v_temperatura_dia is 'La temperatura de cada día de Lima: la última lectura de ese día.';

alter table temperaturas enable row level security;

create policy temperaturas_leer on temperaturas for select to authenticated
  using (rol_actual() is not null);
create policy temperaturas_gestion on temperaturas for all to authenticated
  using (rol_actual() in ('duenio', 'administrador'))
  with check (rol_actual() in ('duenio', 'administrador'));
create policy temperaturas_registrar_ayudante on temperaturas for insert to authenticated
  with check (rol_actual() = 'ayudante');
