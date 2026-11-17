# /formidable · La tarjeta de venta con manos libres, después de responder o corregir (2026-11-17)

**Pantalla:** la hoja «¿Así fue la venta?» con manos libres (ADR-0020). Esta vez se miden los momentos que cambiaron hoy:
- tras responder «¿Pagó o lo debe?» se dice solo «Lo debe. ¿Confirmo?»;
- tras corregir hablando se dice solo lo que cambió: «Corregido. 8 cajas… Total, 360 soles. ¿Confirmo?».

También se miden de nuevo los momentos de siempre: leyendo, escuchando y preguntando si pagó. El informe anterior es
[manos-libres-2026-11-16](manos-libres-2026-11-16.md), con nota 8.8.

**Quién:** el dueño o el ayudante en el celular, de pie, con una caja en cada mano y audífono.

**Capturas:** `capturas/manos-libres-2026-11-17/`, a 412 y 360 px, y la corregida a 1280 px. La voz y el micrófono se simularon con
`tests/e2e/manos-libres.ts`; el comando de voz es real, contra la base local.

## Medido

| Momento | Controles < 48 px | Desborde | Confirmar (inicio, alto) | Línea de la voz | Total |
|---|---|---|---|---|---|
| Leyendo, escuchando, pago, pago anotado y corregida, a 412 px | 0 | 0 | 86 %, 68 px | 17 px, 14.6:1 | 38.7 px, 14.6:1 |
| Los mismos, a 360 px | 0 | 0 | 84 %, 68 px | 17 px, 14.6:1 | 33.8 px, 14.6:1 |
| Corregida, a 1280 px | 0 | 0 | 70 %, 68 px | 17 px, 14.6:1 | 46 px, 14.6:1 |

- **Después de corregir desaparece el recuadro de la deuda.** «Con esta venta, Luis Paredes te debe S/ 6,700.00 · Ya debía
  S/ 6,250.00» está mientras escucha (412 y 360 px), pero no vuelve tras «no, son ocho cajas» (0 textos con «debe» o «Ya debía»).
  - **Causa:** al corregir, `TarjetaVenta.tsx:81` borra el saldo, pero el saldo solo se vuelve a pedir cuando cambia el cliente
    (`TarjetaVenta.tsx:88-98`). Si se corrigen las cajas, el cliente es el mismo y el saldo no vuelve.
  - **Viene de antes de hoy:** ese borrado está desde que existe la corrección hablada (16-11). El informe anterior no midió la tarjeta
    ya corregida.
  - **Además, la hoja queda más baja** y detrás se asoma «Vendiste hoy S/ 10,440.00».
- **Lo que se dice, en palabras:**
  - lectura completa al abrir: 18;
  - tras responder si pagó: 3 («Lo debe. ¿Confirmo?»), antes eran 18;
  - tras corregir las cajas: 14 («Corregido. 8 cajas de Mango Kent, a 45 la caja. Total, 360 soles. ¿Confirmo?»), antes eran 18.
    Con una sola fruta se ahorra poco, porque se repiten la fruta y el precio aunque no cambiaron.
- **Escuchando, la línea dice «di «confirmo» o lo que hay que cambiar».** No dice que se puede pedir «repite».
- **JavaScript de «Hoy»:** no se midió hoy. El cambio vive en la hoja, que se carga con la hoja; ayer eran 153.2 KB.

## Observado (prueba a ciegas, 1 agente, solo las capturas a 412 px y lo que se oye)

Hizo de dueño con una caja en cada mano y audífono.

1. **Corregir 10 → 8:** dijo «no, son ocho cajas» sin soltar nada, guiado por la línea de la voz.
2. **Tras la corrección:**
   - Vio el cambio en «8 cajas» y «S/ 360.00».
   - **Lo que más lo hizo dudar:** «se fue el cuadro de la deuda». Se preguntó si seguía siendo al crédito y tuvo que mirar dos veces el
     botón «Lo debe».
   - El «S/ 10,440.00» que se asoma detrás le hizo pensar por un segundo que era de esta venta.
   - **En la pantalla no se marca qué se corrigió:** «tuve que comparar de memoria el 10 con el 8».
   - Igual diría «confirmo», después de mirar dos veces.
3. **«¿Pagó o lo debe?»:** «clarísimo». Tras «Lo debe. ¿Confirmo?» le quedó claro qué se guardaba y no le sobró nada. Avisó que si un
   cliente lo distrae, ya no tendría el total en la cabeza.
4. **No oyó por un camión:** «no sé qué decir». No sabía que puede pedir «repite». Soltaría una caja y tocaría Confirmar, justo lo que
   manos libres quiere evitar. Tampoco sabía cuánto rato lo escucha.

## Notas (0–10)

| Ley o regla | Nota | Por qué |
|---|---|---|
| 1 · Sin manual | 7 | Corregir sale a la primera; «repite» no se descubre, y ahora es la única forma de oír la venta entera. |
| 2 · Una pregunta, una respuesta | 8 | Al preguntar si pagó, la pregunta sigue saliendo tres veces (no confundió). |
| 3 · Simplicidad profunda | 7 | La voz dice qué cambió, pero la tarjeta no lo marca: hay que comparar de memoria. |
| 4 · Lenguaje de puesto | 9 | «Corregido» y «Lo debe. ¿Confirmo?» se entienden sin explicación. |
| 5 · Contenido primero | 7 | Tras corregir se pierde la deuda del cliente, y se asoma el dinero del día detrás de la hoja. |
| 6 · Lo difícil, a un toque | 8 | Sin cambios. |
| 7 · Perdonar antes que preguntar | 9 | Nada se guarda sin «confirmo». |
| 8 · Quitar antes de agregar | 8 | La corrección repite la fruta y el precio que no cambiaron. |
| 9 · De punta a punta | 6 | El estado «corregida» no está cuidado como el de recién dictada. |
| C1 Pulgar · C2 Tamaño · C3 Sol · C4 Bordes · C5 Hojas | 10 · 10 · 10 · 10 · 10 | Medido. |
| C7 Señal | 9 | Sin cambios. |
| C8 Velocidad | — | No medido hoy. |
| Oficio visual | 9 | La hoja cambia de alto al corregir. |
| **Total** | **8.2** | Baja de 8.8 porque hoy se midió la tarjeta ya corregida, que ayer no se miró. |

## Los 3 cambios de mayor impacto (propuestos, esperan OK)

1. **La deuda vuelve después de corregir.** *(Muestra dinero: espera OK, candado 2.)*
   - **Antes:** tras «no, son ocho cajas» desaparece el recuadro «te debe» y no vuelve.
   - **Después:** el recuadro sigue y se recalcula con el total nuevo: «Con esta venta, Luis Paredes te debe S/ 6,610.00 · Ya debía
     S/ 6,250.00 · + S/ 360.00 de hoy». El saldo anterior solo se borra si la corrección cambió de cliente; si no, se queda, porque es
     el mismo.
   - **Arregla:** leyes 9, 5 y 3, y la duda «¿sigue siendo al crédito?». La hoja ya no cambia de alto.
   - **Se verifica:** la e2e de «no, son ocho cajas» espera el recuadro con S/ 360.00 de hoy, y se toman capturas a 412 y 360 px.
2. **La tarjeta marca lo que se corrigió.**
   - **Antes:** la voz dice «Corregido. 8 cajas…», pero en la tarjeta «8 cajas» se ve igual que cualquier dato.
   - **Después:** una insignia «Corregido» junto a cada dato que cambió (la fruta, el cliente, el total) hasta que se confirme. Es una
     variante nueva de `Insignia` (`components/ui/Insignia.tsx`), con texto e ícono, no solo color (C7).
   - **Arregla:** leyes 3 y 1. La pantalla dice lo mismo que el oído, y al mirar ya no se compara de memoria.
   - **Se verifica:** con Vitest de la regla que decide qué cambió (la misma de `guionCorreccion`), la e2e y las capturas.
3. **Enseñar «repite».**
   - **Antes:** «Te escucho: di «confirmo» o lo que hay que cambiar.»
   - **Después:** «Te escucho: di «confirmo», «repite» o lo que hay que cambiar.» Desde hoy la lectura completa solo se oye al abrir o
     pidiéndola, así que «repite» pasa a ser la salida cuando pasa un camión.
   - **Arregla:** leyes 1 y 9. Que no se suelte una caja por no haber oído.
   - **Se verifica:** con Vitest de `notaManosLibres`, y midiendo que la línea no pase de dos renglones a 360 px.

**Lo que sobra (ley 8):** en una corrección de cajas, la fruta y el precio que no cambiaron. Se puede decir «Corregido. 8 cajas de Mango
Kent. Total, 360 soles. ¿Confirmo?», que son 10 palabras en vez de 14. Va en la lista aparte: primero el cambio 2, para que la pantalla
cuente lo que la voz se ahorra.

**Lo que nadie pidió y más importa:** probarlo con el audífono en el S25, en el puesto. Con lecturas más cortas, lo que decide si sirve es
que el micrófono se abra a tiempo después de «¿Confirmo?» y no se coma el principio del «confirmo».

**Lista aparte (sin ejecutar):**
- La corrección más corta, como se describe en «lo que sobra».
- La pregunta del pago sale tres veces. El ciego dijo «clarísimo», así que no se toca sin otra prueba.
- No se sabe cuánto rato escucha (5 s). Un indicador con reloj ya se descartó en «Hola Fructus» (16-11) por ruido: no se agrega sin
  una prueba que muestre que hace falta.
- Lo que sigue pendiente del 16-11: marcar en la tarjeta el dato que tiene la duda.

## Después (con OK, los 3 cambios)

1. **La deuda vuelve después de corregir:** al corregir, el saldo solo se borra si cambió el cliente. Si no, el recuadro se recalcula con
   el total nuevo: «… te debe S/ 9,620.00 · Ya debía S/ 9,260.00 · + S/ 360.00 de hoy».
2. **La tarjeta marca lo corregido:** la variante `corregido` de `Insignia` (lápiz más texto) aparece en las frutas que cambiaron, en el
   cliente y en el total. Sale de `cambiosDeCorreccion`, la misma regla que arma lo que dice la voz. Si se toca y se cambia algo a mano,
   la marca se va.
3. **«Repite» se enseña:** «Te escucho: di «confirmo», «repite» o lo que hay que cambiar.»

**Medido después**, en los mismos 6 momentos, a 412, 360 y 1280 px:
- 0 controles bajo 48 px y 0 desborde.
- Confirmar empieza al 86 % de la altura a 412 px, al 84 % a 360 y al 78 % a 1280.
- La línea de la voz ocupa 2 renglones a 412 y 360 px, con 14.6:1 a 17 px.
- **«corregido»**: 15 px, igual que «sugerido». Contraste de 9.8:1 sobre la fila y 9.0:1 sobre el fondo del total, calculado mezclando el
  12 % del acento sobre el fondo; la medición directa daba 1.7 porque tomaba el fondo translúcido como sólido.
- **La deuda tras corregir:** está a 412, 360 y 1280 px, con «+ S/ 360.00 de hoy».
- A 360 px, el «corregido» del total baja a un segundo renglón bajo «Total». Se lee y no desborda.

**Verificado:**
- Vitest: 380 de `lib/voz` en verde, con la regla nueva `cambiosDeCorreccion`.
- Playwright a 412 y 360 px: `voz-confirmar-hablando`, `voz-candados`, `voz-operaciones-hablando` y `voz-venta`, 48 de 48. La de «no, son
  ocho cajas» espera dos «corregido» y el recuadro de la deuda con el total nuevo.

**2.ª prueba ciega (1 agente, solo las capturas de después):**
- **Corregir:** «lo entendí a la primera». No soltó nada.
- **Tras corregir:** vio las dos «corregido» y la deuda bajar de S/ 9,710 a S/ 9,620. Ya no dudó si seguía al crédito.
- **«Repite»:** «diría "repite", porque la pantalla me lo ofrece».
- **Lo nuevo que lo hizo dudar:**
  - el «corregido» de la fruta queda pegado a «S/ 45.00 la caja», y «por un momento pensé que habían cambiado el precio»;
  - al preguntar el pago, la línea no ofrece «repite». Sí funciona ahí (`/api/voz/respuesta` lo revisa antes de cualquier pregunta),
    pero no se dice.

| Ley | Antes | Después |
|---|---|---|
| 1 · Sin manual | 7 | 8 |
| 3 · Simplicidad profunda | 7 | 8 |
| 5 · Contenido primero | 7 | 9 |
| 9 · De punta a punta | 6 | 8 |
| Oficio visual | 9 | 9 |
| **Total** | **8.2** | **8.8** |

**Siguiente (espera OK):**
1. Poner «corregido» junto a lo que cambió de la fruta y no al final de la línea del precio. Por ejemplo, con las cajas corregidas, junto
   a «8 cajas», para que no parezca que cambió el precio.
2. Enseñar «repite» también al preguntar el pago: «Te escucho: di «pagó», «lo debe» o «repite».»
3. Lo que sigue de antes: probarlo con audífono en el S25, en el puesto, y la corrección más corta («Corregido. 8 cajas de Mango Kent.
   Total, 360 soles.»).
