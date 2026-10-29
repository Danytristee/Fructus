-- Ninguna función propia del esquema public se ejecuta sin sesión.
--
-- Supabase da EXECUTE a anon, y Postgres a public, en toda función nueva. Hasta aquí solo rol_actual() lo tenía revocado
-- (20261026165117). Esta migración lo revoca en las demás; authenticated conserva su permiso explícito.
--
-- No se tocan los permisos por defecto: el de public solo se puede quitar de forma global y cerraría también las funciones
-- de una extensión nueva. El guardia es supabase/tests/database/05_funciones_sin_anon.test.sql: falla en el CI si una
-- función propia de public queda ejecutable por anon (CLAUDE.md, «Trampas de RLS»).

revoke execute on function public.registrar_venta(jsonb)          from public, anon;
revoke execute on function public.registrar_compra(jsonb)         from public, anon;
revoke execute on function public.anular_venta(bigint)            from public, anon;
revoke execute on function public.resumen_dia(date)               from public, anon;
revoke execute on function public.buscar_clientes(text, integer)  from public, anon;
revoke execute on function public.buscar_productos(text, integer) from public, anon;
revoke execute on function public.ultimo_precio(bigint, bigint)   from public, anon;

-- Por si en algún ambiente authenticated solo las tenía a través de public.
grant execute on function public.registrar_venta(jsonb), public.registrar_compra(jsonb), public.anular_venta(bigint),
  public.resumen_dia(date), public.buscar_clientes(text, integer), public.buscar_productos(text, integer),
  public.ultimo_precio(bigint, bigint) to authenticated;
