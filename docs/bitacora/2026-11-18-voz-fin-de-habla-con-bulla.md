# 2026-11-18 · Con bulla, el orbe sí se da cuenta de que dejaste de hablar (ADR-0018 y ADR-0029)

- **Qué cambió:** el orbe sin el dedo, que con bulla no enviaba nunca, ahora cuenta como voz solo lo que suena cerca de la voz de quien
  dicta (hasta 10 dB por debajo de lo que sostiene en el último segundo y medio), no todo lo que pasa sobre el fondo
  (`lib/voz/silencio-reglas.ts`). Vale para el toque, para las respuestas de manos libres y para lo dictado tras «Hola Fructus».
- **La causa:** el fondo bajaba a los huecos entre grito y grito, y los vecinos quedaban 12 dB por encima: contaban como voz y volvían
  a cero la cuenta del silencio (`silencio-reglas.ts:57`, antes del cambio).
- **Cómo se verificó:** audios de prueba en `tests/bulla/` (voces del Mac; `scripts/voz/bulla/generar.sh`), mezclados con vecinos,
  golpes y calle (`tests/bulla/mezcla.ts`). Antes: 0 de 30 casos con vecinos enviaban. Ahora, con vecinos 20 dB por debajo, envía a
  1.1 s; 15 dB por debajo, en hasta 4 s; en 234 casos (gritos de 8 a 20 dB incluidos) nunca corta antes de la última palabra. Vitest
  `silencio-reglas`, `silencio-reglas.bulla` y `escucha-reglas` en verde (35); las 4 pruebas de bulla fallan con el código anterior.
  e2e de voz con el micrófono simulado: `voz-silencio`, `voz-confirmar-hablando` y `voz-hola-fructus` 26 de 26 a 412 px; `voz-candados`,
  `voz-falta-hablada`, `voz-pago-hablado`, `voz-operaciones-hablando`, `voz-falta-abono-compra`, `voz-conteo`, `voz-aviso-stock` y
  `voz-silencio` 54 de 54 a 412 y 360 px.
- **Silero VAD, medido sobre los mismos audios** (v6.2, `silero_vad_16k_op15.onnx`, 1.3 MB, MIT): resuelve el ruido parejo fuerte
  (calle a 5 dB) y baja la demora con ruido (p90 de 3.4 s a 1.6 s), pero con vecinos a 10 dB o menos sigue sin enviar: sus voces
  también son voz. Cuesta 3.7 MB la primera vez (ONNX Runtime 2.4 MB + modelo) y 1.5 ms por cada 32 ms de audio en Node.
- **El tope de 15 s** (decidido el 2026-11-18, con Silero): con vecinos casi tan fuertes como quien dicta, nada que solo escuche los
  separa, así que a los 15 s de empezar a hablar se envía igual (`TOPE_HABLANDO_MS`), no a los 55. Vitest: 4 casos del tope y, sobre la
  bulla de verdad, todos los casos con vecinos a 10 y 5 dB terminan a más tardar en el tope. e2e `voz-silencio` «si la bulla nunca deja
  callarse» a 412 y 360 px: envía a los ~15 s y no corta una venta de 12 s.
- **Silero al grabar con el toque y en manos libres (ADR-0029):** un worker (`components/voz/oido.worker.ts`) corre Silero sobre el
  micrófono a 16 kHz. Un cuadro es la voz de quien dicta si Silero dice 0.5 o más y suena cerca de su voz. Mientras el modelo baja, o si
  falla, decide el volumen; cuando llega, vuelve a oír desde el principio (`lib/voz/fin-de-habla.ts`). Vitest: la pieza con un Silero
  de mentira (7) y el modelo de verdad sobre `tests/bulla/` (4): con la calle 5 dB por debajo de la voz termina entre 0.3 y 2 s después
  de callarse (con el volumen solo, nunca). e2e: el micrófono simulado ahora habla con una voz de verdad, y una prueba nueva con un
  «motor» tan fuerte como la voz solo pasa si Silero corre en el navegador (`voz-silencio`, 10 de 10 a 412 y 360 px).
- **Lo que encontraron las pruebas y se arregló:**
  - El worker importaba ONNX Runtime de entrada, y hasta que bajaba no había ni volumen: el primer dictado de una e2e tardó 1.8 min.
    Ahora ONNX Runtime se importa al cargar Silero, y el volumen oye desde el primer cuadro.
  - En el Chrome de prueba, el primer contexto de audio de la página trabó el hilo de la pantalla entre 0.7 y 1 s, con la máquina en
    carga 40. El toque de la prueba llegaba como «mantener y soltar» y enviaba un audio vacío («No alcancé a oírte»). El micrófono
    simulado ahora crea su contexto al cargar la página. El oído nuevo traba el hilo menos de 50 ms.
- **Pendiente:**
  - Medir en el S25 cuánto traba el primer contexto de audio al tocar (INP) y cuánta CPU gasta Silero mientras se graba.
  - `voz-silencio.spec.ts:39` falla a 360 px cuando es la primera prueba con el servidor recién arrancado (el toque se pierde mientras
    compila) y pasa al repetirla: no es del cambio, que no toca el gesto.
  - Medir con audio real del puesto (`tests/interprete/audios/LEEME.md`): las voces del Mac son más limpias que la bulla de verdad.
  - Probar en el S25 con y sin audífono.
