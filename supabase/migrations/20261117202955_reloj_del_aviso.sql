-- =============================================================================
-- El aviso del día sale a la hora Y al minuto que elige el dueño (ADR-0024; sigue a ADR-0023).
--
-- El problema: con la hora sola, el aviso lo disparaban los crons de Vercel Hobby, que llegan en cualquier minuto de la hora. Si el dueño
-- elige 4:30 p. m., un cron de Vercel puede llegar a las 4:05 (antes de que cierre) o a las 4:55. No hay forma de pedirle a Hobby un minuto.
--
-- La solución: el reloj lo lleva la base. pg_cron corre cada minuto `llamar_al_aviso_del_dia()`, que no hace nada hasta que en Lima
-- son la hora y el minuto de cierre. Entonces crea una ficha de un solo uso (vence en 5 minutos) y con pg_net llama a
-- /api/cron/resumen-diario llevándola. La ruta «reclama» el día con `reclamar_resumen_del_dia(ficha)`: solo una llamada por día
-- pasa, venga del reloj de la base o de los crons de Vercel, que quedan de respaldo (si la base no llama, el aviso sale igual, hasta
-- una hora tarde). Si la llamada se pierde, la ficha vence y a los 5 minutos se intenta otra vez.
--
-- Sin secretos compartidos: la ficha nace en la base y la ruta la compara contra la base. CRON_SECRET sigue solo en Vercel.
-- aviso_del_dia (la dirección de la app, la ficha y el día reclamado) es solo del servidor: RLS sin políticas, como series_comprobante.
-- Con `url` vacía (local, CI, o hasta que alguien la ponga en el proyecto) el reloj no llama a nadie.
-- =============================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- --- El minuto de cierre ----------------------------------------------------------------------------------------------------------
-- De 5 en 5: nadie cierra a las 4:37, y la rueda gira 12 posiciones en vez de 60.
alter table public.ajustes_puesto
  add column minuto_cierre smallint not null default 0 check (minuto_cierre between 0 and 55 and minuto_cierre % 5 = 0);

comment on column public.ajustes_puesto.minuto_cierre is 'Minuto de la hora de cierre, de 5 en 5 (ADR-0024).';

-- La función acepta el minuto; sin él, es la hora en punto (así la app de antes de este cambio sigue funcionando).
drop function public.fijar_hora_cierre(smallint);

create function public.fijar_hora_cierre(p_hora smallint, p_minuto smallint default 0)
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
    raise exception 'La hora de cierre va de las 8 a. m. a las 11:55 p. m.' using errcode = '22023';
  end if;
  if p_minuto is null or p_minuto not between 0 and 55 or p_minuto % 5 <> 0 then
    raise exception 'Los minutos van de 5 en 5' using errcode = '22023';
  end if;

  update ajustes_puesto
     set hora_cierre = p_hora, minuto_cierre = p_minuto, actualizado_por = auth.uid(), actualizado_en = now()
   where id;
  return p_hora;
end;
$$;

comment on function public.fijar_hora_cierre(smallint, smallint) is
  'Cambia la hora de cierre del puesto (8:00 a 23:55 de Lima, minutos de 5 en 5). Solo dueño o administrador; deja la firma (ADR-0023, ADR-0024).';

revoke execute on function public.fijar_hora_cierre(smallint, smallint) from public, anon;
grant execute on function public.fijar_hora_cierre(smallint, smallint) to authenticated;

-- --- El reloj del aviso: solo del servidor ------------------------------------------------------------------------------------------
create table public.aviso_del_dia (
  id boolean primary key default true check (id),
  -- La dirección de la app publicada (https://…). Vacía: el reloj no llama a nadie.
  url text check (url is null or url ~ '^https://[^/?#]+$' or url ~ '^http://(127\.0\.0\.1|localhost)(:\d+)?$'),
  -- La ficha de la llamada en curso: una sola a la vez, vence a los 5 minutos.
  ficha text check (ficha is null or ficha ~ '^[0-9a-f]{64}$'),
  ficha_vence timestamptz,
  -- El día de Lima que ya se avisó (o que se está avisando): una sola vez por día.
  reclamado_dia date,
  reclamado_en timestamptz
);

comment on table public.aviso_del_dia is
  'El reloj del aviso del día (ADR-0024): a dónde llamar, la ficha de la llamada en curso y el día ya avisado. Solo del servidor.';

insert into public.aviso_del_dia default values;

alter table public.aviso_del_dia enable row level security;
revoke all on public.aviso_del_dia from anon, authenticated;

-- ¿Ya son la hora y el minuto de cierre en Lima? Una sola definición, para el reloj y para la ruta.
create function public.ya_es_hora_de_cierre(p_ahora timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select ((p_ahora at time zone 'America/Lima')::time) >= make_time(a.hora_cierre, a.minuto_cierre, 0)
    from ajustes_puesto a
   where a.id
$$;

-- Lo corre pg_cron cada minuto (sin argumento: ahora; `p_ahora` existe para las pruebas). No hace nada hasta la hora de cierre;
-- entonces llama a la ruta, una vez por ficha.
create function public.llamar_al_aviso_del_dia(p_ahora timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r aviso_del_dia;
  nueva text;
begin
  select * into r from aviso_del_dia where id for update;
  if r.url is null then return; end if;
  if r.reclamado_dia = (p_ahora at time zone 'America/Lima')::date then return; end if;
  if not ya_es_hora_de_cierre(p_ahora) then return; end if;
  if r.ficha_vence > p_ahora then return; end if; -- hay una llamada en curso

  nueva := encode(gen_random_bytes(32), 'hex');
  update aviso_del_dia set ficha = nueva, ficha_vence = p_ahora + interval '5 minutes' where id;
  -- El aviso más la estimación de la vida útil pueden tardar hasta un minuto (maxDuration de la ruta).
  perform net.http_get(
    url := r.url || '/api/cron/resumen-diario',
    headers := jsonb_build_object('x-ficha-aviso', nueva),
    timeout_milliseconds := 60000
  );
end;
$$;

-- La ruta reclama el día antes de avisar: solo una llamada por día pasa. Con ficha (el reloj de la base), la ficha tiene que ser la
-- vigente. Sin ficha (los crons de Vercel, que ya probaron CRON_SECRET), basta con que sea la hora.
-- Devuelve: 'reclamado', 'temprano' (todavía no es la hora), 'ya-avisado' o 'ficha-invalida'.
create function public.reclamar_resumen_del_dia(p_ficha text default null, p_ahora timestamptz default now())
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r aviso_del_dia;
  hoy date := (p_ahora at time zone 'America/Lima')::date;
begin
  select * into r from aviso_del_dia where id for update;
  if p_ficha is not null and (r.ficha is distinct from p_ficha or r.ficha_vence <= p_ahora) then
    return 'ficha-invalida';
  end if;
  if r.reclamado_dia = hoy then return 'ya-avisado'; end if;
  if not ya_es_hora_de_cierre(p_ahora) then return 'temprano'; end if;
  update aviso_del_dia set reclamado_dia = hoy, reclamado_en = p_ahora, ficha = null, ficha_vence = null where id;
  return 'reclamado';
end;
$$;

-- Si el aviso no pudo armarse (la base no respondió a la ruta), se suelta el día: el reloj vuelve a intentar.
create function public.soltar_resumen_del_dia()
returns void
language sql
security definer
set search_path = public
as $$
  update aviso_del_dia set reclamado_dia = null, reclamado_en = null
   where id and reclamado_dia = (now() at time zone 'America/Lima')::date
$$;

-- Ninguna de estas funciones se llama desde el navegador: solo el servidor (service_role) y pg_cron (postgres).
revoke execute on function public.ya_es_hora_de_cierre(timestamptz) from public, anon, authenticated;
revoke execute on function public.llamar_al_aviso_del_dia(timestamptz) from public, anon, authenticated;
revoke execute on function public.reclamar_resumen_del_dia(text, timestamptz) from public, anon, authenticated;
revoke execute on function public.soltar_resumen_del_dia() from public, anon, authenticated;
grant execute on function public.ya_es_hora_de_cierre(timestamptz) to service_role;
grant execute on function public.reclamar_resumen_del_dia(text, timestamptz) to service_role;
grant execute on function public.soltar_resumen_del_dia() to service_role;

-- Cada minuto. Con el mismo nombre, volver a correr esto reemplaza el trabajo en vez de duplicarlo.
select cron.schedule('aviso-del-dia', '* * * * *', 'select public.llamar_al_aviso_del_dia()');
