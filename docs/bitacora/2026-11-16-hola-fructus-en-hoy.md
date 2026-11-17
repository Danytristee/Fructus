# 2026-11-16 · «Hola Fructus» en «Hoy» (actividades 5b a 5e)

El nombre quedó: la app sigue siendo Fructus y la frase, «Hola Fructus». Se retoma la parte 2 sobre la rama
`claude/hola-fructus-viabilidad` (4 y 5a, traída a esta rama con un merge). La 5d del plan del 14-11 («terminar al callarse» con
Silero) ya existía desde el PR #39 (`lib/voz/silencio-reglas.ts`, por volumen): en su lugar va la verificación en dos pasos contra
«hola, frutas», que es lo que pedía mantener la frase.

## Actividad 5b · El detector en TypeScript, igual al de Python

- **Qué cambió:**
  - `lib/voz/detector-palabra.ts`: la cadena de openWakeWord 0.6.0 (espectrograma → rasgos → frase) para onnxruntime-web, con los
    modelos pasados de afuera.
  - `lib/voz/palabra-reglas.ts`: umbral 0.9, 3 cuadros seguidos y 2 s de espera, la regla con que se midió el modelo.
  - `public/voz/`: los dos modelos de rasgos de openWakeWord, sin cambios.
  - `scripts/voz/palabra-activacion/referencia.py` y `tests/palabra/`: los audios (con la voz que el modelo no oyó) y los puntajes
    de Python.
- **Cómo se verificó:** `detector-palabra.paridad.test.ts` con ONNX Runtime real. Los rasgos difieren de los de Python en 0.00006
  como mucho (valores de -40 a 40) y los puntajes, en 0.000005. Despierta una vez con «Hola Fructus» y ninguna con una venta ni con
  «Hola, ¿hay frutas?».
- **Un cambio a propósito:** el historial de rasgos empieza con los del silencio, no con ruido al azar, para que los dos lados empiecen
  igual.

## Actividad 5c · «Hola Fructus» en «Hoy»

- **Qué cambió:**
  - Interruptor «Hola Fructus» en el menú, debajo de «Manos libres», por celular y apagado de fábrica (`components/marco/HolaFructus.tsx`).
  - Con el interruptor prendido, «Hoy» abre el micrófono, carga el detector en un worker (`components/voz/escucha.worker.ts`) y le pasa
    el audio por un AudioWorklet (`public/voz/captura-worklet.js`), sin pasar por la pantalla. Una oreja en el orbe dice que escucha.
  - Al oír la frase suena un «tin», vibra y el orbe queda escuchando sin el dedo («Enviar», «Borrar»). Lo dicho se envía al callarse
    como WAV, con los 2 s de antes (la frase entera) y la marca `despertar`.
  - Se pausa con la tarjeta abierta, mientras entiende y mientras se graba con el dedo. Suelta el micrófono con la pantalla oculta
    (`lib/voz/escucha-reglas.ts`).
  - Si después de la frase no dice nada en 5 s, no envía y lo dice.
- **Dos bordes que aparecieron al probar, arreglados de raíz:**
  - El final de «…tus» cae después de despertar. Contaba como voz, y decir la frase y esperar 1.2 s enviaba la frase sola. Los
    primeros 500 ms después de despertar se graban, pero no cuentan.
  - En el worker, `terminar` esperaba a vaciar la cola y el `pausar` que la pantalla manda enseguida borraba el dictado. Ahora cierra en
    el acto.
- **Cómo se verificó:**
  - Vitest de las reglas (escucha, gesto y WAV).
  - `voz-hola-fructus.spec.ts` a 412 y 360 px, 14 en verde, con la escucha de verdad en Chrome (worker, onnxruntime-web y modelos) y un
    micrófono falso que dice los audios de `tests/palabra/`:
    - la venta dicha de corrido llega a la tarjeta sin un toque;
    - con manos libres llega hasta «Guardado», con la venta en la base y `confirmado_por = voz`;
    - «Hola, ¿hay frutas?» no despierta;
    - el silencio después de la frase no envía;
    - «Borrar» tira lo grabado;
    - con la tarjeta abierta no escucha;
    - el interruptor del menú la prende, y al apagarla suelta el micrófono.
  - Capturas en `docs/formidable/capturas/hola-fructus-2026-11-16/`.
  - Regresión, con el interruptor apagado (lo de siempre):
    - Vitest completo: 944 en verde.
    - E2e de voz, menú y «Hoy»: 92 de 102 en verde. Las 10 restantes fallaron por el entorno:
      - 2 por correr dos Playwright a la vez (se borran las trazas); solas pasan.
      - 8 por la píldora de Next (ver «Pendiente»); con la píldora oculta pasan las 8.
- **Pendiente:**
  - **Sin probar en un teléfono real:** el audio a 16 kHz en Chrome de Android, si hace falta un toque para que arranque (se reanuda con
    el primero, `components/voz/useHolaFructus.ts`), el «tin» con audífono Bluetooth y la batería.
  - El panel del navegador de Claude bloquea el micrófono: la escucha solo se pudo probar con Playwright.
  - `components/voz/VozHoy.tsx`, efecto de montaje: el aviso de `react-hooks/exhaustive-deps` por `cerrarDescarte` ya estaba en main.
  - `components/voz/VozHoy.tsx` pasó de 397 a unas 450 líneas. Ya pasaba las ~250 de CLAUDE.md antes de esta obra: pide partirse (los
    avisos por un lado, el gesto y la grabación por otro).
  - **El indicador de desarrollo de Next tapa la barra de abajo en las e2e.** Desde hoy, Next 16.4.3 muestra «1 Insight» (aviso de
    seguridad: pide actualizar Next). Esa píldora intercepta toques sobre «Clientes» (`marco.spec.ts:26`, `voz.spec.ts:276`), y su botón
    «Open issues overlay» calza con `getByRole("button", { name: "Verla" })` («o**verla**y»: `voz-venta.spec.ts:194` y `:211`). No es de
    esta rama: pasa en cualquier rama hasta actualizar Next.

## Actividad 5d · El segundo paso contra «hola, frutas»

- **Medición previa con Groq real** (whisper-large-v3-turbo, audios de `tests/palabra/`):
  - «Hola Fructus, vendí diez cajas…» dicho de corrido sale bien escrito con cualquier vocabulario.
  - La frase sola sale «Hola, Fro, Bus.» o «Hola, frío, bus…», incluso con «Hola Fructus» en el vocabulario.
  - «Hola, ¿hay frutas?» sale siempre «Hola, hay frutas.».
  - El intérprete real entiende igual la venta con «Hola, Fro, Bus.» delante.
- **Qué cambió:**
  - `revisarFrase` (`lib/voz/palabra-reglas.ts`) decide así:
    - si Whisper escribió «Fructus» (o a una letra), se quita y se interpreta lo que sigue;
    - si al principio se oyó «fruta(s)» o «fruto(s)» sin «Fructus» antes, es una frase parecida;
    - si no, se interpreta todo como vino.
  - `/api/voz` con `despertar=1`: una frase parecida responde `{ ignorado: "parecida" }`, sin intérprete ni fila en `comandos_voz`
    (serían conversaciones del puesto). La frase sola responde `{ ignorado: "sin_orden" }`. Con un toque nunca se descarta.
  - En «Hoy», «parecida» vuelve a escuchar sin aviso, y «sin_orden» dice «No te oí después de "Hola Fructus"».
  - La marca `despertar` sobrevive al «Reintentar» (`lib/voz/audio-pendiente.ts`) y a la cola sin conexión (`lib/cola/enviar.ts`).
- **Decisión** (no pasaba el test de pregunta: es técnica y se deshace en minutos):
  - No se exige que Whisper escriba «Fructus»: eso tiraría órdenes reales cada vez que escriba mal la marca. Se descarta solo lo que
    el detector confunde.
  - El vocabulario de Whisper no cambia: agregarle la frase no ayudó, y empujaría a escribir «Fructus» donde se dijo «frutas».
- **Cómo se verificó:**
  - Vitest de la regla: 12, con las transcripciones reales.
  - `voz-api.spec.ts` contra Groq real, 2 pruebas nuevas:
    - la venta después de la frase vuelve como tarjeta, y `comandos_voz` guarda todo lo dicho;
    - «Hola, ¿hay frutas?» vuelve `ignorado` y no deja nada en la base.
  - `voz-hola-fructus.spec.ts`: 22 en verde a 412 y 360 px, con el descarte, el reintento y la cola sin señal.
  - `cola-sin-conexion.spec.ts` y `voz.spec.ts` en verde, salvo `voz.spec.ts:276` (la píldora de Next).
- **Pendiente:**
  - Con voces reales y el audífono, medir cuántas veces Whisper escribe bien la marca. Si casi siempre, la regla podría exigirla.
  - `voz-api.spec.ts:15` sigue fallando como en el PR #39: Whisper oye «mango kent a» como «mango Quenta». No es de esta rama.

## Actividad 5e · Cierre

- **Mediciones** (con el build de producción, `pnpm build:local`):
  - `medir:js`: «Hoy» baja **157.7 KB** brotli, con tope de 180. Ninguno de sus 13 scripts trae ONNX Runtime: va en su propio
    chunk. Turbopack publica el `.wasm` con hash en `/_next/static/media/`, sin copiarlo a mano.
  - `medir:escucha` (nuevo, `scripts/medir-escucha.mjs`): «Hoy» en reposo, en esta computadora, gasta **15.2 % de un núcleo con la
    escucha apagada y 26.4 % prendida**. Escuchar cuesta 11 %. En el build de producción el worker carga los modelos y el `.wasm`.
- **Documentos:** ADR-0022 (la palabra de activación entra a la demo), actualización del ADR-0002 y CLAUDE.md (Stack, «La voz»,
  alcance, calidad y «Antes de producción»).
- **El build se detuvo una vez:** Next 16.4.3 frena `next build` para avisar de una vulnerabilidad conocida y sigue al reintentar. Se
  deja como decisión aparte: actualizar Next toca toda la app.
- **Pendiente:**
  - Medir `medir:escucha` (o el uso de CPU de Chrome) en el S25 y en un Android de gama media. En una computadora, 11 % puede ser
    varias veces más en un gama media. Si pesa, cuantizar el modelo de rasgos.
  - Actualizar Next.js por el aviso de seguridad. También quita la píldora que rompe 4 e2e en desarrollo.
- **/formidable** (`docs/formidable/hola-fructus-2026-11-16.md`), de 7.6 a 8.1 con los 3 cambios aprobados:
  - «Te escucho. Lo envío cuando te calles» sin reloj;
  - «Escucho "Hola Fructus"» con palabras sobre el orbe;
  - cada interruptor dice qué toque quita, y sugiere prender «Manos libres».

  En la segunda prueba ciega: «lo manda solito», «lo verde dice "Escucho"».
- **/chaos** (`docs/chaos/hola-fructus-2026-11-16.md`, semilla 2026111603): 6 de 9 resistieron. Arreglados con OK y su regresión:
  - la pantalla oculta a mitad de lo dictado ahora lo descarta;
  - con el detector caído se suelta el micrófono.

  Queda el 1, que es regla de dinero y espera decisión: **dos celulares escuchando guardan dos veces la misma venta**.
