# ADR-0029 — Silero sabe cuándo dejaste de hablar, y a los 15 s se envía igual

**Fecha:** 2026-11-18 · **Estado:** aceptado

## Contexto

Con bulla, el orbe sin el dedo no enviaba nunca: el detector solo medía el volumen y contaba como voz al vecino que pregona y a la jaba
que cae. La actualización del 2026-11-18 del ADR-0018 lo arregló a medias: cuenta solo lo que suena cerca de la voz de quien dicta.
Así termina con vecinos 15 dB o más por debajo, pero no con un ruido parejo casi tan fuerte como la voz (un motor, la calle) ni con
vecinos casi tan fuertes como quien dicta.

Se midió Silero VAD sobre los mismos audios (`tests/bulla/`, voces del Mac con vecinos, golpes y calle):

| | Solo volumen | Con Silero |
|---|---|---|
| Calle 5 dB por debajo de la voz | nunca termina | termina (0.3 a 2 s después de callarse) |
| Demora con ruido (p90) | 3.4 s | 1.6 s |
| Vecinos 10 dB o menos por debajo | a veces nunca | a veces nunca |

Silero no separa la voz de quien dicta de la de un vecino igual de fuerte: las dos son voz. Nada que solo escuche las separa. Quien
dirige el proyecto eligió el 2026-11-18 sumar las dos cosas: Silero y un tope.

## Decisión

1. **Silero VAD v6.2, el modelo de 16 kHz** (`public/voz/silero_vad_16k_op15.onnx`, 1.3 MB, MIT; `docs/terceros/README.md`), corre en
   el celular con onnxruntime-web, que ya estaba por «Hola Fructus» (ADR-0022). No envía audio a nadie y no cuesta nada.
2. **Corre en un worker** (`components/voz/oido.worker.ts`), creado la primera vez que se graba y vivo para las siguientes.
   - El micrófono pasa a 16 kHz por el mismo AudioWorklet de «Hola Fructus» y va directo al worker, sin pasar por la pantalla.
   - La grabación que se sube (MediaRecorder, webm/opus) no cambia.
   - ONNX Runtime se importa dentro del worker al cargar: el worker arranca liviano y oye desde el primer cuadro.
   - «Hoy» no carga nada de esto al abrir (ADR-0006).
3. **Un cuadro (50 ms) es la voz de quien dicta si Silero dice 0.5 o más y suena hasta 10 dB por debajo de esa voz.** La voz de quien
   dicta es el volumen al que se habla en más de la mitad del último segundo y medio, contando solo lo que Silero oye como voz
   (`lib/voz/silencio-reglas.ts`). Se calló a los 1.2 s sin su voz, como antes.
4. **El volumen sigue de respaldo** (`lib/voz/fin-de-habla.ts`):
   - decide mientras Silero baja;
   - cuando Silero llega, vuelve a oír desde el principio con él, y lo dicho mientras bajaba cuenta igual;
   - decide también si Silero no carga o se cae.
   Si el worker no se puede abrir, se mide en la pantalla como antes (`components/voz/oido.ts`). Nunca se queda sin oído.
5. **A los 15 s de empezar a hablar se envía igual** (`TOPE_HABLANDO_MS`), aunque no «se calle». Cubre lo que nada que escuche
   resuelve: el vecino tan fuerte como quien dicta. La venta más larga de los casos del intérprete se dice en unos 9 s. Un dictado de
   más de 15 s se corta, y lo que faltó se corrige en la tarjeta.
6. **Vale para las tres formas de dictar:** el toque (y el candado), las respuestas de manos libres (que usan la misma grabadora) y lo
   que sigue a «Hola Fructus».

## Consecuencias

- **La primera vez que se toca el orbe, el celular baja unos 3.7 MB** (ONNX Runtime unos 2.4 MB comprimido, más el modelo 1.3 MB).
  Después quedan en el caché: el modelo se revalida con un 304 y ONNX Runtime vive en `_next/static`, que no cambia de nombre sin
  cambiar de contenido. Mientras baja, decide el volumen.
- **Mientras se graba, el celular corre Silero cada 32 ms.** En Node tarda entre 0.25 y 1.5 ms por ventana, según la carga de la
  máquina. Falta medirlo en el S25 y en uno de gama media.
- **Las e2e hablan con una voz de verdad.** El micrófono simulado (`tests/e2e/manos-libres.ts`) reproduce en bucle un dictado de
  `tests/bulla/`, porque Silero no toma un tono por voz. Además tiene un «motor»: ruido tan fuerte como la voz, que solo deja enviar
  si Silero corre de verdad (`voz-silencio.spec.ts`).
- **En el Chrome de prueba, el primer contexto de audio de una página traba el hilo de la pantalla hasta un segundo** con la máquina
  ocupada. El micrófono simulado lo crea al cargar la página. Si no, el toque de la prueba (60 ms) llegaba como «mantener y soltar». En
  el teléfono el toque lo mide la pantalla y no pasa. Abrir el oído (el contexto a 16 kHz y su worklet) traba el hilo menos de 50 ms.
- **Sin probar en el puesto ni en el S25.** Antes de producción: grabaciones reales con bulla (`tests/interprete/audios/LEEME.md`)
  para afinar el umbral (0.5), el margen (10 dB) y el tope (15 s).
