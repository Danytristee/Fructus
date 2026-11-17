# /formidable · El aviso de stock en la tarjeta de venta (2026-11-17)

**Pantalla:** la hoja «¿Así fue la venta?» cuando la venta pide más cajas de las que hay (Informe T3). El aviso no bloquea.
**Quién:** el dueño y el ayudante en el celular, de pie y con prisa.
**Capturas:** `capturas/aviso-stock-2026-11-17/`, con una fruta a 412 y 360 px, con dos frutas (una sin stock) a 412 y 360 px, y a
1280 px.

## Medido

- **Controles:** ninguno bajo 48 px. **Desborde:** 0 a 412, 360 y 1280 px.
- **Pulgar:** Confirmar empieza al 86 % de la altura a 412 px y al 84 % a 360, y sigue habilitado con el aviso.
- **Contraste del aviso:**
  - el texto mide 17 px y tiene 12.2:1;
  - el triángulo, en el tono de aviso, tiene 5.3:1, y como ícono basta 3:1;
  - el texto en el tono de aviso daba 5.3:1, por eso va oscuro.
- **Dónde cae el aviso:** a 412 px va del 42 al 53 % de la altura; a 360, del 41 al 57 %.
- **Con dos frutas a 360 px, el Total y «Pagó / Lo debe» quedan bajo el pie fijo.** Se ven las dos frutas, los dos avisos y Confirmar,
  pero no cuánto es ni si pagó.
- **Una pieza por función:** el aviso es la pieza `Aviso`, con una variante nueva, `atencion`.
- **Movimiento:** entra con la cascada de la hoja (`animate-pieza`) y nada queda en bucle.

## Observado (prueba a ciegas, 1 agente, capturas a 412 y 360 px)

1. **Con una fruta:**
   - entendió: «el celular cree que tengo menos mango del que hay». «No me asusta: no es rojo y no dice error».
   - **Dudó si podía guardar:** «nada dice "puedes guardar igual"». Lo hizo, pero se preguntó si iba a «rebotar».
2. **«¿Falta anotar una compra?»:** entendió la pregunta, pero «no me da botón para hacerlo, no sé dónde se anota, y cuando confirme el
   aviso se va: me voy a olvidar».
3. **Con dos frutas a 360 px:**
   - «el total no lo encuentro». «Puede tocar Confirmar sin ver cuánto es ni si Luis pagó o lo debe». **No dejaría que el ayudante la
     guarde así.**
   - La pregunta por la compra sale solo en el último aviso: «¿el mango no necesita compra?».
   - «Con los dos avisos juntos ya parece que algo anda mal».

## Notas (0–10)

| Ley o regla | Nota | Por qué |
|---|---|---|
| 1 · Sin manual | 7 | El aviso se entiende, pero no dice que se puede guardar igual. |
| 2 · Una pregunta, una respuesta | 7 | Con dos frutas son dos avisos y la pregunta queda en uno solo. |
| 3 · Simplicidad profunda | 8 | «Según la app te quedan 6 y vas a vender 10» es un veredicto. |
| 4 · Lenguaje de puesto | 9 | «Según la app», «¿Falta anotar una compra?». |
| 5 · Contenido primero | 5 | Con dos avisos a 360 px, el dinero se va de la pantalla. |
| 6 · Lo difícil, a un toque | 6 | Anotar la compra que falta no está a ningún toque. |
| 7 · Perdonar antes que preguntar | 9 | No bloquea; se confirma igual. |
| 8 · Quitar antes de agregar | 7 | Dos avisos donde alcanza uno. |
| 9 · De punta a punta | 7 | Una fruta, sin stock, en negativo y sin señal están bien; dos frutas a 360 px, no. |
| C1 · C2 · C3 · C4 · C5 | 10 · 10 · 10 · 10 · 10 | Medido. |
| C7 Señal | 10 | Icono, texto y color. |
| Oficio visual | 8 | Pieza y tokens bien; la altura del aviso empuja el contenido. |
| **Total** | **7.6** | |

## Los 3 cambios de mayor impacto (propuestos, esperan OK)

1. **Un solo aviso, debajo de «Pagó / Lo debe».**
   - **Antes:** un aviso por fruta, entre las frutas y el total.
   - **Después:** un solo aviso para todas las frutas, después de la píldora «Pagó / Lo debe», así el total y el pago quedan arriba. Con
     una fruta dice lo mismo que hoy; con dos: «Según la app no alcanza: de Mango Kent te quedan 6 y vas a vender 10; de Palta Fuerte no
     te queda».
   - **Arregla:** leyes 5, 2 y 8, y la regla de que el dinero sea protagonista.
   - **Se verifica:** con dos frutas a 360 px, el total y «Pagó / Lo debe» a la vista, sin deslizar.
2. **Decir que se puede guardar igual.**
   - **Antes:** «¿Falta anotar una compra?».
   - **Después:** «Igual puedes confirmarla. ¿Falta anotar una compra?».
   - **Arregla:** leyes 1 y 7. La duda de si iba a «rebotar».
   - **Se verifica:** Vitest, la e2e y una segunda prueba ciega.
3. **No olvidar la compra.**
   - **Antes:** al confirmar, el aviso se va y no queda nada.
   - **Después:** el sello de «Venta guardada» lo recuerda: «Falta anotar la compra de Mango Kent: tócala en Compra». «Compra» ya está
     en «Hoy», así que no se agrega un botón ni un flujo nuevo.
   - **Arregla:** la ley 6 y el «me voy a olvidar».
   - **Se verifica:** con la e2e del aviso.

**Lo que sobra (ley 8):** el segundo aviso cuando hay dos frutas; el cambio 1 lo quita.

**Lo que nadie pidió y más importa:** el aviso solo es tan bueno como el stock. Si en el puesto las compras se anotan tarde, va a avisar
casi siempre y se volverá ruido. Conviene ver en la demo con datos reales cuántas ventas lo muestran. Si son muchas, el arreglo es
anotar la compra al llegar (voz: «llegaron 20 de mango»), no esconder el aviso.

**Lista aparte (sin ejecutar):**
- Un botón «Anotar compra» dentro de la hoja abriría la compra a mano encima de la venta: es un flujo nuevo y cruza módulos.
- Refrescar el stock si la tarjeta lleva mucho rato abierta. Hoy avisa con el de la apertura (/chaos E): es aceptable porque solo avisa.
