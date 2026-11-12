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
  - **Ya aplicado al proyecto** (2026-11-12, con OK):
    - La migración, con `supabase db push` y la misma versión que el archivo.
    - `proveedores-demo.sql`: 10 proveedores activos, 182 compras y 18 pagos.
    - Sin tocar el stock, como se decidió: cada compra de prueba sale por un ajuste con el motivo «compra de prueba (demo de
      proveedores)», 566 en total. Ningún producto cambió su stock.
    - Invariantes limpias y `db lint` sin errores.
    - Aviso nuevo del linter: `pagos_proveedor` tiene políticas permisivas múltiples. Es igual que en `abonos` y se deja
      (CLAUDE.md).
    - A Agrícola Chao y Transportes Piura Norte, que ya existían, se les pusieron datos de prueba: RUC 20999…, teléfonos
      900 000 1xx, contacto y notas.
  - **`/formidable`** (`docs/formidable/proveedores-2026-11-12.md`): 8.2 → 8.8, con 3 cambios aplicados con OK. Quedan «Se enfrió» y
    «Ocasional», que en la prueba a ciegas no se entendieron solos.
  - **`/chaos`** (`docs/chaos/proveedores-2026-11-12.md`, semilla 1112): de 9 ataques, 8 resistieron. El hallazgo de gravedad 4 («Revisa lo
    marcado en rojo» con el RUC escondido) ya está arreglado con OK: el aviso nombra el campo y «Más datos» se mantiene abierto
    mientras tenga un error.
  - **Pago a proveedor por voz:** falta la herramienta en `docs/interprete-voz.md` y su tarjeta.
  - **Merma por proveedor**, para saber cuál trae fruta que se malogra antes. Hoy `movimientos_stock` no guarda de qué compra
    salió la merma.
  - Un proveedor sin compras sale como «Ocasional». Quizá debería decir «Nuevo» (`lib/proveedores-reglas.ts`, `posicionDe`).
  - La hoja de pago no tiene e2e de Playwright (`tests/e2e/`).
