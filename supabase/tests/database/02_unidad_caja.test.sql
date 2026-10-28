-- =============================================================================
-- La unidad se llama «caja» (ADR-0008) — pruebas pgTAP (npx supabase test db).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(4);

select col_default_is('public', 'productos', 'unidad', 'caja'::text, 'un producto nuevo nace en cajas');

select is((select count(*) from productos where unidad = 'jaba'), 0::bigint, 'ningún producto quedó en jabas');

insert into productos (nombre, precio_referencia) values ('Granadilla', 20.00);
select is((select unidad from productos where nombre = 'Granadilla'), 'caja', 'si no se dice la unidad, es caja');

select ok(resumen_dia() ? 'cajas_vendidas' and not resumen_dia() ? 'jabas_vendidas', 'el resumen del día cuenta cajas, no jabas');

select * from finish();
rollback;
