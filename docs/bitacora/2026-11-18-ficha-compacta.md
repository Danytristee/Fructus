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
