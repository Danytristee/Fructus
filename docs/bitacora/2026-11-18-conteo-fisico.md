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
- **En el proyecto (con OK, 2026-11-18):** aplicada como `20261118005001_conteo_fisico`, el archivo ya con esa versión. Ninguna fila
  tocada (siguen los 624 ajustes viejos); las políticas de `movimientos_stock` rechazan `ajuste` y `conteo_id` directos; `anon` no
  ejecuta `registrar_conteo`. `get_advisors`: en seguridad, `registrar_conteo` como security definer (a propósito, en CLAUDE.md); en
  rendimiento, la llave `conteos.registrado_por` sin índice (el mismo patrón que se deja para antes de producción) y dos índices nuevos
  «sin usar» (nacieron hoy).
- **Con OK, después del PR:** los 3 cambios de `/formidable` (8.3 → 8.7, `docs/formidable/conteo-2026-11-18-2.md`): invita a contar en
  vez de decir «Cuadra» antes de tocar el contador, el sello dice qué pasó con la diferencia («Faltaban 2 cajas: quedaron como
  merma…») y «Se vendió sin anotar» dice que solo corrige las cajas. Y el hallazgo de `/chaos`: lo contado va en centésimas y el 22023
  se dice como «Revisa las cajas que contaste». e2e del conteo 20 de 20 a 412 y 360 px.
- **Pendiente:**
  - `/formidable` (respuesta perdida): decir «Parece que ya se guardó: la app ya dice N» en vez de «Cuadra» junto a «no sé si se guardó».
  - `stock-compra.spec.ts:206` sigue en rojo desde el 15-11: su arreglo está en `claude/cola-segunda-parte`, sin fusionar.
  - Probar con audio real («conté…» por Whisper) y en el S25.
