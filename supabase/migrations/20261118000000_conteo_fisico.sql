-- =============================================================================
-- Conteo físico con ajuste (función 1 del Informe T3; ADR-0027).
--
-- El problema: el stock de la app es la suma de los movimientos, y en el puesto se cuela lo que nadie anota (una compra que llegó de
-- noche, dos cajas que se pudrieron al fondo, una venta al paso). La app dice 20 cajas de mango y en el puesto hay 18. Hasta hoy no
-- había cómo decirlo: el tipo 'ajuste' existía, pero sin un camino propio que guarde lo contado y la causa. Es como corregir el
-- cuaderno con corrector: el número cambia y nadie sabe qué pasó.
--
-- La solución: se registra lo que se CONTÓ, no la diferencia.
--   1. Un renglón por conteo en `conteos`: cuántas cajas se contaron, cuántas decía la app en ese momento, la diferencia y su causa.
--      Se guarda también el conteo que cuadra: el panel de indicadores mide cuántos conteos cuadran (función 3 del informe).
--   2. La diferencia la calcula la base al guardar, contra el stock de ese instante, no la pantalla: si entró una venta mientras se
--      contaba, el stock igual queda en lo contado.
--   3. Si no cuadra, la diferencia entra como movimiento atado al conteo (`movimientos_stock.conteo_id`):
--        - «se malogró» → merma (principio 5: la fruta podrida cuenta en la merma, decisión del 2026-11-17);
--        - las demás causas → ajuste, con la causa escrita.
--   4. Solo `registrar_conteo` hace ajustes. Ningún rol con sesión inserta un 'ajuste' directo, ni el dueño; y nadie ata a mano un
--      movimiento a un conteo. Los 624 ajustes viejos del proyecto (de los scripts de demo) no se tocan: el candado está en la RLS y
--      no en un check, para no romperlos (los scripts corren como superusuario).
--   5. Cuentan el dueño, el administrador y también el ayudante (decisión del 2026-11-17: el ayudante cuenta al abrir el puesto). El
--      contador solo lee. Queda la firma de quien contó.
--   6. registrar_conteo es security definer porque el ayudante no puede insertar ajustes directo; revisa el rol antes de tocar nada,
--      como fijar_hora_cierre (aviso del linter que se deja a propósito, anotado en CLAUDE.md).
--   7. Idempotente por dictado: el mismo comando de voz guarda un solo conteo (el doble toque, o la cola sin conexión que reenvía).
-- =============================================================================

create type causa_conteo as enum ('se_malogro', 'venta_sin_anotar', 'compra_sin_anotar', 'no_se');

create table conteos (
  id             bigint generated always as identity primary key,
  producto_id    bigint not null references productos (id),
  contado        numeric(10,2) not null check (contado >= 0),
  segun_app      numeric(10,2) not null,                              -- puede ser negativo: lo que decía la suma de movimientos
  diferencia     numeric(10,2) generated always as (contado - segun_app) stored,
  causa          causa_conteo,
  fecha          timestamptz not null default now(),
  comando_voz_id bigint references comandos_voz (id),
  registrado_por uuid not null default auth.uid() references perfiles (id),
  -- Si no cuadra, se dice por qué; si cuadra, no hay causa que dar.
  constraint conteos_causa_si_no_cuadra check ((contado = segun_app) = (causa is null)),
  -- La causa tiene que poder explicar la diferencia: lo malogrado y lo vendido sin anotar faltan; lo comprado sin anotar sobra.
  constraint conteos_causa_coherente check (
       causa is null or causa = 'no_se'
    or (causa in ('se_malogro', 'venta_sin_anotar') and contado < segun_app)
    or (causa = 'compra_sin_anotar' and contado > segun_app)
  )
);
comment on table conteos is
  'Conteo físico de una fruta: lo contado, lo que decía la app y la causa de la diferencia. Solo se agregan, por registrar_conteo (ADR-0027).';

create unique index conteos_uno_por_comando on conteos (comando_voz_id) where comando_voz_id is not null;
create index conteos_producto on conteos (producto_id);

create trigger conteos_firma before insert or update of registrado_por on conteos
  for each row execute function fijar_registrado_por();
create trigger conteos_fecha_creible before insert on conteos for each row execute function fijar_fecha_del_celular();

alter table movimientos_stock add column conteo_id bigint references conteos (id);
comment on column movimientos_stock.conteo_id is 'El conteo que originó este ajuste o esta merma. Solo lo pone registrar_conteo.';
create index movimientos_stock_conteo on movimientos_stock (conteo_id) where conteo_id is not null;
-- Un conteo deja a lo más un movimiento, y solo de estos dos tipos.
create unique index movimientos_uno_por_conteo on movimientos_stock (conteo_id) where conteo_id is not null;
alter table movimientos_stock add constraint movimientos_conteo_solo_ajuste_o_merma
  check (conteo_id is null or tipo in ('ajuste', 'merma'));

-- --- RLS ------------------------------------------------------------------------------------------------------------------------
alter table conteos enable row level security;
create policy conteos_leer on conteos for select to authenticated using ((select rol_actual()) is not null);
-- Sin políticas de escritura: solo registrar_conteo los inserta. Sin el permiso de la tabla, un intento directo falla con 42501.
revoke insert, update, delete, truncate on conteos from authenticated, anon;

-- Nadie con sesión inserta un ajuste ni ata un movimiento a un conteo: eso lo hace solo registrar_conteo.
alter policy movimientos_stock_gestion on movimientos_stock
  with check (rol_actual() in ('duenio', 'administrador') and tipo <> 'ajuste' and conteo_id is null);
alter policy movimientos_stock_registrar_ayudante on movimientos_stock
  with check (
    rol_actual() = 'ayudante' and tipo <> 'ajuste' and conteo_id is null
    and (comando_voz_id is null or comando_propio(comando_voz_id))
  );

-- --- registrar_conteo -----------------------------------------------------------------------------------------------------------
create function registrar_conteo(
  p_producto_id bigint,
  p_contado numeric,
  p_causa causa_conteo default null,
  p_comando_voz_id bigint default null,
  p_fecha timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol       rol_usuario := rol_actual();
  v_previo    conteos%rowtype;
  v_segun_app numeric(10,2);
  v_conteo    conteos%rowtype;
  v_tipo      tipo_movimiento;
begin
  if v_rol is null or v_rol not in ('duenio', 'administrador', 'ayudante') then
    raise exception 'Tu cuenta no puede registrar conteos' using errcode = '42501';
  end if;
  if p_comando_voz_id is not null and not comando_propio(p_comando_voz_id) then
    raise exception 'Ese dictado no es tuyo' using errcode = '42501';
  end if;
  if p_contado is null or p_contado < 0 or p_contado <> round(p_contado, 2) then
    raise exception 'Las cajas contadas van de 0 para arriba' using errcode = '22023';
  end if;

  -- El mismo dictado otra vez (doble toque, cola sin conexión): se devuelve el conteo que ya se guardó.
  if p_comando_voz_id is not null then
    select * into v_previo from conteos where comando_voz_id = p_comando_voz_id;
    if found then
      return jsonb_build_object('conteo_id', v_previo.id, 'segun_app', v_previo.segun_app, 'diferencia', v_previo.diferencia,
                                'stock', (select coalesce(sum(cantidad), 0) from movimientos_stock where producto_id = v_previo.producto_id),
                                'repetido', true);
    end if;
  end if;

  -- Dos conteos de la misma fruta a la vez se hacen en fila: cada uno calcula su diferencia con el stock que dejó el anterior.
  perform 1 from productos where id = p_producto_id and activo for update;
  if not found then
    raise exception 'Esa fruta ya no está en el catálogo' using errcode = '23503';
  end if;

  select coalesce(sum(cantidad), 0) into v_segun_app from movimientos_stock where producto_id = p_producto_id;

  -- La pantalla calculó la diferencia al abrir; si entró una venta o una compra mientras se contaba, la de ahora puede ser otra. Se
  -- rechaza con un código propio (P0C01) para que la pantalla vuelva a leer el stock y pregunte de nuevo, sin guardar un conteo con una
  -- causa que ya no explica la diferencia.
  if p_contado <> v_segun_app and (p_causa is null
      or (p_causa in ('se_malogro', 'venta_sin_anotar') and p_contado > v_segun_app)
      or (p_causa = 'compra_sin_anotar' and p_contado < v_segun_app)) then
    raise exception 'La app ahora dice % cajas: vuelve a mirar la diferencia', v_segun_app using errcode = 'P0C01';
  end if;

  -- Si cuadra, la causa sobra: se ignora (la pantalla pudo mandar la de antes, si alguien vendió mientras se contaba).
  insert into conteos (producto_id, contado, segun_app, causa, fecha, comando_voz_id)
  values (p_producto_id, p_contado, v_segun_app, case when p_contado = v_segun_app then null else p_causa end, p_fecha, p_comando_voz_id)
  returning * into v_conteo;

  if v_conteo.diferencia <> 0 then
    v_tipo := case when v_conteo.causa = 'se_malogro' then 'merma' else 'ajuste' end;
    insert into movimientos_stock (producto_id, tipo, cantidad, motivo, fecha, conteo_id)
    values (p_producto_id, v_tipo, v_conteo.diferencia,
            'conteo: ' || case v_conteo.causa
              when 'se_malogro' then 'se malogró'
              when 'venta_sin_anotar' then 'venta sin anotar'
              when 'compra_sin_anotar' then 'compra sin anotar'
              else 'no se sabe' end,
            v_conteo.fecha, v_conteo.id);
  end if;

  return jsonb_build_object('conteo_id', v_conteo.id, 'segun_app', v_conteo.segun_app, 'diferencia', v_conteo.diferencia,
                            'stock', v_conteo.contado, 'repetido', false);
end;
$$;

comment on function registrar_conteo(bigint, numeric, causa_conteo, bigint, timestamptz) is
  'Registra un conteo físico: calcula la diferencia con el stock de ese instante y, si no cuadra, la deja como merma (se malogró) o ajuste. Dueño, administrador y ayudante (ADR-0027).';

revoke execute on function registrar_conteo(bigint, numeric, causa_conteo, bigint, timestamptz) from public, anon;
grant execute on function registrar_conteo(bigint, numeric, causa_conteo, bigint, timestamptz) to authenticated;
