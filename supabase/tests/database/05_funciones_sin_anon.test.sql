-- =============================================================================
-- Nadie sin sesión ejecuta funciones del negocio. Supabase da EXECUTE a anon (y Postgres a public) en toda función nueva.
-- Las funciones de extensiones (pg_trgm) no cuentan.
-- Esta prueba es el guardia: una función nueva que quede abierta para anon la hace fallar en el CI, y la migración que la
-- crea tiene que revocarlo (CLAUDE.md, «Trampas de RLS»).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(3);

create temp view funciones_propias as
select p.oid, p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

select is(
  (select array_agg(proname::text order by proname) from funciones_propias where has_function_privilege('anon', oid, 'execute')),
  null,
  'anon no puede ejecutar ninguna función propia del esquema public');

select ok(
  (select bool_and(has_function_privilege('authenticated', oid, 'execute'))
     from funciones_propias where proname in ('registrar_venta', 'registrar_compra', 'anular_venta', 'resumen_dia', 'buscar_clientes', 'buscar_productos', 'ultimo_precio', 'rol_actual')),
  'los usuarios con sesión siguen pudiendo usarlas');

select ok(not has_function_privilege('authenticated', 'public.tomar_numero(text)', 'execute'), 'tomar_numero sigue siendo solo del servidor');

select * from finish();
rollback;
