-- =============================================================================
-- «Sigue buena»: la llegada que ya pasó su último día bueno y alguien revisó (aviso de frescura, actividad 5; ADR-0021).
--
-- El problema: cuando una llegada pasa su último día bueno, Stock dice «Revísala antes de vender». Si la persona la mira y
-- está buena, no tiene cómo decirlo: el aviso sigue igual todo el día, y la cuenta nunca se entera de que esa fruta aguantó
-- más de lo que se creía. Es como el cuaderno sin la columna de «visto»: cada vez que pasas por la caja, la vuelves a abrir.
--
-- La solución: un renglón por cada revisión. Con la de hoy, esa llegada sale de «para hoy» y queda como «sale mañana»
-- (lib/frescura-reglas.ts); y la estimación de cada noche la toma como evidencia de que esa fruta dura más.
--   1. Solo se agregan filas: nadie las edita ni las borra por la API. Si la fruta se malogra después, se anota la merma.
--   2. Qué llegada se revisó: el día de Lima en que llegó y cómo llegó (igual que la separa Stock). Sin día, son las cajas
--      de hace más de 45 días, de las que no se sabe cuándo llegaron.
--   3. Una por llegada y por día: el doble toque, o dos personas a la vez, dejan un solo renglón.
--   4. La revisión es de HOY: la política no deja anotar una con otro día. Una fechada mañana callaría el aviso de mañana
--      sin que nadie haya mirado la fruta.
--   5. Roles como en las mermas: dueño, administrador y ayudante registran; el contador solo lee.
-- =============================================================================

create table revisiones_frescura (
  id             bigint generated always as identity primary key,
  producto_id    bigint not null references productos (id),
  llegada_dia    date,                                       -- cuándo llegó esa llegada; null = cajas de hace más de 45 días
  llegada_estado estado_llegada,                             -- cómo llegó, si se dijo
  dia            date not null default ((now() at time zone 'America/Lima')::date),   -- el día de Lima en que se revisó
  registrado_por uuid not null default auth.uid() references perfiles (id),
  creado_en      timestamptz not null default now(),
  constraint revisiones_frescura_llegada_antes check (llegada_dia is null or llegada_dia <= dia),
  constraint revisiones_frescura_una_por_dia unique nulls not distinct (producto_id, llegada_dia, llegada_estado, dia)
);
comment on table revisiones_frescura is
  '«Sigue buena»: alguien revisó una llegada que ya había pasado su último día bueno y sigue vendible. Solo se agregan; una por llegada y por día.';

create index revisiones_frescura_dia on revisiones_frescura (dia);

alter table revisiones_frescura enable row level security;

create policy revisiones_frescura_leer on revisiones_frescura for select to authenticated
  using (rol_actual() is not null);
create policy revisiones_frescura_registrar on revisiones_frescura for insert to authenticated
  with check (
    rol_actual() in ('duenio', 'administrador', 'ayudante')
    and dia = (now() at time zone 'America/Lima')::date
    and registrado_por = (select auth.uid())
  );

-- Nadie edita ni borra por la API: sin el permiso de la tabla el intento falla con 42501, en vez de «no tocar filas» en silencio.
revoke update, delete, truncate on revisiones_frescura from authenticated, anon;
