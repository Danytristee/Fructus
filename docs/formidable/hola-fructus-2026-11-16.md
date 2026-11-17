# /formidable · «Hola Fructus» en «Hoy» y su interruptor (2026-11-16)

**Rama:** `claude/hola-fructus-voice-commands-2e7437`. **Quién la usa:** el dueño, en el celular, con una caja en cada mano (ADR-0022).
**Escala:** 1 agente ciego. Las medidas, con Playwright: el panel del navegador de Claude bloquea el micrófono.

## 1 · Medido (412, 360 y 1280 px, con la escucha prendida)

- **Controles de menos de 48 px:** ninguno, en los tres anchos. La oreja mide 36 px pero no se toca: solo dice que escucha.
- **Desborde horizontal:** ninguno.
- **El orbe:** 104 px, abajo al centro. Arranca a 795 de 915 px y a 680 de 800 px.
- **Quien ya usó el orbe no ve la etiqueta** (opacidad 0). Lo único que dice «estoy escuchando» es la oreja lima en la esquina del orbe.
- **JavaScript de «Hoy»:** 157.7 KB brotli, con tope de 180. ONNX Runtime no entra en la primera carga.
- **CPU de escuchar** en una computadora: 11 % de un núcleo (`pnpm medir:escucha`).
- **Capturas:** `capturas/hola-fructus-2026-11-16/`. La píldora naranja «1 Insight» es de las herramientas de Next en desarrollo, no de la
  app.

## 2 · Prueba ciega (Observado)

Un agente sin contexto, como el dueño, con 4 capturas a 412 px.

- **Menú:** entiende «Hola Fructus» como «el Ok Google». Lo prende, y prende también «Manos libres» «por si acaso».
  - No sabe cuál de los dos es para vender sin tocar.
  - Teme que «te leo cada venta» diga las deudas delante de los caseros.
  - Le preocupa la batería, los datos y que oiga lo que habla con los clientes. Dice: «"Fructus" suena a "frutas", que aquí se grita a cada rato».
- **«Hoy», primera vez:** diría todo de corrido.
  - No sabe si esperar una respuesta después de «Hola Fructus».
  - Busca algo que diga «te escucho» y no lo encuentra.
  - La etiqueta le tapa cuánto le deben.
- **«Hoy», días después:** sin la etiqueta, piensa que se apagó.
  - La oreja le parece «el globito de WhatsApp de mensajes sin leer».
  - No sabe si es de «Hola Fructus» o de «Manos libres».
  - «Al sol, esa bolita es chiquita».
- **Después de despertar:** entiende que escucha («igualito al audio de WhatsApp con el candadito»).
  - Cree que tiene que tocar «Enviar», y con las cajas no puede.
  - No sabe que se envía solo al callarse, y teme que grabe también lo que dice el cliente.
  - No vio ni oyó el «tin» porque no miraba.
- **Lo que más lo confundió:** no sabe si de verdad puede vender sin tocar.

## 3 · Nota (0 a 10)

| | Nota | Por qué |
|---|---|---|
| Ley 1 · Sin manual | 6 | Funciona, pero no se sabe si escucha ni que se envía al callarse |
| Ley 2 · Una pregunta | 8 | |
| Ley 3 · Simplicidad | 7 | Dos interruptores para una sola idea («no tocar nada») |
| Ley 4 · Lenguaje | 8 | «Y lo que pasó» no dice que se envía solo |
| Ley 5 · Contenido primero | 7 | La etiqueta de la primera vez tapa «Te deben» |
| Ley 6 · Lo difícil a un toque | 8 | |
| Ley 7 · Perdonar | 9 | «Borrar», y una falsa alarma se descarta sin aviso |
| Ley 8 · Quitar | 7 | El reloj «0:00» no le sirve a quien no mira |
| Ley 9 · Punta a punta | 7 | Falla del detector, sin permiso y sin señal resueltos; la pantalla oculta deja el orbe trabado (/chaos 2) |
| Celular (C1 a C8) | 9 | Todo medido en verde. La oreja es chica al sol |
| Oficio visual | 8 | La oreja usa el lima del aro del orbe, sin moverse |
| **Total** | **7.6** | |

## 4 · Los 3 cambios de mayor impacto (esperan el OK)

1. **Decir que se envía solo** (ley 1).
   - **Antes:** después de despertar, «Te escucho… 0:03» y el orbe dice «Enviar».
   - **Después:** cuando despertó por la frase, la etiqueta dice «Te escucho. Lo envío cuando te calles» en vez del reloj, y el orbe sigue
     ofreciendo «Enviar» por si quiere apurarlo.
   - **Se verifica:** la e2e lee la etiqueta, y una segunda prueba ciega pregunta «¿y si te quedas callado?».
2. **Que se vea que escucha, también los días después** (leyes 1 y 9, C7).
   - **Antes:** solo la oreja de 36 px en la esquina.
   - **Después:** en reposo y escuchando, una etiqueta corta y fija junto al orbe, «Escucho "Hola Fructus"», con la oreja. Va al costado,
     no encima: no tapa «Te deben».
   - **Se verifica:** que no tape cifras a 412 y 360 px; «¿te está escuchando?» en la prueba ciega.
3. **Un solo camino para «no tocar nada»** (leyes 3 y 8).
   - **Antes:** dos interruptores sueltos.
   - **Después:** al prender «Hola Fructus», si «Manos libres» está apagado, la fila dice «Para no tocar nada, prende también Manos
     libres». La descripción de cada uno dice qué toque quita: «empiezo a escuchar cuando lo dices» y «te leo la venta y la confirmas
     hablando».
   - **Alternativa más simple:** un solo interruptor que prenda las dos cosas. Se pierde poder usar una sin la otra.
   - **Se verifica:** prueba ciega del menú.

**Lo que sobra (ley 8):** el reloj «0:00» cuando despertó por la frase. Lo reemplaza el cambio 1.

**Lo que nadie pidió y más importa:** dos celulares escuchando registran dos veces la misma venta (/chaos 1). Es regla de dinero: la
decide quien dirige el proyecto. Después le sigue la privacidad que teme el dueño. El menú podría decir «nada sale del celular hasta que
dices "Hola Fructus"».

**Aparte, sin ejecutar:**
- Con el sol, una oreja más grande o con borde.
- En escritorio, el orbe flota sobre «Lo último» (ya pasaba antes).

## 5 · Después, con el OK del 2026-11-16

**Lo aplicado:**
1. Después de despertar por la frase, la etiqueta dice «Te escucho. Lo envío cuando te calles», sin reloj. En dos líneas parejas,
   centradas y dentro de los márgenes: la fila no pasa del ancho de la pantalla menos 2 × 16 px, y «Borrar» no se encoge.
2. La bolita de la oreja pasó a ser una etiqueta lima con palabras, «Escucho "Hola Fructus"», sobre el borde de arriba del orbe. Al
   costado no cabía: ahí están los destinos de la barra. La etiqueta de ayuda sube 20 px para no pisarla, y la de la primera vez volvió a
   «Toca o mantén para hablar», porque la nueva ya dice la frase.
3. Cada interruptor dice qué toque quita:
   - «Manos libres»: «Te leo la venta y la confirmas hablando. Con audífono».
   - «Hola Fructus»: «Empiezo a escucharte cuando lo dices».
   - Con «Hola Fructus» prendido y «Manos libres» apagado, sale «Para no tocar nada: prende también Manos libres…», y se va al
     prenderlo.

**Medido** (412 y 360 px):
- La etiqueta mide 255 × 33 px, con letra de 17 px. No tapa ninguna cifra.
- 0 controles chicos y 0 desborde.
- La fila «Borrar» + etiqueta empieza a 16 px y termina a 16 px del borde.
- Capturas `despues-*`.

**Segunda prueba ciega** (Observado), mismas tareas:
- **Menú:** prende los dos porque el cuadro se lo dice, y entiende para qué es cada uno. Duda si «Con audífono» es obligatorio, y
  «y lo que pasó» lo lee dos veces. Seguridad 7/10.
- **«Hoy»:** «lo verde dice "Escucho"», o sea que está atento (antes: «no tengo cómo saberlo»). Sigue con la duda de si oye lo que habla
  con los clientes, y la etiqueta tapa parte de «Todo tu cuaderno», un texto sin cifras. Seguridad 6/10.
- **Después de despertar:** «lo manda solito, eso dice» (antes: «¿toco Enviar?»). Pregunta cuánto rato hay que callar y si manda la
  mitad cuando se traba. Seguridad 7/10.

**Nota:** 7.6 → **8.1**.
- Ley 1: 6 → 7.5.
- Ley 3: 7 → 7.5.
- Ley 8: 7 → 8, sin el reloj.
- Ley 9: 7 → 8.5, con /chaos 2 y 3 arreglados.
- Oficio: 8 → 8.5.

**Queda, sin ejecutar:**
- «Con audífono» → «Mejor con audífono».
- «y lo que pasó» → «y la venta».
- La duración del silencio dicha en algún lado («callas un segundo y lo envío»).
- La etiqueta tapa texto sin cifras de «Te deben».
- La privacidad: «nada sale del celular hasta que dices "Hola Fructus"».
