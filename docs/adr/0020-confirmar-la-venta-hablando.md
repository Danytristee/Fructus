# ADR-0020 — Confirmar la venta hablando, con candados

**Fecha:** 2026-11-14 · **Estado:** aceptado y construido el 2026-11-16, en la rama `claude/confirmar-hablando`. Al principio iba
después de «Hola Fructus», pero esa obra se pausó mientras se decidía el nombre y esta no depende de la frase: se adelantó. Con un
toque se dicta y todo lo demás va hablando; «Hola Fructus» quitará ese toque.

## Contexto

El principio 1 dice: «Nada se guarda sin un toque de confirmación». Ese toque es la red de seguridad del dinero, porque la voz puede
entender mal un número, un cliente o si pagó.

El dueño atiende con una caja en cada mano. Con «Hola Fructus» (ADR-0018 y siguientes) y un audífono con micrófono que suprime el
ruido, todo puede ser manos libres salvo ese toque. Quien dirige el proyecto pidió que la venta pase solo hablando: el sistema lee
el pedido y el dueño dice «correcto» o «confirmo».

## Opciones

- **A. Confirmar hablando, con candados.** Es la elegida.
- **B. Leer en voz alta y confirmar con un toque.** El principio no cambia, pero sigue habiendo un toque por venta.

## Decisión

El principio 1 pasa a ser: **la voz propone y la persona confirma, con un toque o diciendo «confirmo» o «correcto» después de oír la
lectura.** Confirmar hablando solo vale con estos candados:

1. **Se lee lo que se va a guardar, no la transcripción.** «Diez cajas de mango kent a don Lucho, a cuarenta y cinco, cuatrocientos
   cincuenta soles, lo debe. ¿Confirmo?». Es la misma tarjeta, dicha en voz alta.
2. **Solo confirman palabras exclusivas:** «confirmo», «correcto» o «acepto». Un «sí» suelto no confirma: en el puesto se dice todo
   el tiempo.
3. **Solo en una ventana corta,** de unos 5 s después de terminar la lectura. Mientras Fructus habla, no escucha: así no se oye a sí
   mismo.
4. **Nunca con dudas.**
   - Si falta decir si pagó o si lo debe, se pregunta por voz antes de leer, y la respuesta se repite en la lectura.
   - Si el cliente o la fruta tienen varias opciones parecidas, o si el intérprete dejó dudas, se pide el toque, como hoy.
   - Un precio sugerido se lee como «sugerido» y confirmarlo es aceptarlo.
5. **Cualquier otra respuesta no guarda.** «No, son ocho cajas» corrige y se vuelve a leer. El silencio deja la tarjeta abierta
   para tocar.
6. **Al guardar se dice «Guardado»,** con vibración y sonido. El éxito solo se anuncia cuando la base respondió: nada optimista en
   dinero.
7. **Queda registrado cómo se confirmó** (toque o voz) en el comando de voz, para auditar y medir los errores.

## Consecuencias

- **Se acepta un riesgo nuevo:** que alguien cerca diga «correcto», por ejemplo el cliente que oye su pedido. Con un audífono que
  suprime el ruido baja mucho, pero existe. Una venta mal confirmada se anula a mano, y eso solo lo hace el dueño o el
  administrador (`anular_venta`).
- **Cada venta tarda 1 o 2 s más** mientras se lee.
- **Al construirlo:**
  - una migración para registrar cómo se confirmó, con su prueba pgTAP;
  - el reconocimiento de la respuesta corta, que se decide al construir: Whisper en el servidor o un modelo de palabras en el
    celular;
  - pruebas e2e de cada candado;
  - `/chaos` con un «correcto» dicho por otra persona y con ruido.
- **CLAUDE.md:** el principio 1 y «La voz» se reescriben cuando la función exista, no antes.
- **El audífono:** debe tener voz en banda ancha (HD Voice o mSBC, 16 kHz). Las grabaciones de «Hola Fructus» se hacen con ese mismo
  audífono, y hay que probar en el S25 que Chrome use su micrófono.

## Cómo quedó (2026-11-16)

- **La respuesta corta la reconoce Whisper en el servidor:** `POST /api/voz/respuesta` y `lib/voz/respuesta-reglas.ts`. Ya estaba en
  el flujo y no suma modelos al celular. Pagas cerca de 1 s más por venta, y sin señal se confirma tocando.
- **El celular deja de escuchar al callarse.** Lo mide por el volumen sobre el fondo (`lib/voz/silencio-reglas.ts`): 0.8 s en una
  respuesta y 1.2 s en un dictado. Lo dicho apenas se abre el micrófono también cuenta.
- **Corregir hablando:** el intérprete recibe la venta tal como se leyó y lo que se respondió (`mensajeCorreccion`), sin cambiar el
  prompt de sistema. Solo en la venta.
- **También abono, merma, gasto y compra.** La compra pregunta «¿La pagaste o la debes?».
- **Las fases** (leer, abrir el micrófono, escuchar, entender, anotar, guardar, callado) son una regla pura,
  `lib/voz/manos-libres-reglas.ts`. La ejecuta `components/voz/useManosLibres.ts`.
- **Sin probar todavía:** con el audífono Bluetooth en el S25, y con el ruido real del puesto.

## Después de responder o corregir, solo lo nuevo (2026-11-17)

La venta se lee entera una vez, al abrir la tarjeta. Leerla otra vez entera después de cada respuesta hacía esperar toda la lectura por
una palabra, y en el puesto eso es mucho tiempo. Ahora:

- **Tras «¿Pagó o lo debe?»** se repite solo la respuesta, con el comprobante si se pidió: «Lo debe. ¿Confirmo?» (`relecturaPago`; en
  la compra, `relecturaPagoCompra`). Así se cumple el candado 4: la respuesta se repite en la lectura.
- **Tras una corrección** (candado 5) se dice solo lo que cambió: «Corregido. 8 cajas de Mango Kent, a 45 la caja. Total, 360 soles.
  ¿Confirmo?» (`guionCorreccion`).
  - El total se dice siempre que cambie una fruta, la rebaja o el total: es el dinero que se va a confirmar.
  - Si cambió cuántas frutas hay, se dicen todas. Si no cambió nada que se pueda nombrar, se lee la venta entera.
- **«Repite» lee la venta entera:** quien lo pide es porque se perdió algo.
- **Lo que no cambia:** la lectura completa al abrir la tarjeta, que solo confirmen «confirmo», «correcto» o «acepto», y que con dudas
  o si falta un dato se confirme con el dedo.
- **Lo que se paga:** quien no oyó bien la primera lectura ya no la vuelve a oír completa. Tiene que decir «repite» o mirar la tarjeta.
