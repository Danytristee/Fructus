# /formidable · La ficha de venta con manos libres, sin deslizar para leer (2026-11-18)

**Pantalla:** la hoja «¿Así fue la venta?» (`TarjetaVenta`) con manos libres prendido (ADR-0020).

**Lo que pidió quien dirige el proyecto:** «toda la información se debe ver bien y compacta, para que no se tenga que hacer un scroll
innecesario para leer las cosas y de esa manera el asistente deje de escuchar o de hablar simplemente porque quería leer los campos
faltantes».

**Quién:** el dueño en el S25 (412 px) o un ayudante en un Android de gama media (360 px), de pie y con audífono.

**Capturas:** `capturas/ficha-compacta-2026-11-18/`, prefijo `antes-`. La voz y el micrófono se simularon con
`tests/e2e/manos-libres.ts`; el comando de voz es real, contra la base local. Los 5 casos son ventas a Luis Paredes, que ya debe
S/ 2,390.00:

1. una fruta al crédito;
2. una fruta sin decir si pagó;
3. dos frutas al contado;
4. una fruta sin precio;
5. tres frutas al crédito, con una duda, boleta y más cajas de las que hay.

## Medido

Cuánto hay que deslizar la hoja para ver todo, mientras Fructus lee la venta:

| Caso | 412 × 915 | 360 × 800 |
|---|---|---|
| 1 · Una fruta al crédito | 0 px | **67 px** (la deuda queda bajo el pie) |
| 2 · Sin decir si pagó | 0 px | 0 px (crece al responder «lo debe») |
| 3 · Dos frutas al contado | 0 px | **44 px** |
| 4 · Sin precio | 0 px | 0 px |
| 5 · Tres frutas, duda, boleta, poco stock | **379 px** | **561 px** |

**Deslizar calla al asistente.** Con un toque real (CDP), deslizar 324 px el caso 5 a 360 px borra «Te la estoy leyendo…»: la lectura
se corta y el micrófono no se abre.
- **Causa:** la tarjeta calla la voz en `onPointerDown` (`TarjetaVenta.tsx:236`). Un deslizamiento empieza con el mismo
  `pointerdown` que un toque, así que leer deslizando cuenta como «tocar la tarjeta».
- **Dónde más:** pasa igual en las tarjetas de abono, compra, merma, gasto y conteo.

**Dónde se va el alto** (caso 1 a 360 px; la ventana que se lee entre el título y el pie es de unos 496 px):

| Bloque | Alto |
|---|---|
| Pie: línea de la voz, Confirmar y Descartar (fijo abajo) | 177 px |
| Deuda: «Con esta venta, Luis Paredes te debe S/ 2,840.00», barra y «Ya debía… + … de hoy» | **157 px** |
| Fila de la fruta («10 cajas de Plátano de seda» en 2 renglones y el precio) | 106 px |
| Título de la hoja y manija | 79 px |
| Fila del cliente | 78 px |
| Pagó / Lo debe | 68 px |
| «Pagó una parte», a todo el ancho | 56 px |
| Total | 38 px |

Con tres frutas se suman el aviso de stock (157 px), el comprobante (80 px) y la duda (25 px).

## Observado

Sin prueba a ciegas esta vez: el problema se mide en píxeles y con un toque real. Se hará con las capturas de después.

## Notas (0–10)

| Ley o regla | Nota | Por qué |
|---|---|---|
| 1 · Sin manual | 8 | La ficha se entiende; nadie sabe que deslizar calla la voz. |
| 2 · Una pregunta, una respuesta | 8 | Sin cambios. |
| 3 · Simplicidad profunda | 7 | La deuda dice una cifra en cinco renglones. |
| 4 · Lenguaje de puesto | 9 | Sin cambios. |
| 5 · Contenido primero | 6 | A 360 px la deuda queda tapada por el pie; el relleno de las filas pesa más que los datos. |
| 6 · Lo difícil, a un toque | 8 | Sin cambios. |
| 7 · Perdonar antes que preguntar | 9 | Nada se guarda sin «confirmo». |
| 8 · Quitar antes de agregar | 6 | El nombre del cliente se repite en la deuda; «Pagó una parte» ocupa todo el ancho para algo raro. |
| 9 · De punta a punta | 5 | Con tres frutas hay que deslizar, y deslizar rompe manos libres. |
| C1 Pulgar · C3 Sol · C4 Bordes · C5 Hojas | 10 · 10 · 10 · 10 | Confirmar empieza al 78 % (360 px) y al 81 % (412 px); 0 desborde. |
| C2 Tamaño | 10 | Del 17-11, sin cambios desde entonces. |
| C7 Señal | 9 | Sin cambios. |
| C8 Velocidad | — | No medido: el cambio vive en la hoja. |
| Oficio visual | 8 | Filas de 72 px de alto mínimo para un dato de un renglón. |
| **Total** | **7.6** | Baja de 8.8 porque hoy se midieron ventas de más de una fruta y el deslizamiento. |

## Los 3 cambios de mayor impacto (propuestos, esperan OK)

1. **Deslizar para leer no calla.** *(Toca la voz de todas las tarjetas: espera OK.)*
   - **Antes:** cualquier dedo encima de la tarjeta, aunque sea para deslizar, corta la lectura o la escucha.
   - **Después:** la voz se calla con un toque (tocar un dato, un botón o la tarjeta), no al deslizar. El candado de ADR-0020 sigue
     igual: tocar la tarjeta calla. Además, Enter con el teclado también calla (hoy no).
   - **Arregla:** ley 9 y principio 12 (es la causa raíz: aunque la ficha se compacte, con tres frutas igual habrá que deslizar).
   - **Se verifica:** e2e con toques reales a 412 y 360 px: deslizar deja «Te la estoy leyendo…» y después se escucha «confirmo»;
     tocar un dato sigue callando.
2. **La deuda en dos renglones.** *(Muestra dinero: espera OK, candado 2.)*
   - **Antes:** 157 px. «Con esta venta, Luis Paredes te debe S/ 2,840.00», la barra y «Ya debía S/ 2,390.00 · + S/ 450.00 de hoy».
   - **Después:** unos 90 px. «Con esta venta te debe» y la cifra en grande a la derecha, como el total; debajo, la barra y «Ya debía
     S/ 2,390.00 · + S/ 450.00 hoy». Las cifras no cambian; se quita el nombre, que está en la fila de arriba. Al contado, «De antes,
     Luis Paredes te debe S/ 2,390.00» (2 renglones) pasa a «De antes te debe S/ 2,390.00» (1 renglón).
   - **Arregla:** leyes 3, 5 y 8.
   - **Se verifica:** caso 1 a 360 px con 0 px que deslizar; las e2e que leen la deuda, ajustadas al texto nuevo.
3. **Filas del cliente y de cada fruta más bajas.**
   - **Antes:** 72 px de alto mínimo, 12 px de relleno y avatar o fruta de 48 px.
   - **Después:** 64 px de alto mínimo, 8 px de relleno y 40 px. El texto no se achica (22 px). Ahorra unos 14 px por fila.
   - **Arregla:** ley 5 y oficio visual.
   - **Se verifica:** casos 1 y 3 a 360 px con 0 px que deslizar; controles de 48 px o más.

**Lo que sobra (ley 8):** el nombre del cliente repetido en la deuda (ya está en el cambio 2).

**Lo que nadie pidió y más importa:** el cambio 1. Compactar no alcanza: una venta de tres frutas con un aviso no entra en ningún
celular, y hoy leerla deslizando corta la voz.

## Fuera de los 3 (sin ejecutar)

- «Descartar» al lado del título: el pie fijo bajaría de 177 a unos 120 px y la ventana de lectura crecería 11 %. Cambia el pie de
  todas las tarjetas de voz y a mano.
- «Pagó una parte» como enlace dentro de la fila del pago, no un botón a todo el ancho (56 px).
- El aviso de stock en dos renglones (157 px a 360 px).
- El título de la hoja más bajo (79 px), pero `Hoja` es de toda la app.

## Después (los 3 cambios, con OK)

Capturas con prefijo `despues-`, mismos 5 casos y mismos anchos.

| Caso | 412 × 915 | 360 × 800 |
|---|---|---|
| 1 · Una fruta al crédito | 0 px | **67 → 0 px** |
| 2 · Sin decir si pagó | 0 px | 0 px |
| 3 · Dos frutas al contado | 0 px | **44 → 0 px** |
| 4 · Sin precio | 0 px | 0 px |
| 5 · Tres frutas, duda, boleta, poco stock | 379 → 285 px | 561 → 441 px |

- **Deslizar ya no calla.** Con toques reales (CDP), el caso 5 deslizado 327 px sigue con «Te la estoy leyendo…»; terminada la
  lectura, deslizar de vuelta sigue con «Te escucho…»; un toque en «Total» la calla. Prueba nueva: `voz-ficha-compacta.spec.ts`, 6 de
  6 a 412 y 360 px.
- **La deuda:** de 157 a 93 px a 360 px, en dos renglones. Medido con Manrope, cada renglón cabe en los 300 px de la caja hasta
  S/ 9,999.99 de deuda. Con cinco cifras, a 360 px la cifra baja sola a un segundo renglón, a la derecha.
  - **Diferencia con lo propuesto:** el renglón de abajo dice «Debía», no «Ya debía». Con «Ya debía» se partía en cuanto la venta
    pasaba de S/ 1,000 (161 + 137 px no caben en 300).
  - La frase de arriba va a 17 px y la cifra a 18 px, en negrita.
- **Las filas:** el cliente, de 78 a 65 px; la fruta en dos renglones, de 106 a 90 px.
- **Medido:** 0 controles bajo 48 px y 0 desborde en los 10 casos.
- **Pruebas:** Vitest 1192 de 1192 (9 nuevas en `toque-reglas.test.ts`); tipos, ESLint y Knip limpios.
  - Las e2e de las tarjetas de voz, la hoja y el teclado dieron 169 de 174 con 2 a la vez.
  - Las 5 en rojo (`voz-pago-parcial` 34 y 65 a los dos anchos, y `hoja-gestos` 102 a 412) pasan de a una, 26 de 26. Esperan el saldo
    exacto de Luis Paredes, que otras pruebas en paralelo también cambian, con carga de 16 en la máquina.
- **Sin medir a 1280 px:** en escritorio la hoja mide 440 px y el cambio solo la acorta.

## Observado (prueba a ciegas, 1 agente, solo las 3 capturas de después)

Hizo de vendedor con una caja en cada mano y audífono.

- **Una fruta al crédito (360 px): 9/10.** Leyó todo sin tocar y explicó la deuda: «2,390 + 450 = 2,840. Cuadra». Dudó si «hoy» es todo
  lo fiado hoy o solo esta venta («"esta venta" lo diría más claro»).
- **Dos frutas al contado (360 px): 8/10.** Todo entra.
  - «De antes te debe» no dice quién; supuso que es Luis por la tarjeta.
  - Tampoco dice si esa deuda sigue igual. Propuso «Sigue debiendo S/ 2,390 de antes».
  - No sabe si «Efectivo» lo dijo él o lo puso la app.
- **Tres frutas (412 px): 4/10.** El aviso de stock queda cortado por el pie y la deuda está más abajo. Se tiene que deslizar, que es lo
  que el cambio 1 deja hacer sin cortar la voz.
  - La duda «papaya o piña» lo confundió. Es un texto inventado para la medición, no uno del intérprete.
- El círculo con la «N» es el indicador de desarrollo de Next: no sale en producción.

## Notas después

| Ley o regla | Antes | Después | Por qué |
|---|---|---|---|
| 3 · Simplicidad profunda | 7 | 8 | La deuda en dos renglones; el ciego hizo la cuenta solo. |
| 5 · Contenido primero | 6 | 8 | La venta de una o dos frutas entra entera a 360 px. |
| 8 · Quitar antes de agregar | 6 | 7 | Sin el nombre repetido; «Pagó una parte» sigue a todo el ancho. |
| 9 · De punta a punta | 5 | 8 | Lo largo se desliza sin cortar la voz; con tres frutas, el aviso de stock sigue debajo. |
| Oficio visual | 8 | 9 | Filas a la medida del texto. |
| Las demás | — | sin cambio | — |
| **Total** | **7.6** | **8.4** | |

## Queda (sin ejecutar, espera OK)

- «De antes te debe» no dice quién ni que sigue igual (ciego: «Sigue debiendo S/ 2,390 de antes»).
- «+ S/ 450.00 hoy» se puede leer como todo lo fiado hoy. «de esta venta» no cabe en el renglón a 360 px.
- Con tres frutas y un aviso de stock, el aviso queda bajo el pie: subirlo, o acortar el aviso (157 px a 360 px).
- Los de «Fuera de los 3»: «Descartar» al lado del título y «Pagó una parte» como enlace.

## 2.ª vuelta: lo que dejó la prueba a ciegas (3 cambios con OK)

Antes de proponer se midió cada frase con Manrope a 360 px. «+ S/ 450.00 de esta venta» y «Esta venta S/ 450.00» no entran en el
renglón de la deuda (372 y 335 de 300 px); por eso no se propusieron.

1. **Sin «hoy» en la deuda:** «Debía S/ 2,390.00 · + S/ 450.00». Arriba ya dice «Con esta venta te debe».
2. **Al contado, «Te sigue debiendo S/ 2,390.00»** (antes «De antes te debe»). Dice que esa deuda sigue igual con esta venta; mide 258
   de 320 px y entra con cinco cifras.
3. **El stock que no alcanza se marca en la fila de la fruta**, bajo su precio: «⚠ Solo hay 34» (o «No te queda», sin una cifra
   imposible). Se quitó el recuadro de 157 px.
   - Es una variante nueva de `Insignia` (`stock`): fondo e ícono en tono de aviso, texto oscuro para el 7:1, como el `Aviso` de
     atención.
   - La voz lo sigue diciendo entero, y el sello recuerda la compra al guardar.
   - Salen `AvisoStock.tsx`, `textoAviso`, `textoAvisos` y `SUGERENCIA_AVISO`; entra `faltaEnFila`.

Capturas con prefijo `despues2-`:

| Caso | 412 px | 360 px |
|---|---|---|
| 1 a 4 | 0 px | 0 px |
| 5 · Tres frutas, duda, boleta, poco stock | 379 → 285 → **148 px** | 561 → 441 → **331 px** |

- A 412 px, «Solo hay 34» queda junto al precio y a la vista sin deslizar. A 360 px baja a su propio renglón dentro de la fila.
- **Medido:** 0 controles bajo 48 px y 0 desborde en los 10 casos.
- Con la deuda de prueba de Luis Paredes ya en S/ 31,050.00, el caso 1 sigue en 0 px a 360. La cifra de cinco dígitos baja de renglón
  y entra igual.
- **Pruebas:**
  - `voz-ficha-compacta.spec.ts` suma «con tres frutas, la que no alcanza lo dice en su fila, a la vista sin deslizar».
  - `voz-aviso-stock.spec.ts` se adaptó a la fila: 18 de 18 entre las dos.
  - Vitest 1191 de 1191 (`faltaEnFila` con sus casos; se fueron las de `textoAviso`).
  - E2e de voz afectadas, de a una: 83 de 86.
    - `voz-confirmar-hablando` 129 esperaba que la fila terminara en «la caja». Ahora acepta «No te queda» al final: Mango Kent está en
      negativo en la base de prueba.
    - Dos de `voz-candados` fallaron por carga: un login de más de 15 s.
    - Repetidas, 22 de 22.
