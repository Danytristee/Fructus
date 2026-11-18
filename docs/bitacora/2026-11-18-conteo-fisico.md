# 2026-11-18 · Conteo físico con ajuste (función 1 del Informe T3, ADR-0028)

- **Qué cambió:** «conté 18 de mango» se anota a mano (Stock: «Contar» en cada fruta y «Contar una fruta sin cajas») o por voz. La
  base calcula la diferencia con el stock de ese instante; si no cuadra, pide la causa: «se malogró» entra como merma y las demás
  como ajuste. El conteo que cuadra también queda. Cuentan dueño, administrador y ayudante. Nadie inserta un `ajuste` directo: solo
  `registrar_conteo`.
- **Cómo se verificó:** pgTAP 399 (33 nuevas) e invariantes 14 (INV-14 detecta dos daños a propósito), en una base propia
  (`fructus-conteo`). Vitest 1176. e2e a 412 y 360 px: `stock-conteo` 12 de 12 y `voz-conteo` 6 de 6, con lo que quedó en la base.
  `/voz-precision` (137 casos, claude-haiku-5-5): intención 99.3 %, datos 97.8 %, prudencia 100 %, p50 993 ms; los 7 casos de conteo
  aciertan. `/formidable` 8.3 (ciego 8/10). `/chaos` semilla 1811: 8 de 9 resistieron.
- **Lo que encontraron las pruebas y se arregló:** una compra entrando mientras se contaba dejaba «falta 1, se malogró» como merma de 6
  (ahora la pantalla manda lo que vio y la base rechaza si cambió); la barra flotante con tres píldoras se partía a 360 px; las causas
  con «anotar» le quitaban a «anótalo» su sentido de crédito.
- **Pendiente:**
  - Aplicar `20261118000000_conteo_fisico` al proyecto **antes de fusionar** (con OK), renombrarla con su versión real y correr `get_advisors`.
  - `/formidable`: 3 cambios esperan OK (no decir «Cuadra» antes de contar, el sello dice qué pasó con la diferencia, «Se vendió sin anotar» no pide nada más).
  - `/chaos`: el 22023 de un número con más de dos decimales se dice como «revisa tu señal» (`app/(app)/acciones-conteo.ts`); por voz ya se redondea.
  - `stock-compra.spec.ts:206` sigue en rojo desde el 15-11: su arreglo está en `claude/cola-segunda-parte`, sin fusionar.
  - Probar con audio real («conté…» por Whisper) y en el S25.
