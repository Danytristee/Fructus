# ADR-0020 — Confirmar la venta hablando, con candados

**Fecha:** 2026-11-14 · **Estado:** aceptado. Se construye después de «Hola Fructus» (actividades 5a a 5e); hasta entonces rige el
toque.

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
