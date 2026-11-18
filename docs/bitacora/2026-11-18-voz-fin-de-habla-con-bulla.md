# 2026-11-18 · Con bulla, el orbe sí se da cuenta de que dejaste de hablar (ADR-0018, actualización)

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
- **Pendiente:**
  - Con vecinos casi tan fuertes como quien dicta, nada que solo escuche los separa: hace falta un tope (hoy 55 s) o el audífono.
  - Medir con audio real del puesto (`tests/interprete/audios/LEEME.md`): las voces del Mac son más limpias que la bulla de verdad.
  - Probar en el S25 con y sin audífono.
