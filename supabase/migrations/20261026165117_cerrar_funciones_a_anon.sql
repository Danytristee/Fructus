-- rol_actual(): los usuarios autenticados la necesitan (las políticas RLS la usan),
-- pero alguien sin sesión no tiene por qué llamarla.
revoke execute on function public.rol_actual() from public, anon;

-- rls_auto_enable(): función del disparador de eventos "ensure_rls" que Supabase crea
-- para activar RLS automáticamente en tablas nuevas. El disparador corre con los
-- permisos de su dueño, así que nadie necesita llamarla por la API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
