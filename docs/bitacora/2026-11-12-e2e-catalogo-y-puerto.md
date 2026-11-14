# 2026-11-12 · Dos e2e que fallaban en main: el catálogo real y el puerto fijo

- **Qué cambió (solo pruebas; la app no cambia):**
  - `voz-compra.spec.ts:32` usaba los productos 2, 4, 9 y 10 del seed. El catálogo real (ADR-0016) los deja inactivos, `v_stock` no los muestra y `stockDe()` leía null. Ahora cada prueba crea su fruta.
  - `stock-merma.spec.ts:206` tenía dos causas:
    - El segundo celular iba fijo a `127.0.0.1:3000`. Pasaba lo mismo en `stock-compra`, `ventas-anular`, `clientes-alta` e `invitacion`. Ahora todas toman el `baseURL` de la corrida.
    - El `afterAll` de un worker desactivaba las frutas que el otro worker seguía usando. Ahora cada worker desactiva solo las que creó, también en `stock-compra` y `voz-compra`.
- **Cómo se verificó:** `PUERTO=3500` con `voz-compra`, `stock-merma`, `stock-compra`, `clientes-alta`, `invitacion` y `ventas-anular:156`, a 412 y 360 px. Pasaron 78 y fallaron 2. Las invariantes quedaron limpias.
- **Pendiente:**
  - `stock-compra.spec.ts:205` («respuesta perdida al confirmar») falla a los dos anchos. Ya no sale la alerta «La señal no respondió…». Viene de la cola sin conexión, no de este cambio.
  - **Sin probar:** `voz-consulta.spec.ts:120` también lee de `v_stock` la Piña golden (id 6) del seed, y puede caer por la misma causa.
  - **Por revisar:** si `registrar_venta` y `registrar_compra` deberían rechazar productos inactivos. Las pruebas que venden el Mango Kent (id 1), que está inactivo, no leen `v_stock` y no se corrieron aquí.
