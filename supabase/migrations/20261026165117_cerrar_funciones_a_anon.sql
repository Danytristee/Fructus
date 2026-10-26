-- rol_actual(): los usuarios autenticados la necesitan (las políticas RLS la usan),
-- pero alguien sin sesión no tiene por qué llamarla.
revoke execute on function public.rol_actual() from public, anon;

-- rls_auto_enable(): función del disparador de eventos "ensure_rls" que Supabase crea
-- en el proyecto alojado para activar RLS automáticamente en tablas nuevas. El
-- disparador corre con los permisos de su dueño, así que nadie necesita llamarla por
-- la API.
-- Va dentro de un "if exists" porque en el Supabase local (CLI) y en el CI esa función
-- no existe, y un revoke sobre una función inexistente rompería la migración. En el
-- proyecto alojado el efecto es idéntico al que se aplicó (2026-10-26).
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;
