# 2026-11-10 · Catálogo real del puesto: marca, selección y calibre (ADR-0016)

- **Qué cambió:**
  - Cargué el inventario del dueño: 54 productos y 4 que ya se vendían. Cada producto suma marca, selección, calibre, kg por caja y
    precio de compra.
  - Stock agrupa por fruta. Ventas, Hoy, Ajustes, los comprobantes y el Excel del mes nombran con una sola regla.
  - La voz distingue selección y calibre, y pregunta cuando dos productos empatan.
  - La demo de dos semanas usa el catálogo real.
- **Cómo se verificó:**
  - pgTAP: 15 archivos, con `14_catalogo_con_detalle` y `15_buscar_productos_con_detalle`.
  - Vitest: 512 pruebas.
  - Invariantes limpias después de `catalogo-real`, `historia-demo` y `dia-demo` sobre una base nueva.
  - E2e de voz, stock, ventas y comprobantes: todas pasan, salvo `voz-api` contra Groq.
  - Capturas de Stock, Ajustes y Ventas a 412 y 360 px, sin scroll horizontal.
- **Pendiente:**
  - **Sin probar:** `/voz-precision` y `voz-api.spec.ts:15`. Esta máquina no tiene `GROQ_API_KEY` en `.env.local`.
  - **Aplicar al proyecto:** las 2 migraciones ya están aplicadas (2026-11-10, `supabase db push`, misma versión que el archivo; tipos sin cambios y sin avisos nuevos del linter). `catalogo-real.sql` también (con OK, solo el catálogo, sin la demo): 58 activos y 38 inactivos, invariantes limpias. Quedaron inactivos 31 productos del catálogo proyectado, y con ellos sus cajas dejaron de verse en Stock (no se borró nada; las ventas viejas los conservan). Los nuevos arrancan en 0 cajas hasta que se registren compras.
  - **`/formidable` de Stock y Ajustes, y `/chaos` de Stock**, que no se corrieron en esta obra. En las alertas, el calibre alarga el título
    («Te sobra Naranja Wando cal. 72»).
  - Sugerir `costo_referencia` en la hoja de Compra cuando la fruta nunca se compró (`lib/voz/resolver.ts`, `costosSugeridos`).
  - **Ya estaba antes:** el recuadro de Stock dice «1 por malograrse» y el filtro dice «2», porque el recuadro solo cuenta lo urgente
    (`lib/inventario-reglas.ts`, `resumirInventario`).
  - **El registro de ventas diario del Excel** (columnas N a R, unas 300 ventas de septiembre y octubre) podría cargarse como historia
    real.
  - Las e2e «a la vez» fijan el puerto 3000 (`tests/e2e/stock-merma.spec.ts:208`). Con `PUERTO=3100` fallan sin que la app falle.
