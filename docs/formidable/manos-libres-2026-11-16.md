# /formidable · Manos libres en la hoja de confirmación (2026-11-16)

**Pantalla:** la hoja de la venta con manos libres (ADR-0020), en cada momento de la voz:
- leyendo («Te la estoy leyendo…»);
- escuchando («Te escucho: di «confirmo» o toca Confirmar»);
- preguntando si pagó;
- con dudas del intérprete;
- callada: no te oí, sin señal.

Además, la fila «Manos libres» del menú Más.

**Quién:** el dueño y el ayudante en el celular, de pie, con una caja en cada mano y audífono.

**Capturas:** `capturas/manos-libres-2026-11-16/`, a 412 y 360 px, y escuchando a 1280 px. La voz y el micrófono se simularon con `tests/e2e/manos-libres.ts`.

## Medido

- **Controles:** ninguno bajo 48 px en ningún estado, ni en la hoja ni en el menú, a 412, 360 y 1280 px.
- **Pulgar:** Confirmar empieza al 86 % de la altura a 412 px, al 84 % a 360 y al 77 % a 1280 (hoja centrada), con 68 px de alto.
- **Contraste:** la línea de la voz tiene 14.6:1 a 17 px en todos los estados.
- **Desborde horizontal:** 0 en todos los estados y anchos.
- **Una pieza por función:**
  - la línea de la voz es la misma en las cinco tarjetas (`notaDeVoz`, en el pie de `PieConfirmar`);
  - el interruptor es la misma perilla que «Aviso del día» (`components/ui/Interruptor.tsx`).
- **Movimiento:** nada nuevo en bucle. La línea aparece y cambia de texto, sin animación propia.
- **JavaScript de «Hoy»:** 153.2 KB brotli (tope 180). La voz de la hoja se carga con la hoja.

## Observado (prueba a ciegas, 1 agente, solo con las capturas a 412 y 360 px)

Hizo de dueño con una caja en cada mano y audífono.

1. **Guardar:** dijo «confirmo» a la primera, por la línea «Te escucho: di «confirmo»…». No sabía qué le avisaría que ya se guardó; en el celular, el aviso es «Guardado», la vibración y el sello.
2. **Corregir 10 → 8 cajas:** probaría «no, son 8», pero **nada en la pantalla dice que se pueda corregir hablando**. Solo vio el lápiz, que obliga a soltar una caja.
3. **No oyó la lectura:** diría «repite» o «¿qué?», pero **no hay cómo pedir que la repita**. Hoy esa respuesta cuenta como «otra cosa» y Fructus dice «Para guardar, di confirmo» sin volver a leer.
4. **«¿Pagó o lo debe?»:** dijo «lo debe». Dudó si con eso ya se guardaba. La pregunta sale tres veces: el título de la píldora, la línea de la voz y el botón «Primero: ¿pagó o lo debe?».
5. **Con dudas del intérprete:** fue **donde más dudó**.
   - Al oído solo oyó «tengo una duda», sin cuál.
   - La duda («No sé si dijo 10 o 12 cajas») está en una línea gris y chica.
   - «10 cajas» sigue en grande y sin marca.
   - Tuvo que soltar las cajas para mirar.
   - El «dijo» le sonó a otra persona.

Lo demás que notó y no es de este cambio:
- La «N» es el indicador de desarrollo de Next y no existe en producción.
- A 360 px, el recuadro de la deuda queda bajo el pie fijo hasta deslizar, y detrás de la hoja se asoma «Hoy». Ya estaba así.

## Notas (0–10)

| Ley o regla | Nota | Por qué |
|---|---|---|
| 1 · Sin manual | 7 | Confirmar sale a la primera; corregir y repetir no se descubren. |
| 2 · Una pregunta, una respuesta | 8 | Al preguntar si pagó, la pregunta sale tres veces. |
| 3 · Simplicidad profunda | 8 | La duda se dice como «tengo una duda», no como un veredicto. |
| 4 · Lenguaje de puesto | 8 | «Dijo» en la duda habla de la persona en tercera persona (lo escribe el intérprete). |
| 5 · Contenido primero | 9 | Cliente, cajas, total y deuda mandan; la voz es una línea. |
| 6 · Lo difícil, a un toque | 7 | La duda solo se sabe mirando. |
| 7 · Perdonar antes que preguntar | 9 | Nada se guarda sin «confirmo»; tocar toma el control. |
| 8 · Quitar antes de agregar | 8 | La triple pregunta del pago. |
| 9 · De punta a punta | 8 | Sin señal, no te oí y falla del servidor bien dichos; falta «repite». |
| C1 Pulgar · C2 Tamaño · C3 Sol · C4 Bordes · C5 Hojas | 10 · 10 · 10 · 10 · 10 | Medido. |
| C7 Señal | 9 | Guardar suena, vibra y dice «Guardado»; escuchar se ve solo por la línea y el micrófono. |
| C8 Velocidad | 10 | 153.2 KB. |
| Oficio visual | 9 | Una pieza por función; la línea comparte el pie con los avisos. |
| **Total** | **8.5** | |

## Los 3 cambios de mayor impacto (propuestos, esperan OK)

1. **Decir la duda, no solo que hay una.**
   - Antes: «Tengo una duda con esta venta. Revisa la tarjeta y toca Confirmar.» Después: «Tengo una duda: no sé si dijo 10 o 12 cajas. Revisa la tarjeta y toca Confirmar.» Con varias dudas se dice la primera y «y una más».
   - Arregla las leyes 6, 3 y 1.
   - Se verifica con Vitest de `guionVenta`, `guionAbono` y `guionCompra`, y la e2e de dudas de `voz-candados.spec.ts`.
2. **Enseñar que se corrige hablando.**
   - Antes: «Te escucho: di «confirmo» o toca Confirmar.» Después, en la venta: «Te escucho: di «confirmo» o lo que hay que cambiar.»
   - «O toca Confirmar» sobra: el botón está justo abajo. Abono, merma, gasto y compra siguen igual, porque no se corrigen hablando.
   - Arregla las leyes 1 y 8.
   - Se verifica con Vitest de `notaManosLibres` y las e2e de escucha.
3. **«Repite» vuelve a leer.**
   - Antes: «repite», «¿qué?» u «otra vez» cuentan como otra cosa, y Fructus dice «Para guardar, di confirmo». Después: vuelve a leer la venta entera y escucha de nuevo, hasta 2 veces.
   - Nunca guarda: solo vuelve a leer.
   - Arregla las leyes 9 y 1.
   - Se verifica con Vitest de `clasificarRespuesta` y de las fases, y una e2e.

**Lo que sobra (ley 8):** al preguntar si pagó, la línea de la voz repite la pregunta del título y del botón. Basta «Te escucho: di «pagó» o «lo debe»». El botón «Primero: ¿pagó o lo debe?» salió de una prueba ciega del 2026-10-29: no lo toco sin otra prueba.

**Lo que nadie pidió y más importa:** probarlo con el audífono Bluetooth en el S25. Es lo que dirá si Android tarda en abrir el micrófono después de leer y se come el principio del «confirmo». Sin eso, el 8.5 es de pantalla, no del puesto.

**Lista aparte (sin ejecutar):**
- El «dijo» de las dudas lo escribe el intérprete: va en el prompt, con su `/voz-precision`.
- Marcar en la tarjeta el dato que tiene la duda (por ejemplo, «10 cajas» con un borde), no solo una línea gris abajo.
- El recuadro de la deuda bajo el pie fijo a 360 px.

## Después (con OK, los 3 cambios)

1. **La duda se dice:** «Tengo una duda: no sé si dijo 10 o 12 cajas. Revisa la tarjeta y toca Confirmar.» (`dudaHablada`, también en abono y compra).
2. **Escuchando en la venta:** «Te escucho: di «confirmo» o lo que hay que cambiar.» (`notaManosLibres` con `corrige`). En las demás tarjetas sigue «o toca Confirmar».
3. **«Repite», «¿qué?», «otra vez», «no te escuché»:** vuelve a leer lo mismo, entero, hasta 2 veces, y escucha de nuevo (`clasificarRespuesta`, `/api/voz/respuesta`). Nunca guarda.

**Medido después:** sin cambios en controles, contraste (14.6:1), desborde ni pulgar. La línea nueva ocupa dos renglones a 360 px, sobre Confirmar (`despues-escuchando-*.png`).

**Verificado:**
- Vitest: 850 en verde.
- `voz-confirmar-hablando`, `voz-candados`, `voz-operaciones-hablando` y `voz-lectura`: 42 en verde a 412 y 360 px, con una e2e nueva de «repite».

**2.ª prueba ciega (1 agente, solo la captura de después):**
- **Corregir:** de «probaría, pero nada lo dice» a «entiendo que puedo corregir hablando: «no, son 8 cajas»».
- **No oí:** diría «repite» o «¿cómo?», que ahora funciona. Si dice otra cosa, se repregunta sin guardar.
- **La duda:** la entendió solo con el audífono, sin mirar.
- **Donde más dudó:** «toca Confirmar» con las manos llenas cuando hay una duda. Es el candado 4 del ADR-0020: con dudas no se confirma hablando.

| Ley | Antes | Después |
|---|---|---|
| 1 · Sin manual | 7 | 8 |
| 3 · Simplicidad profunda | 8 | 9 |
| 6 · Lo difícil, a un toque | 7 | 8 |
| 9 · De punta a punta | 8 | 9 |
| **Total** | **8.5** | **8.8** |

**Siguiente, con OK (cambia un candado de dinero, ADR-0020):** con una duda, escuchar una corrección («son 12») en vez de pedir solo el toque. La venta corregida se lee entera y se confirma con «confirmo», sin dudas. Hoy, con una duda, hay que soltar las cajas.
