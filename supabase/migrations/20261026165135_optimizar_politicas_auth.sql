-- auth.uid() dentro de (select ...) se evalúa una vez por consulta, no una vez por fila.
drop policy perfiles_leer_propio on perfiles;
create policy perfiles_leer_propio on perfiles for select to authenticated
  using (id = (select auth.uid()));

drop policy comandos_voz_actualizar_propio on comandos_voz;
create policy comandos_voz_actualizar_propio on comandos_voz for update to authenticated
  using (registrado_por = (select auth.uid()))
  with check (registrado_por = (select auth.uid()));
