# 2026-11-12 · Apartado de Proveedores (ADR-0017)

- **Qué cambió:**
  - Nueva pantalla **Proveedores** (menú Más y panel lateral). Dice de quién dependes y quién te tiene como cliente fijo, y qué
    pedirle a cada proveedor.
  - Nueva ficha de cada proveedor:
    - su veredicto para negociar, con el porqué;
    - sus precios frente al más barato de otro proveedor;
    - botones de WhatsApp y llamar;
    - su historial de compras y pagos.
  - Nuevas hojas para registrar un pago y para crear o editar un proveedor.
  - En la base: `pagos_proveedor`, `v_saldo_proveedores` y `compras_por_proveedor()`.
  - Nuevo `scripts/demo/proveedores-demo.sql`: 10 proveedores de prueba con 4 meses de compras y pagos.
- **Cómo se verificó:**
  - pgTAP: 16 archivos, con `16_proveedores_completos`.
  - Vitest: 559 pruebas. Tipos, lint y Knip limpios.
  - Invariantes limpias después de cargar la demo y de registrar un pago.
  - En el navegador: capturas a 412, 360 y 1280 px, sin scroll horizontal.
  - Un doble toque en «Confirmar pago» guardó un solo pago (`pagos_proveedor` 25, comando 164) y la deuda con Chao quedó en S/ 0.00.
  - Se creó y se editó un proveedor desde la hoja.
- **Pendiente:**
  - **Aplicar al proyecto** la migración y `proveedores-demo.sql`, con OK. La demo suma unas 3,800 cajas al stock.
  - **`/formidable`** de Proveedores, la ficha y las dos hojas, y **`/chaos`** de la hoja de pago y de la de proveedor. Solo se probó
    el doble toque.
  - **Pago a proveedor por voz:** falta la herramienta en `docs/interprete-voz.md` y su tarjeta.
  - **Merma por proveedor**, para saber cuál trae fruta que se malogra antes. Hoy `movimientos_stock` no guarda de qué compra
    salió la merma.
  - Un proveedor sin compras sale como «Ocasional». Quizá debería decir «Nuevo» (`lib/proveedores-reglas.ts`, `posicionDe`).
  - En la hoja de proveedor, un RUC mal escrito dentro de «Más datos» solo se marca en rojo si el desplegable está abierto
    (`components/proveedores/HojaProveedor.tsx`).
  - La hoja de pago no tiene e2e de Playwright (`tests/e2e/`).
