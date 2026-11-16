-- =============================================================================
-- Las lecturas de temperatura solo se agregan (/chaos 2026-11-14; OK del 16-11).
--
-- El problema: la tabla nació diciendo «solo se agregan: corregir es registrar otra», pero su política de gestión era
-- `for all`, así que el dueño y el administrador podían editar y borrar lecturas por la API. La app no lo ofrece, pero la
-- cuenta de cuánto aguanta cada fruta se arma con esas lecturas: una editada cambia el aviso de días pasados sin dejar
-- rastro de quién ni cuándo. Es como el cuaderno: un número mal anotado se tacha y se escribe al lado, no se borra la hoja.
--
-- La solución:
--   1. Una sola política de insertar para los tres que registran (dueño, administrador y ayudante). El contador solo lee.
--   2. Nadie edita ni borra por la API: se quita el permiso de la tabla. Así el intento falla con 42501, en vez de «no
--      tocar filas» en silencio, que es la trampa de RLS que ya costó caro.
--   3. De paso desaparecen los dos avisos de «políticas múltiples» que el linter marcaba en esta tabla.
-- El servidor (service role) no cambia: es quien corre las pruebas y los scripts de demo.
-- =============================================================================

drop policy temperaturas_gestion on temperaturas;
drop policy temperaturas_registrar_ayudante on temperaturas;

create policy temperaturas_registrar on temperaturas for insert to authenticated
  with check (rol_actual() in ('duenio', 'administrador', 'ayudante'));

revoke update, delete, truncate on temperaturas from authenticated, anon;

comment on table temperaturas is
  'Lecturas del termómetro del puesto. Solo se agregan: nadie las edita ni las borra por la API. La temperatura de un día es su última lectura (v_temperatura_dia).';
