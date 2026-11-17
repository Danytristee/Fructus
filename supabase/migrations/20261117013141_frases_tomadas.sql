-- =============================================================================
-- «Hola Fructus» con dos celulares: la misma frase se toma una sola vez (ADR-0022, /chaos 2026-11-16 hallazgo 1).
--
-- El problema: en el puesto puede haber dos celulares en «Hoy» con «Hola Fructus» prendido (el del dueño y el de un ayudante, o
-- dos con la misma cuenta). Una venta dicha en voz alta despierta a los dos; cada uno abría su tarjeta y, con manos libres, un solo
-- «confirmo» guardaba la venta dos veces. Antes de «Hola Fructus» había que tocar cada celular para abrir una tarjeta.
--
-- La solución: /api/voz, antes de abrir la tarjeta de algo dicho después de la frase, la «toma» con tomar_frase. Si en los últimos
-- 10 s otro celular ya tomó una frase casi igual (similitud de pg_trgm de 0.6 o más), esta no se toma: el servidor responde que la
-- anotó otro celular y no guarda el comando. El mismo celular sí puede repetir (alguien que descartó la tarjeta y la dice otra vez).
-- La revisión y el registro van en una sola transacción, bajo un candado: dos celulares que envían en el mismo instante no pasan los
-- dos.
--
-- frases_tomadas tiene RLS sin políticas: solo la toca tomar_frase (security definer), como series_comprobante. Solo se agregan
-- filas (CLAUDE.md: nunca se borran datos).
-- =============================================================================

create table public.frases_tomadas (
  id bigint generated always as identity primary key,
  -- Lo que se dijo después de «Hola Fructus», tal como lo escribió Whisper: lo mismo que queda en comandos_voz.
  frase text not null check (length(frase) between 1 and 2000),
  -- Un número al azar que cada celular guarda para sí: dice si dos frases vienen del mismo celular o de dos distintos.
  celular text not null check (length(celular) between 8 and 64),
  tomada_por uuid not null default auth.uid() references auth.users (id),
  tomada_en timestamptz not null default now()
);

comment on table public.frases_tomadas is
  'Lo dicho después de «Hola Fructus» que abrió una tarjeta: la misma frase oída por otro celular en 10 s no abre otra (ADR-0022).';

create index frases_tomadas_tomada_en on public.frases_tomadas (tomada_en);

alter table public.frases_tomadas enable row level security;

create function public.tomar_frase(p_frase text, p_celular text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if rol_actual() is null or rol_actual() not in ('duenio', 'administrador', 'ayudante') then
    raise exception 'Tu cuenta no puede registrar operaciones' using errcode = '42501';
  end if;
  if coalesce(length(p_frase), 0) = 0 or coalesce(length(p_celular), 0) < 8 then
    raise exception 'Falta la frase o el celular';
  end if;

  -- Una a la vez: sin esto, dos celulares que envían en el mismo instante revisan antes de que el otro anote, y pasan los dos.
  perform pg_advisory_xact_lock(hashtext('fructus:tomar_frase'));

  if exists (
    select 1
      from frases_tomadas f
     where f.tomada_en > now() - interval '10 seconds'
       and f.celular <> p_celular
       and similarity(lower(f.frase), lower(p_frase)) >= 0.6
  ) then
    return false;
  end if;

  insert into frases_tomadas (frase, celular) values (left(p_frase, 2000), p_celular);
  return true;
end;
$$;

comment on function public.tomar_frase(text, text) is
  'true: esta frase abre su tarjeta. false: otro celular ya tomó una casi igual en los últimos 10 s (ADR-0022).';

revoke execute on function public.tomar_frase(text, text) from public, anon;
grant execute on function public.tomar_frase(text, text) to authenticated;
