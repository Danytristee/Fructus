# ADR-0027 — En manos libres, la voz pregunta lo que falta en la venta

**Fecha:** 2026-11-17 · **Estado:** aceptado y construido en la rama `claude/voice-complete-missing-fields-c4082a`. Cambia el
candado 4 de ADR-0020 en lo que toca a los datos que faltan; las dudas del intérprete siguen igual.

## Contexto

Con manos libres (ADR-0020), si a la venta le faltaba algo que no fuera «si pagó», Fructus decía «Falta elegir a cuánto la caja.
Míralo en la tarjeta» y se callaba. El dueño tenía que soltar las cajas para tocar el precio o el cliente, que es justo lo que manos
libres quiere evitar. Quien dirige el proyecto pidió: si algo falta en la ficha, que la voz diga qué falta, lo pregunte, escuche la
respuesta y complete la ficha.

Pasa más de lo que parece: un precio sin historial (fruta nueva o cliente nuevo), «mango» cuando hay Kent y Edward, «don Lucho»
cuando hay dos Luis, o «lo debe» sin decir quién.

## Decisión

Fructus pregunta por voz los cuatro datos que se pueden responder hablando, **en este orden**: la fruta (de ella sale el precio
sugerido), las cajas, el precio y a quién se le fía. Si pagó o lo debe sigue con su propia pregunta, al final.

1. **Al abrir la tarjeta dice todo lo que falta y pregunta lo primero:** «Falta el precio y si pagó. ¿A cuánto la caja de Mango
   Kent?». Con varias opciones parecidas, las lee: «Las 10 cajas de mango, ¿cuál es? ¿Mango Kent o Mango Edward?». Si se dijo un
   nombre y no se encontró nada parecido, lo dice: «No encontré a Pocho. ¿A quién se lo fiaste?».
2. **La respuesta completa la venta por el mismo camino que una corrección** (`POST /api/voz/respuesta` con `pregunta=falta`): el
   intérprete recibe la venta actual en datos, lo que respondió y **qué se le preguntó** (`falta`: el dato, la fruta y las opciones
   leídas). Sin eso, un «cuarenta» suelto no dice si es el precio o las cajas.
3. **Mientras falte algo, se dice «Anotado» y la pregunta siguiente.** Cuando ya está completa, se lee **entera** («Anotado. 10 cajas
   de Mango Kent, a 45 la caja, para Luis Paredes. Total, 450 soles. ¿Pagó o lo debe?»), porque nunca se leyó entera y el candado 1
   pide oír lo que se va a guardar antes de confirmar.
4. **Confirmar sigue igual:** solo «confirmo», «correcto» o «acepto» después de la lectura entera. Mientras falta un dato, «confirmo»
   no guarda nada: se repregunta.
5. **Si no se entiende** (otra cosa, o una respuesta que no cambió nada de la venta) se repregunta una vez: «No te entendí. ¿A cuánto
   la caja de Mango Kent?». La segunda vez se calla y la línea dice «No te entendí. Elígelo en la tarjeta». Sin señal o si el
   servidor no responde, lo mismo.
6. **No cambia:** con dudas del intérprete no se pregunta nada, se dice la duda y se toca. Lo que pagó al llevar, si no cuadra con el
   total, se elige en la tarjeta. Tocar la tarjeta calla la voz.

## Opciones que se descartaron

- **Preguntar todo de una vez** («¿A cuánto y para quién?»): la respuesta mezclada se entiende peor y, si falla, no se sabe qué parte.
- **Que el celular entienda la respuesta sin el intérprete** (un número es el precio, un nombre es el cliente): no sabe elegir entre
  «el Kent» y «la segunda», ni buscar al cliente en la base.

## Cómo se midió

Diez casos nuevos `falta-*` en `tests/interprete/casos.json` (precio en palabras, en cifras y con céntimos, la segunda fruta, la
opción por nombre y por orden, el cliente con y sin opciones, y una respuesta que no responde nada):

| | Claude Haiku 5.5 | gpt-oss-120b (Groq) |
|---|---|---|
| Con la pista de qué se preguntó | 10 de 10 (y las 17 correcciones de antes, 17 de 17) | 10 de 10 |
| Sin la pista | 8 de 10: «el Kent» salió como **cliente**, y «la segunda» quedó en duda | sin medir |

Sin inventos de dinero en ninguna corrida.

## Consecuencias

- **Una llamada al intérprete por dato que falta,** de 1 a 1.5 s cada una (p95 1.3 s con Claude). Una venta con tres datos faltantes
  tarda unos 5 s más que tocándolos, pero sin soltar las cajas.
- **Whisper recibe el vocabulario del puesto** (y las opciones leídas) al transcribir la respuesta, porque puede ser un nombre.
- **`pareceCorreccion` ahora cuenta las cifras:** «40» o «8» escritos por Whisper también van al intérprete. Antes se perdían.
- **Primero solo en la venta** (PR 52). El abono y la compra se sumaron después (ver abajo). La merma y el gasto todavía solo avisan
  lo que falta.
- **Sin probar todavía** en el S25 con audífono ni con el ruido real del puesto.

## El abono y la compra (2026-11-17, después)

Lo mismo, con sus palabras. El canal de corrección (`mensajeCorreccion`, `/api/voz/respuesta`) pasó a recibir la operación con su
nombre (`venta`, `abono` o `compra`, en los campos de su herramienta), así que el abono y la compra también se **corrigen hablando**
(«no, fueron trescientos», «no, fueron cuarenta cajas»).

- **Abono:** «Falta el cliente. ¿Quién te pagó? ¿Luis Paredes o Luis Pérez?», «¿Cuánto te dio Luis Paredes?».
- **Compra:** la fruta, las cajas, el costo y, si se debe, a quién: «Falta el costo y si la pagaste. ¿A cuánto te costó la caja de
  Mango Kent?», «La debes. ¿A quién se la compraste? ¿Agrícola Chao o Transportes Piura Norte?».
- **Después de responder o corregir se lee la operación entera,** con «Anotado.» o «Corregido.» delante: son cortas, y el abono y la
  compra no tenían una lectura «solo de lo que cambió» como la venta.
- **La compra guarda el medio con que se pagó** aunque se corrija: `registrar_compra` no lo trae, y un «con Plin» ya dicho no se pierde.
- **El mensaje de la venta sin pista no cambió** (comprobado palabra por palabra); con la pista, la regla del número ahora nombra el costo
  y el monto.
- **Medido:** 11 casos nuevos (`falta-abono-*`, `falta-compra-*`, `correccion-abono-*`, `correccion-compra-*`). Con los 38 de corrección
  y de «falta», Claude Haiku 5.5 acertó 38 de 38, sin inventos (p95 1.4 s). Groq se quedó sin cupo gratuito y solo alcanzó a medir uno
  de abono y compra (bien).
