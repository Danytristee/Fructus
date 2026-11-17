-- =============================================================================
-- La hora de cierre del puesto la elige el dueño (ADR-0023).
--
-- El problema: el aviso del día salía siempre a las 7 p. m., escrito en vercel.json. Un puesto que cierra a las 3 p. m. lo recibía cuatro
-- horas tarde; uno que cierra a las 9 p. m., con el día a medias.
--
-- La solución: una fila con la hora de cierre del puesto. vercel.json programa un cron por cada hora que se puede elegir (de 8 a. m. a
-- 11 p. m. de Lima; Hobby deja 100 crons, cada uno una vez al día) y el cron solo avisa si es la hora guardada aquí
-- (lib/hora-cierre-reglas.ts). La lee cualquiera con sesión (la fila del aviso dice la hora); la cambian solo el dueño y el
-- administrador, con fijar_hora_cierre, que deja la firma de quien la cambió.
--
-- ajustes_puesto tiene una sola fila (la llave es `true` y no puede ser otra cosa) y nadie la inserta ni la borra desde la app: nace aquí.
-- No hay update directo: con RLS, un update sin permiso no falla, solo no toca filas (CLAUDE.md, «Trampas de RLS»), y el dueño
-- creería haberla cambiado. fijar_hora_cierre revisa el rol y rechaza con 42501.
-- =============================================================================

create table public.ajustes_puesto (
  id boolean primary key default true check (id),
  -- Hora de Lima, en punto. Fuera de 8 a 23 el resumen saldría vacío o sería de otro día.
  hora_cierre smallint not null default 19 check (hora_cierre between 8 and 23),
  actualizado_por uuid references auth.users (id),
  actualizado_en timestamptz not null default now()
);

comment on table public.ajustes_puesto is
  'Los ajustes del puesto, en una sola fila. hora_cierre: a qué hora de Lima sale el aviso del día (ADR-0023).';

insert into public.ajustes_puesto default values;

alter table public.ajustes_puesto enable row level security;

create policy "ajustes_puesto: la lee quien tiene sesión activa"
  on public.ajustes_puesto for select to authenticated
  using ((select rol_actual()) is not null);

revoke all on public.ajustes_puesto from anon, authenticated;
grant select on public.ajustes_puesto to authenticated;

create function public.fijar_hora_cierre(p_hora smallint)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
begin
  if rol_actual() is distinct from 'duenio' and rol_actual() is distinct from 'administrador' then
    raise exception 'Solo el dueño o el administrador pueden cambiar la hora de cierre' using errcode = '42501';
  end if;
  if p_hora is null or p_hora not between 8 and 23 then
    raise exception 'La hora de cierre va de las 8 a. m. a las 11 p. m.' using errcode = '22023';
  end if;

  update ajustes_puesto
     set hora_cierre = p_hora, actualizado_por = auth.uid(), actualizado_en = now()
   where id;
  return p_hora;
end;
$$;

comment on function public.fijar_hora_cierre(smallint) is
  'Cambia la hora de cierre del puesto (8 a 23, hora de Lima). Solo dueño o administrador; deja la firma de quien la cambió (ADR-0023).';

revoke execute on function public.fijar_hora_cierre(smallint) from public, anon;
grant execute on function public.fijar_hora_cierre(smallint) to authenticated;
