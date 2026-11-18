# 2026-11-18 · La ficha de venta se lee entera, y deslizarla no calla la voz

- **Qué cambió (3 cambios con OK, /formidable):**
  - Deslizar una tarjeta de voz para leerla ya no calla la lectura ni la escucha de manos libres; tocarla, sí. Antes se callaba al
    bajar el dedo, y el arranque de un deslizamiento es igual a un toque. Ahora calla el clic de un toque, o el dedo quieto 450 ms, como
    al mantener «+» (`lib/voz/toque-reglas.ts`, `useToqueTarjeta`). Vale para venta, abono, compra, merma, gasto y conteo. CLAUDE.md
    («Candados») lo dice.
  - La deuda va en dos renglones: «Con esta venta te debe S/ 2,840.00», la barra y «Debía S/ 2,390.00 · + S/ 450.00 hoy». Sin el
    nombre, que está en la fila del cliente: de 157 a unos 93 px a 360 px. Al contado: «De antes te debe S/ 2,390.00», en un renglón.
  - Las filas del cliente y de cada fruta, más bajas (8 px de relleno, 64 px de alto mínimo, íconos de 40 px). El texto no se achicó.
- **Cómo se verificó:** medido a 412 y 360 px con 5 ventas.
  - Una fruta al crédito: a 360 px había que deslizar 67 px; ahora, 0.
  - Dos frutas al contado: a 360 px, 44 px; ahora, 0.
  - Tres frutas con duda, boleta y poco stock: de 379 a 285 px (412) y de 561 a 441 px (360).
  - 0 controles bajo 48 px y 0 desborde. Vitest 1192 en verde; tipos, ESLint y Knip limpios.
  - `voz-ficha-compacta.spec.ts` (nueva, toques reales por CDP): 6 de 6.
  - Las e2e de las tarjetas de voz, la hoja y el teclado: 169 de 174 con 2 a la vez. Las 5 en rojo (`voz-pago-parcial` y un tirón de
    `hoja-gestos`) pasan de a una: el saldo de Luis Paredes lo cambian otras pruebas en paralelo.
  - Prueba a ciegas: 9 y 8 de 10 en la venta común; 4 con tres frutas, que se desliza.
  - Informe: `docs/formidable/ficha-compacta-2026-11-18.md`. Dice «Debía» y no «Ya debía» como se propuso: con «Ya debía» el renglón
    se partía con ventas de cuatro cifras.
- **Pendiente:** una venta de tres frutas igual se desliza (ahora sin cortar la voz). Con deudas de cinco cifras, a 360 px la cifra
  baja a un segundo renglón. Sin probar en el S25 con audífono.

## Después: lo que dejó la prueba a ciegas (3 cambios con OK)

- **Qué cambió:**
  - La deuda ya no dice «hoy» («+ S/ 450.00»): se leía como todo lo fiado hoy.
  - Al contado dice «Te sigue debiendo S/ 2,390.00».
  - La fruta que no alcanza lo dice en su fila, «⚠ Solo hay 34», con una variante nueva de `Insignia`, y se fue el recuadro del
    aviso. La voz lo sigue diciendo entero.
- **Cómo se verificó:**
  - Cada frase se midió con Manrope a 360 px antes de proponerla.
  - Tres frutas: a 412 px, de 285 a 148 px por deslizar; a 360 px, de 441 a 331 px.
  - `voz-ficha-compacta` y `voz-aviso-stock`: 18 de 18. Vitest 1191 de 1191.
  - E2e de voz afectadas, de a una: 86 de 86. Una prueba esperaba que la fila de la fruta terminara en el precio; ahora acepta la marca
    de stock. Otras dos se repitieron por carga.
- **Pendiente:** «Solo hay 34» ya no dice «según la app», aunque la voz sí. Sin probar en el S25.


## Después: /chaos de la ficha (semilla 20261118)

- **Qué se hizo:** 21 ataques sobre la ficha de venta, con la voz real (Whisper y el intérprete) y dos cuentas a la vez en la base.
  Informe: `docs/chaos/ficha-compacta-2026-11-18.md`.
- **Resultado:** 20 resistieron.
  - Doble toque, «confirmo» y el toque a la vez, red cortada o lenta, y el mismo comando en dos sesiones: siempre una sola venta, con
    las invariantes en orden.
  - Deslizar mientras escucha y decir «confirmo» guarda lo que está a la vista.
- **Hallazgo (no viene de este PR):** con saldo a favor, la deuda dice «No debía nada · + S/ 450.00» bajo «te debe S/ 250.00», y no
  cuadra. Lo guardado está bien. El arreglo espera OK.
- La base local se restauró al respaldo de antes de atacar.
- **Arreglado con OK:**
  - La deuda y el sello usan el veredicto de la ficha del cliente (`estadoDeuda`).
  - Con saldo a favor, la deuda dice «Tenía S/ 200.00 a favor», o «Le queda a favor S/ 50.00» sin barra.
  - Al contado dice «Tiene S/ 200.00 a favor».
  - El sello dice «… tiene S/ 50.00 a favor».
  - Primero las dos e2e que fallaban; después el arreglo (`lib/voz/medidor-deuda-reglas.ts`). El mismo ataque ahora resiste.
  - Vitest 1198 de 1198; e2e de la tarjeta, de a una, 64 de 64.

