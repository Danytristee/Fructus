-- =============================================================================
-- buscar_productos entiende la selección y devuelve las partes del producto (ADR-0016).
--
-- Por qué: con el catálogo real, «membrillo 4ta» empataba con «membrillo 3era» y «5ta» (0.71 los tres), porque la búsqueda
-- solo miraba fruta y variedad. Ahora compara contra:
--   - fruta + variedad + selección («manzana verde premium», «membrillo 4ta»);
--   - el nombre completo, con marca y calibre («manzana roja americana nordic premium 113»), para quien dice la marca;
--   - los alias («membrillo de cuarta», «pink de light»).
-- Devuelve marca, selección y calibre para que la tarjeta nombre el producto sin confundirlo (lib/productos-reglas.ts).
-- Cambia lo que devuelve: hay que borrarla y crearla, y volver a cerrar el acceso sin sesión (05_funciones_sin_anon).
-- =============================================================================

drop function if exists buscar_productos(text, integer);

create function buscar_productos(q text, limite integer default 5)
returns table (id bigint, nombre text, variedad text, marca text, seleccion text, calibre text, similitud real)
language sql stable security invoker
set search_path = public, extensions
as $$
  select p.id, p.nombre, p.variedad, p.marca, p.seleccion, p.calibre, s.similitud
  from productos p
  cross join lateral (
    select greatest(
      similarity(lower(concat_ws(' ', p.nombre, p.variedad, p.seleccion)), lower(q)),
      similarity(lower(concat_ws(' ', p.nombre, p.variedad, p.marca, p.seleccion, p.calibre)), lower(q)),
      coalesce((select max(similarity(lower(a), lower(q))) from unnest(p.alias) a), 0)
    ) as similitud
  ) s
  where p.activo
  order by s.similitud desc, p.id
  limit limite
$$;

revoke execute on function public.buscar_productos(text, integer) from public, anon;
grant execute on function public.buscar_productos(text, integer) to authenticated;
