# /chaos · «Hola Fructus» en «Hoy» (2026-11-16)

**Rama:** `claude/hola-fructus-voice-commands-2e7437`. **Semilla:** 2026111603. **Ataques:** 9. **Resistieron:** 6. **Hallazgos:** 3. Los 3
quedaron arreglados con OK y su prueba (el 1 con la migración `20261117013141_frases_tomadas`, aplicada al proyecto con OK).

**Base:** local y compartida, así que no se hizo `db reset`.
- Antes: volcado de los datos de `public` y las 12 invariantes en orden.
- Después de atacar: invariantes en orden.
- Al final se restauró el volcado (truncar `public` y cargarlo con `supabase_admin`): 226 ventas y 209 comandos, como antes. Invariantes
  en orden.

**Cómo se atacó:** la escucha de verdad en Chrome (worker, onnxruntime-web y los modelos), con el micrófono falso que dice los audios de
`tests/palabra/` (`microfonoQueDice`). /api/voz simulado, salvo el ataque 4, que fue con Whisper y el intérprete reales.

## Hallazgos

### 1 · Dos celulares escuchando registran dos veces la misma venta (gravedad 1: estado imposible)

En el puesto puede haber dos celulares en «Hoy» con «Hola Fructus» prendido, por ejemplo el del dueño y el de un ayudante con la
cuenta del dueño. Una sola venta dicha despierta a los dos. Cada uno abre su tarjeta, y con manos libres los dos leen y escuchan.
Un solo «confirmo» guarda las dos.

- **Para repetirlo:** dos contextos del dueño con «Hola Fructus» y manos libres. Se le dice a los dos «Hola Fructus, vendí diez cajas
  de mango kent a don Lucho, lo debe», termina la lectura y se responde «confirmo» a los dos.
- **Evidencia:** `ventas` con los dos comandos: **2 filas de S/ 450**. Las invariantes no lo ven: cada venta es correcta sola.
- **Por qué pasa:** cada celular escucha y confirma lo suyo, y nada le dice al servidor que dos comandos son la misma frase. Antes de
  «Hola Fructus» había que tocar cada celular para abrir una tarjeta, así que no pasaba solo.
- **Es una regla de dinero:** la decidió quien dirige el proyecto el 2026-11-16, con la opción A: el servidor toma una sola vez la misma
  frase oída por dos celulares (ADR-0022, decisión 7).
- **Arreglado:**
  - Migración `frases_tomadas`: la tabla y la función `tomar_frase`, que revisa y anota bajo un candado. **Aplicada al proyecto con
    OK** (versión `20261117013141`).
  - `/api/voz` la llama antes de abrir la tarjeta.
  - Regresiones:
    - pgTAP `26_frases_tomadas.test.sql`, 11 pruebas;
    - `voz-api.spec.ts`, «dos celulares que oyeron la misma venta», contra Groq real: dos envíos a la vez abren 1 tarjeta, el otro
      responde `otro_celular`, y queda 1 comando.
  - El ataque de la semilla simulaba /api/voz en cada celular, así que no pasa por el arreglo. La misma situación contra el servidor
    real es la prueba de `voz-api.spec.ts`.

### 2 · Si la pantalla se oculta a mitad de lo dictado, el orbe queda «Te escucho…» sin grabar (gravedad 3)

- **Para repetirlo:** decir «Hola Fructus», ocultar la pantalla 4 s (otra app o el celular bloqueado) y volver.
- **Evidencia:** al volver, el orbe sigue «Te escucho… 0:13» y no se envía nada. Se queda así hasta los 55 s y termina con «No alcancé a
  oírte».
- **Por qué pasa:** con la pantalla oculta, el worker recibe «pausar» y tira el dictado. La pantalla no se entera y sigue mostrando que
  escucha.
- **Arreglado (con OK):** con un dictado de «Hola Fructus» abierto, ocultar la pantalla lo descarta, como al salir de «Hoy», y dice «Se
  apagó la pantalla: no se envió nada» (`useHolaFructus` avisa con `alOcultarse`). Regresión: `voz-hola-fructus.spec.ts`,
  «regresión /chaos 2». Falló antes del arreglo («escuchando») y pasa después, a 412 y 360 px.

### 3 · Si los modelos no bajan, el micrófono queda abierto sin escuchar (gravedad 4)

- **Para repetirlo:** prender «Hola Fructus» con `/voz/*.onnx` sin responder (sin señal la primera vez).
- **Evidencia:** sale el aviso «No pude escuchar "Hola Fructus"» y la oreja no aparece, pero queda **1 micrófono abierto**. Android
  mostraría su punto verde sin que nada escuche.
- **Arreglado (con OK):** con el detector caído, el micrófono no se abre, y si estaba abierto se suelta. Regresión:
  «regresión /chaos 3». Falló antes del arreglo (1 micrófono abierto) y pasa después (0).

## Resistieron

| Ataque | Lo que pasó |
|---|---|
| Doble toque en «Enviar» después de despertar | 1 envío, una tarjeta |
| Se corta la red a mitad de lo dictado | Va a la cola («Sin señal: guardé lo que dijiste»); al volver, 1 envío con `despertar=1` |
| «Hola Fructus, vendí…» dos veces seguidas, con Groq real | La transcripción trae la frase dos veces, pero el intérprete devuelve una venta de 10 cajas, no 20 |
| El interruptor prendido y apagado 5 veces seguidas | 5 workers creados y 5 cerrados; ningún micrófono abierto |
| Sin permiso de micrófono | Un aviso, «Necesito el micrófono…», una sola vez; sin oreja |
| La sesión vence justo al enviar | Aviso de sesión, y el audio queda guardado para reintentar, con su marca `despertar` |
