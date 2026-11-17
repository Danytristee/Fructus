# ADR-0022 — «Hola Fructus» en el navegador: la palabra de activación entra a la demo

**Fecha:** 2026-11-16 · **Estado:** aceptado y construido (actividades 5b a 5d, rama `claude/hola-fructus-voice-commands-2e7437`).
Cambia lo que decía el ADR-0002: la palabra de activación ya no es de la fase 2.

## Contexto

El ADR-0002 dejó la palabra de activación para la fase 2: en un navegador, escuchar todo el tiempo gasta batería y se activa con el
ruido. El 2026-11-14 quien dirige el proyecto pidió que el sistema sea manos libres de punta a punta, con un audífono que suprime el
ruido. Lo construido hasta hoy:
- callarse envía (ADR-0018);
- la venta se lee y se confirma hablando (ADR-0020).

Quedaba un toque: el que empieza a dictar. El 2026-11-16 se confirmó que la app sigue llamándose Fructus y que la frase es
«Hola Fructus».

Antes de construir se armó la prueba de viabilidad (actividad 4, `scripts/voz/palabra-activacion/`). Como todavía no hay grabaciones
del puesto, se entrenó un modelo provisional (5a): 90 % de detección sin ruido y 1.04 falsas por hora con ruido. Su debilidad son
las frases con «fruta»: un 11 % lo despierta (`docs/voz/palabra-activacion-2026-11-14-provisional.md`).

## Opciones

- **A. openWakeWord en el celular**, con onnxruntime-web (MIT) en un Web Worker. Es la elegida.
- **B. El reconocimiento de voz del navegador escuchando todo el tiempo** (Web Speech API).
  - Manda todo lo que se habla en el puesto a los servidores de Google, todo el día.
  - Sin señal no funciona, y en Android se corta solo cada pocos segundos.
- **C. Un servicio de palabras de activación con licencia** (Porcupine, por ejemplo). Pide una cuenta y una clave, y su uso
  comercial es de pago: rompe el costo cero.

## Decisión

1. **El detector corre en el celular** (`lib/voz/detector-palabra.ts`, dentro de `components/voz/escucha.worker.ts`).
   - Es la cadena de openWakeWord 0.6.0 traducida a TypeScript, con sus dos modelos de rasgos sin cambios y `hola-fructus.onnx`.
   - Una prueba la compara cuadro por cuadro con Python: diferencia de 0.000005 en el puntaje.
   - El audio llega por un AudioWorklet a 16 kHz, directo al worker, sin pasar por la pantalla.
   - El audio sale del celular solo después de despertar.
2. **Un interruptor «Hola Fructus» por celular, apagado de fábrica,** en el menú junto a «Manos libres».
   - Escucha solo en «Hoy» y con la pantalla a la vista.
   - Se pausa con la tarjeta abierta, mientras entiende y mientras se graba con el dedo.
   - Con la pantalla oculta suelta el micrófono.
3. **Despierta con umbral 0.9 y 3 cuadros seguidos, y después espera 2 s.** Es la regla con que se midió el modelo
   (`lib/voz/palabra-reglas.ts`).
4. **Al despertar, suena un «tin», vibra y el orbe queda escuchando sin el dedo (ADR-0018).**
   - Lo dicho se envía al callarse como WAV de 16 kHz. Incluye los 2 s de antes, o sea la frase entera, y la marca `despertar`.
   - Los primeros 500 ms después de despertar se graban pero no cuentan: son el final de «…tus».
   - Sin voz en 5 s, se descarta.
5. **El servidor hace un segundo paso** (`revisarFrase`).
   - Si Whisper oyó «fruta(s)» o «fruto(s)» al principio, sin «Fructus» antes, se descarta. No pasa por el intérprete ni deja nada en
     `comandos_voz`, porque serían conversaciones del puesto.
   - No se exige que Whisper escriba «Fructus». Medido con Groq, la frase sola sale «Hola, Fro, Bus.», y exigirla tiraría órdenes
     reales. El intérprete entiende igual la orden con ese saludo delante.
6. **El vocabulario de Whisper no cambia.** Agregarle la frase no mejoró nada y lo empujaría a escribir «Fructus» donde se dijo
   «frutas».
7. **Dos celulares que oyeron la misma venta abren una sola tarjeta** (`tomar_frase`, migración `frases_tomadas`). La eligió quien dirige
   el proyecto el 2026-11-16, entre 3 opciones.
   - **El problema:** /chaos mostró que una venta dicha en voz alta despierta a todos los celulares que escuchan en el puesto. Con manos
     libres, un solo «confirmo» la guardaba dos veces.
   - **La regla:**
     - Antes de abrir la tarjeta, el servidor «toma» lo que se dijo después de la frase.
     - Si en los últimos 10 s otro celular ya tomó una frase casi igual (similitud de 0.6 o más), esta no abre tarjeta y el celular dice
       «Eso ya lo anotó otro celular».
     - Cada celular manda un número al azar que guarda para sí (`lib/voz/celular.ts`). El mismo celular sí puede repetir la frase.
     - Revisar y anotar va en una sola transacción, bajo un candado: dos envíos en el mismo instante no pasan los dos.
     - Se toma solo lo que el intérprete entendió: un «no te entendí» no bloquea repetirlo.
   - **Lo que se paga:**
     - Dos ventas casi iguales dichas en dos celulares en menos de 10 s se toman como una. La segunda persona ve el aviso y la repite.
     - `frases_tomadas` guarda lo dicho (lo mismo que `comandos_voz`), con RLS sin políticas: solo la toca la función, como
       `series_comprobante`.
   - Las opciones descartadas fueron que solo escuche un celular por cuenta (no cubre a un ayudante con su propia cuenta) y solo avisarlo.

## Consecuencias

- **Lo que pesa:**
  - La primera vez que se prende el interruptor se bajan unos 5 MB, y después quedan en el caché del celular:
    - onnxruntime-web: 2.4 MB del `.wasm` y 22 KB de JavaScript, comprimidos;
    - los tres modelos: 2.6 MB.
  - «Hoy» no paga nada de eso: sigue en 157.7 KB (`medir:js`).
- **Lo que consume:**
  - En una computadora (`pnpm medir:escucha`), escuchar cuesta 11 % de un núcleo: 15.2 % con la escucha apagada y 26.4 % prendida.
  - En un Android de gama media puede ser varias veces más. Se mide en el S25 y en un gama media antes de dejarlo prendido todo el día.
    Si pesa, se cuantiza el modelo de rasgos.
- **Lo que se ve:** mientras escucha, Android muestra su punto verde de micrófono. En «Hoy», una oreja en el orbe lo dice.
- **Lo que se sube:**
  - Cada dictado después de la frase va sin comprimir: unos 32 KB por segundo, de 150 a 200 KB por venta, contra 15 a 20 KB con
    un toque. A cambio, Whisper oye exactamente lo que oyó el detector, a la frecuencia a la que Whisper trabaja.
  - Una falsa alarma sube a Groq unos segundos de audio, que no se guardan.
- **Sin señal:** el detector funciona igual, y el dictado va a la cola (ADR-0019) con su marca. El servidor revisa la frase al
  llegar.
- **Sin probar todavía:**
  - en el S25, con el audífono Bluetooth y con el ruido del puesto;
  - si Chrome de Android necesita un toque para arrancar el audio (se reanuda con el primero);
  - la batería de un día entero.

  La prueba de viabilidad con grabaciones reales sigue pendiente (`scripts/voz/palabra-activacion/README.md`).
- **Licencias, antes de producción:**
  - El modelo provisional se entrenó con voces de Piper de licencias distintas y con AudioSet (audio de YouTube).
  - Los dos modelos de rasgos son los de openWakeWord, que publica sus modelos como CC BY-NC-SA 4.0. El de rasgos viene del
    `speech_embedding` de Google, que es Apache-2.0.
  - Para producción se confirman esas licencias y se reentrena con las grabaciones del puesto y negativos propios.
- **CLAUDE.md:** cambian «Stack», «La voz», «Alcance de la demo» y «Antes de producción».
