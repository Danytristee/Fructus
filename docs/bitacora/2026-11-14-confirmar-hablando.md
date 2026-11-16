# 2026-11-14 · Confirmar la venta hablando (ADR-0020)

«Hola Fructus» queda en pausa: la app podría cambiar de nombre y con él la frase. Esta obra sigue con lo que no depende del nombre,
en la rama `claude/confirmar-hablando`. La rama `claude/hola-fructus-viabilidad` queda subida, sin PR, hasta que haya nombre.

## Actividad 1 · Callarse envía

- **Qué cambió:** escuchando sin el dedo, el orbe envía solo cuando la persona habló y calló 1.2 s (`lib/voz/silencio-reglas.ts`,
  `useGrabadora`). Mientras se mantiene, manda el dedo. ADR-0018, actualización del 2026-11-14.
- **Cómo se verificó:**
  - Vitest: 12 de la regla del silencio y 16 del gesto.
  - `voz-silencio.spec.ts`, con un micrófono que la prueba prende y apaga: envía al callarse, no envía con una pausa de 0.7 s ni sin
    hablar, y no envía mientras se mantiene. Con `voz.spec.ts`, 30 en verde a 412 y 360 px.
- **Pendiente:**
  - Sin probar con el audífono ni con el ruido del puesto: los 1.2 s, los 0.4 s de voz mínima y los 12 dB sobre el fondo.
  - Si corta a alguien que piensa el precio, sube a 1.5 s. El costo es esperar un poco más en cada venta.

## Actividad 2 · La venta se lee en voz alta

- **Qué cambió:**
  - Interruptor «Manos libres» en el menú, por celular, apagado de fábrica y solo para quien registra (`components/marco/ManosLibres.tsx`). La perilla pasó a ser una pieza: `components/ui/Interruptor.tsx`, también en «Aviso del día».
  - Con el interruptor prendido, la venta lista se lee al abrir la tarjeta (`lib/voz/lectura-reglas.ts`), con «Te la estoy leyendo…» sobre Confirmar.
  - Tocar la tarjeta calla la lectura. Lo incompleto no se lee.
- **Cómo se verificó:**
  - Vitest: 10 de la lectura.
  - `voz-lectura.spec.ts`, 6 pruebas con un sintetizador de prueba. Con `voz.spec.ts` y `voz-venta.spec.ts`, 54 en verde a 412 y 360 px.
  - Capturas a 412 y 360 px.
- **Pendiente:**
  - Sin oír en un celular real: la voz de Chrome en Android, cómo dice «45 con 50» y los nombres largos («calibre 113»).
  - `push-menu.spec.ts:214` falla si corre junto con `:100`: las dos usan la cuenta del dueño y la misma fila de suscripción. Sola pasa. Ya pasaba antes de este cambio.
  - Este worktree no tenía las claves del aviso: se generaron claves locales en `.env.development.local` (fuera de git).

## Actividad 3 · Decir «confirmo» guarda la venta

- **Qué cambió:**
  - Con manos libres, al terminar de leer se abre el micrófono por 5 s (`lib/voz/manos-libres-reglas.ts`, `components/voz/useManosLibres.ts`).
  - `POST /api/voz/respuesta` transcribe la respuesta, y solo «confirmo», «correcto» o «acepto», sin nada más, guardan (`lib/voz/respuesta-reglas.ts`). Guardan por la misma acción que el toque, y dice «Guardado» cuando la base respondió.
  - Si oye otra cosa, pregunta una vez más. Si calla, si el servidor falla o si se toca la tarjeta, queda para tocar.
  - Migración `20261116173134_confirmado_por`: el comando guarda si se confirmó con un toque o por voz. Un check impide un descartado «confirmado por voz».
  - **Arreglo de raíz en `silencio-reglas.ts`:** quien respondía apenas se abría el micrófono no contaba, porque el primer cuadro (ya con voz) quedaba como fondo. Ahora lo oído se vuelve a mirar en cada cuadro contra el fondo de ahora.
- **Cómo se verificó:**
  - Vitest: 15 del silencio, 10 de manos libres y 22 de la respuesta.
  - pgTAP 18, 17 y 05 en verde.
  - e2e: `voz-confirmar-hablando.spec.ts` (5) y toda la voz, 70 en verde a 412 y 360 px.
  - En la base: 3 ventas de prueba con `confirmado_por = 'voz'` y las demás `'toque'`. `scripts/invariantes.sql`: las 12 en orden.
  - Capturas de «Te escucho» a 412 y 360 px.
- **Pendiente:**
  - La migración se aplicó al proyecto el 2026-11-16 (ver «Cierre»).
  - La base local la comparte otra sesión con migraciones que esta rama no tiene: esta se aplicó con psql, sin anotarla en el historial. Tras un `db reset` hay que volver a aplicarla.
  - pgTAP 01, 03, 04 y 11 fallan en la base compartida porque el catálogo real deja inactivo el producto 1; ya pasaba antes.
  - Sin probar con el audífono: qué tarda Android en abrir el micrófono Bluetooth después de leer, y si se come el principio del «confirmo».
  - `components/voz/TarjetaVenta.tsx` ya pasa las 250 líneas; la actividad 6 saca lo común a todas las tarjetas.

## Actividad 4 · Los candados

- **Qué cambió:**
  - Al abrir la tarjeta, Fructus dice un guion (`guionVenta`, `lib/voz/lectura-reglas.ts`):
    - si solo falta saber si pagó, lee la venta y pregunta «¿Pagó o lo debe?»; la respuesta (`clasificarPago`) se anota en la píldora y se lee la venta completa para confirmarla;
    - con dudas del intérprete, o si falta otro dato, solo lo dice y no escucha: se confirma con el dedo.
  - Sin señal no se abre el micrófono y la tarjeta lo dice.
  - Ya estaban: «sí» suelto no confirma, el precio sugerido se lee «sugerido» y el silencio deja la tarjeta para tocar.
- **Cómo se verificó:**
  - Vitest: 239 de `lib/voz`, con 16 de las fases y 13 del pago.
  - `voz-candados.spec.ts` (4) y toda la voz, 78 en verde a 412 y 360 px. `voz-lectura.spec.ts` repetida 4 veces: 48 de 48.
- **Pendiente:**
  - `voz-lectura.spec.ts` tocaba el orbe antes de que el micrófono grabara y fallaba 1 de cada 24 con la máquina cargada. Ya espera «escuchando».
  - Una vez falló `voz-silencio.spec.ts:59` a 360 px: el toque de 60 ms no quedó bloqueado. Repetida, pasa. Si vuelve, mirar si con carga el toque llega como «mantener» (`lib/voz/gesto-reglas.ts`, 300 ms).

## Actividad 5 · Corregir hablando

- **Qué cambió:**
  - Si a «¿Confirmo?» la persona corrige («no, son ocho cajas»), `/api/voz/respuesta` llama al intérprete con la venta tal como se leyó y lo que dijo (`mensajeCorreccion`, `docs/interprete-voz.md` 2c). La venta corregida vuelve como tarjeta nueva, se ve, se vuelve a leer y se confirma.
  - El prompt de sistema no cambió.
  - Al guardar queda `corregido`, porque se compara con lo dictado.
- **Cómo se verificó:**
  - Vitest: 253 de `lib/voz`.
  - `/voz-precision`: 8 de 8 correcciones con `openai/gpt-oss-120b` (`docs/voz/precision-2026-11-16-2.md`).
  - `voz-respuesta-api.spec.ts` con Whisper y el intérprete reales, sobre audios sintéticos.
  - Toda la voz: 87 e2e en verde a 412 y 360 px.
- **Pendiente:**
  - **El acierto de datos clave del intérprete quedó en 87.1 %** (meta 90 %), por casos que no son de esta obra: los 3 que ya fallaban el 2026-10-31 y 6 del catálogo real que se sumaron después (`docs/voz/precision-2026-11-16-2.md`). Se corrige en el prompt de sistema, con su `/voz-precision` antes y después.
  - `components/voz/TarjetaVenta.tsx` tiene 301 líneas: la actividad 6 saca lo de manos libres a una pieza común.
  - Este worktree ya tiene `GROQ_API_KEY` en `.env.local`, fuera de git. Gemini sigue sin clave, así que no hay respaldo.

## Actividad 6 · Abono, merma, gasto y compra hablando

- **Qué cambió:**
  - Las cuatro tarjetas leen y se confirman hablando, con los mismos candados (`lib/voz/guion-reglas.ts`).
  - La compra pregunta «¿La pagaste o la debes?» si no se dijo. Corregir hablando sigue siendo solo de la venta: en las demás, una corrección cuenta como «otra cosa» y se repregunta.
  - Las tarjetas «a mano» no leen.
  - `registrar_compra` y `marcarComando` guardan `confirmado_por`; la migración `20261116173134` creció con eso.
  - «Guardado» y la línea de estado pasaron a piezas comunes (`useManosLibres`, `NotaVoz.tsx`).
- **Cómo se verificó:**
  - Vitest: 261 de `lib/voz`.
  - pgTAP 18 (10 pruebas, con la compra), 17 y 05 en verde.
  - `voz-operaciones-hablando.spec.ts`: 8 en verde a 412 y 360 px, con `confirmado_por = 'voz'` en la base.
  - Toda la voz y lo «a mano»: 136 en verde y 7 fallan por la base compartida. El Mango Kent del seed está inactivo con el catálogo real: `voz-merma` (4), `voz-consulta` piña (2) y `voz-api` (1). Ya pasaba antes, ver la bitácora del 2026-11-12.
- **Pendiente:**
  - `components/voz/TarjetaVenta.tsx` sigue en 286 líneas. Lo que más pesa es el editor de cliente y de ítem: partir ahí, no en la voz.

## Cierre · La migración en el proyecto

- **Antes de aplicar, se trajo `main`.** Había entrado `como_llego_la_fruta`, que cambió `registrar_compra`.
  - Si se aplicaba la versión que tenía esta rama, se borraba en el proyecto lo de «cómo llegó la fruta».
  - Se comparó la huella (md5) de cada función en el proyecto con la de los archivos, y la migración se rehízo sobre la versión vigente con una sola línea de más.
- **Aplicada al proyecto con OK, como `20261116173134_confirmado_por`.** En el proyecto, `registrar_venta` y `registrar_compra` guardan `confirmado_por` y la compra conserva `estado_llegada`.
  - Avisos de seguridad y de rendimiento: ninguno nuevo; son los que CLAUDE.md deja a propósito, más los de la obra de frescura.
- **En la base local** se volvió a aplicar con psql sobre la versión vigente: antes había pisado ahí el `registrar_compra` de «cómo llegó la fruta».
  - pgTAP 20 (esta; antes 18, chocaba con `18_temperatura_diaria`), 19, 17 y 05 en verde.

## Cierre · /formidable y /chaos

- **/formidable:** de 8.5 a 8.8, con dos pruebas ciegas (`docs/formidable/manos-libres-2026-11-16.md`). Los tres cambios:
  - la duda se dice en voz alta;
  - escuchando en la venta, la línea dice «di «confirmo» o lo que hay que cambiar»;
  - «repite» vuelve a leer.
- **/chaos:** resistieron 9 de 11, con la semilla 2026111601 (`docs/chaos/manos-libres-2026-11-16.md`). Los dos hallazgos quedaron arreglados con OK:
  1. **Al corregir, «45 con 50» salía 50 y a veces se perdía el cliente.** Ahora el celular manda la venta en datos (`ventaActual`) y el mensaje dice las dos reglas. `/voz-precision`: antes 9 de 12; después, las 17 respondidas, bien.
  2. **Una cuenta podía confirmar el dictado de otra y dejar el comando «pendiente».** Ahora `registrar_venta` y `registrar_compra` lo rechazan, salvo el dueño o el administrador. Migración `20261116182112`, aplicada al proyecto, con pgTAP 21.
- **La base local** se restauró al volcado de antes de los ataques. El N6 repetido se hizo en transacciones que se deshicieron.
- **Pendiente:**
  - **El cupo gratuito de Groq se acabó hoy** con `/voz-precision`: corrió dos veces seguidas y la segunda dio 429. Para la demo, medir con calma o tener la clave de Gemini como respaldo.
  - `voz-respuesta-api.spec.ts` (Groq real) quedó sin correr después del cambio a la venta en datos.
  - Abonos, mermas y gastos marcan el comando desde la acción del servidor: tienen el mismo patrón que el hallazgo 2 y queda para revisar.
  - Ver si el dictado normal entiende «45 con 50»: toca el prompt de sistema.
