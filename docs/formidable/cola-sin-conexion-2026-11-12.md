# /formidable · Cola sin conexión (ADR-0017) · 2026-11-12

**Qué se revisó:** la franja de arriba (`components/cola/FranjaConexion.tsx`) en sus estados (sin señal, sin señal con pendientes,
señal débil, listo, rechazo), el estado «Quedó en el celular» de las tarjetas (`components/voz/EnCola.tsx`) y el aviso de dictados que
vuelven como tarjeta (`components/voz/AvisoCola.tsx`). Quién la usa: el dueño y el ayudante, en el celular, en el puesto.
Capturas en `capturas/cola-sin-conexion-2026-11-12/antes/` (412, 360 y 1280 px).

## 1 · Medido

| Medida | 412 | 360 | 1280 |
|---|---|---|---|
| Desborde horizontal | 0 | 0 | 0 |
| Controles menores de 48 px | 0 | 0 | 0 |
| Texto de la franja | 17 px (título 800) | 17 px | 17 px |
| Contraste del texto de la franja | 13.9:1 (sin señal y enviando), 7.2:1 el título rojo del rechazo, 13:1 su detalle | igual | igual |
| Contraste de los botones | «Enviar ahora» 9.8:1, «Descartarla» 11.2:1 | igual | igual |
| Alto de la franja | 100 px; 131 px con «Enviar ahora»; 205 px el rechazo | 100; **156** px con botón; 205 | 75; 131 |
| Botón de voz | 750 px de 915: sigue en el tercio de abajo | 635 de 800 | — |
| JavaScript de «Hoy» | 149.7 KB brotli (tope 180) | | |

- **Observado:** con una hoja abierta, el velo oscurece la franja: dentro de la tarjeta no hay nada que diga «sin señal» antes de tocar Confirmar.
- **Observado:** al dictar sin señal se ven dos avisos que dicen lo mismo, la franja arriba y el aviso sobre el orbe.

## 2 · Prueba a ciegas (1 agente, solo capturas a 412 y 360 px)

| Captura | Tarea | Nota | Dónde dudó |
|---|---|---|---|
| Tarjeta con «Sin señal» | ¿Qué pasa con la venta? | 8 | Entendió por la franja que se guarda y se envía después. |
| «Quedó en el celular» | ¿Ya está registrada? | 7 | «Sí en el celular, no en el sistema». El título sigue preguntando «¿Así fue la venta?». |
| «La señal está débil» | ¿Tocarías algo? | 6 | Toca «Enviar ahora» porque es lo más llamativo, y teme que se mande dos veces: «si lo reintenta solo, ¿para qué el botón?». |
| Rechazo | ¿Qué pasó y qué haces? | **3** | «Elige a otro» y «Descártala y regístrala otra vez» son dos órdenes distintas. Miedo a que «Descartarla» bote los S/ 20 ya cobrados. |
| «1 dictado listo» | ¿Qué tocas? | 6 | No dice qué dictado es (ni abono, ni de quién, ni cuánto). Teme que la X lo pierda. |

**Lo que más confundió:** el rechazo. Dos instrucciones que no cuadran, y un solo botón que se siente como botar plata.
(La captura del rechazo se armó borrando al cliente con su ficha abierta. En la vida real, la ficha ya no estaría, pero las palabras fallan igual.)

## 3 · Notas

| | Nota | Por qué |
|---|---|---|
| L1 Sin manual | 7 | El rechazo (3) y la señal débil (6) piden explicación. |
| L2 Una pregunta, una respuesta | 8 | Cada estado tiene un mensaje y como mucho una acción. |
| L3 Simplicidad profunda | 7 | «Por enviar: 2 operaciones» no dice cuáles. |
| L4 Lenguaje de puesto | 6 | «Descártala» para un abono (género), y «no se entendió: No te entendí» repite la frase. |
| L5 Contenido primero | 6 | El aviso del dictado no nombra al cliente, la fruta ni el monto. |
| L6 Lo difícil, a un toque | 8 | |
| L7 Perdonar | 6 | Descartar un abono rechazado no deja rastro de la plata recibida. |
| L8 Quitar | 7 | «Enviar ahora» compite con «lo reintento solo». Hay dos avisos al dictar sin señal. |
| L9 De punta a punta | 8 | Todos los estados existen, a 360 y a 1280 px. |
| C1 Pulgar | 7 | La única acción de la franja vive arriba (es secundaria: el orbe sigue abajo). |
| C2–C6 | 10 | Medido arriba. |
| C7 Señal | 9 | Icono y texto en cada tono. Sin señal vibra y no suena (a propósito). |
| C8 Velocidad | 9 | 149.7 KB. |
| Oficio visual | 8 | Tokens y grilla de 4. La franja oscura queda encima de la cabecera oscura en «Hoy»: dos bloques verdes pegados. |
| **Total** | **7.6** | |

## 4 · Los 3 cambios de mayor impacto (esperan el OK)

1. **El rechazo, sin órdenes cruzadas ni miedo a perder plata** (L1, L4, L7). Hoy dice «No se pudo guardar: Abono de Don Lucho · S/ 20.00 /
   Ese cliente ya no está en tu cuaderno. Elige a otro. Descártala y regístrala otra vez. [Descartarla]». Pasaría a «No entró: Abono de Don
   Lucho · S/ 20.00 / Don Lucho ya no está en tu cuaderno. Anótalo otra vez con el cliente correcto y quítalo de aquí. [Quitar de la lista]».
   La frase de la cola no repite la de la tarjeta («Elige a otro»), y el resumen deja a la vista qué plata era.
   *Se verifica con:* e2e del rechazo con el texto nuevo, y una 2.ª prueba a ciegas de esa captura.
2. **«La señal está débil» sin botón que asuste** (L8, L1). Se quita «Enviar ahora» y queda: «La señal está débil / Por enviar: 1 venta. Lo
   reintento solo, sin repetir nada.». Los reintentos se acortan a 5, 10, 20 y luego cada 30 s (antes, hasta 60 s), para que nadie extrañe el botón.
   *Se verifica con:* la prueba de reglas de `esperaTras` y la franja de 156 a 100 px a 360.
3. **El aviso del dictado dice qué es** (L5, L7). Hoy: «Volvió la señal: tienes 1 dictado listo para confirmar». Pasaría a: «Volvió la señal.
   Confirma tu abono de Don Lucho · S/ 50.00» (o «… y 2 más»), con la X como «Después (no se pierde)».
   *Se verifica con:* e2e de `cola-sin-conexion` con el texto nuevo.

**Lo que sobra (L8):** el aviso sobre el orbe al dictar sin señal repite la franja. Se acorta a «Lo guardé. Te lo muestro cuando vuelva la señal.».

**Lo que nadie pidió y más importa:** dentro de una tarjeta abierta no se sabe que no hay señal hasta tocar Confirmar (el velo tapa la
franja). Una línea sobre Confirmar, «Sin señal: se guarda en el celular», lo diría antes.

**El resto, sin ejecutar:** el título de la hoja sigue en «¿Así fue la venta?» durante «Quedó en el celular»; «Por enviar: 2 operaciones» podría
nombrarlas; la franja oscura pegada a la cabecera oscura de «Hoy».

## 5 · Después (aplicado con OK, el mismo día)

Capturas en `capturas/cola-sin-conexion-2026-11-12/despues/`, mismos anchos.

| | Antes | Después |
|---|---|---|
| Rechazo | «No se pudo guardar… Elige a otro. Descártala y regístrala otra vez. [Descartarla]» | «No entró: Abono de Don Lucho · S/ 20.00 / Ese cliente ya no está en tu cuaderno. Anótalo otra vez con lo correcto y quítalo de aquí. [Quitar de la lista]» |
| Señal débil | botón «Enviar ahora», 156 px de alto a 360 | sin botón, «Lo reintento solo, sin repetir nada», **100 px**; reintentos cada 30 s como máximo (antes 60) |
| Dictado listo | «Volvió la señal: tienes 1 dictado listo para confirmar» | «Volvió la señal. Confirma tu abono de Don Lucho · S/ 50.00.» (y «(y N más)») |

- **Medido:** 0 desborde, 0 controles chicos, contraste igual (13.9:1; rechazo 7.2:1 y 13:1; «Quitar de la lista» 11.2:1).
- **2.ª prueba a ciegas** (1 agente, mismas preguntas):
  - señal débil, de 6 a **8**: «no toco nada, sigo vendiendo»;
  - rechazo, de 3 a **5**: entiende qué no entró y por qué, pero pide un botón que lo ayude a anotarlo otra vez, no uno que lo quite;
  - dictado listo, de 6 a **7**: sabe qué es y que le falta confirmar.
  - Los números pegados a «Don Lucho 630» son de los datos de prueba, no de la app.
- **Nota nueva:** 7.6 → **8.1**.
- **Lo próximo (sin ejecutar, espera OK):**
  - «Anotarlo otra vez» en el rechazo, que abra la tarjeta del abono ya llenada para elegir otro cliente;
  - decir si la venta pendiente ya está sumada en «Vendiste hoy» (no lo está);
  - la línea «Sin señal: se guarda en el celular» sobre Confirmar;
  - la X del aviso con un texto que diga que no se pierde.
