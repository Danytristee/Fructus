# /chaos · Hoja «Registrar abono» a mano (A8) · 2026-11-05

**Rama:** `claude/cuaderno-stock-ventas`. **Semilla:** 20261105. **Base:** local, con respaldo antes y `db reset` al terminar.
**Invariantes:** las 12 en orden antes, después de cada ataque que escribió y al final.

**Plan.** Núcleo: cinco toques en el mismo tick, red cortada y red lenta (que pasa el tope de 15 s) al confirmar, monto con coma y
otros montos hostiles, y dueño y ayudante abonando al mismo cliente a la vez. La voz ambigua no aplica: a mano no hay voz (la
tarjeta es la misma que la del abono por voz, que ya pasó `/chaos` el 31-10). Sorteo con la semilla: cliente borrado a media
hoja, cerrar la hoja mientras guarda, buscador con 5000 letras y emojis y girar la
pantalla con la hoja abierta. Dirigido, fuera del sorteo y por lectura del código: sesión vencida al confirmar.

**Conteo:** 11 ataques (el de montos con 20 entradas); 6 resistieron, 5 hallazgos. **Uno de ellos es de permisos y se informó por
chat, no se escribe aquí.** Los 4 de este archivo son de gravedad 4 o menor: **ninguno dejó la base en un estado imposible**.
**Después de los arreglos (mismos ataques, misma semilla):** 10 resisten; queda el de la pantalla girada, que va a A11.

## Hallazgos

### 1 · Gravedad 4 · Sesión vencida: la hoja promete algo que no es verdad

- **Pasos:** abrir la hoja desde una ficha → escribir un monto → que la sesión venza (se borran las cookies) → Confirmar.
- **Evidencia:** «Tu sesión terminó. Vuelve a entrar: el abono te espera en «Hoy».» y el botón «Entrar otra vez». Abonos
  guardados: 0.
- **Por qué importa:** en la voz es cierto (lo dictado queda en la pestaña). A mano no queda nada esperando en «Hoy»: la persona
  vuelve a entrar buscando un abono que no está y no sabe que tiene que registrarlo de nuevo.
- **Causa:** `sinSesion()` en `lib/voz/accion-servidor.ts` usa una sola frase para los dos caminos.
- **Arreglo propuesto:** la hoja a mano le dice a `confirmarAbono` que es a mano (`aMano`), y la frase pasa a «Tu sesión terminó.
  Vuelve a entrar y registra el abono otra vez.». La voz conserva la suya. No toca dinero.

### 2 · Gravedad 4 · Cliente borrado: dice «revisa tu señal» cuando el problema es otro

- **Pasos:** abrir la hoja de un cliente → que ese cliente deje de existir → Confirmar.
- **Evidencia:** «No se pudo guardar. Revisa tu señal e inténtalo otra vez.», 0 abonos, la hoja sigue abierta.
- **Por qué importa:** es seguro, pero manda a la persona a buscar un problema de señal que no existe, y reintentar nunca va a servir.
- **Causa:** `confirmarAbono` convierte todo error de la base, salvo el choque por comando, en `SIN_SENAL`; la llave foránea rota
  (23503) cae ahí. Pasa igual con el abono por voz.
- **Arreglo propuesto:** 23503 → «Ese cliente ya no está en tu cuaderno. Elige a otro.». No toca dinero.

### 3 · Gravedad 4 · Con la pantalla girada, «Confirmar» queda fuera de la vista

- **Pasos:** abrir la hoja en vertical (412 × 915) → girar el celular (915 × 412).
- **Evidencia:** la hoja mide 387 px de alto y «Confirmar abono» no se ve sin deslizar; con scroll sí se alcanza.
- **Causa:** a partir de 768 px de ancho el pie de la hoja deja de estar pegado abajo (`md:static` en `PieConfirmar`), pensado para
  escritorio, y un celular de lado también lo activa.
- **Arreglo propuesto:** fijar la orientación vertical en el manifest de la PWA (ya es parte de A11). Mientras tanto no se toca la
  pieza compartida.

### 4 · Gravedad 2 (menor) · «4s/0» se lee como 40

- **Pasos:** en «¿Cuánto te dio?» escribir `4s/0`.
- **Evidencia:** «Listo» se habilita y el monto queda en S/ 40.00. La tarjeta lo muestra antes de Confirmar, así que no se guarda
  nada sin que la persona lo vea.
- **Causa:** `leerMonto` (`lib/voz/monto-reglas.ts`) quita «S/» **en cualquier parte** del texto, no solo al principio. Va contra
  lo que dice su cabecera («nunca adivina»). Lo comparten todas las tarjetas.
- **Arreglo propuesto:** quitar «S/» solo si está al principio, con su prueba de Vitest. No cambia ningún monto válido.

## Resistieron

| Ataque | Resultado |
|---|---|
| 5 clics en el mismo instante sobre «Confirmar abono» | 1 abono, la deuda baja 40 |
| Red cortada al confirmar (el pedido nunca llega) y reintento | 0 abonos mientras tanto; el reintento guarda 1 |
| Red lenta: la respuesta llega a los 17 s y la persona toca Confirmar otra vez | 1 abono; «La señal no respondió y no sé si se guardó. Toca Confirmar otra vez: no se va a repetir.» |
| Dueño y ayudante abonan al mismo cliente a la vez (30 y 20) | 2 abonos, comandos distintos, la deuda baja 50 |
| Cerrar mientras guarda (Escape y tocar el velo) | la hoja no se cierra; 1 abono; el comando no queda «descartado» |
| Buscador con 5000 letras, emojis, comilla con SQL y comodines | sin error; después de todo eso, «Rosa» sigue apareciendo |
| «1,299.50», «1,299», «1.299», «10.123», «-5», «0», «00», «1234567890», «100000.01», «abc», «4e1», dígitos árabes, emoji, `<script>`, 5000 letras | «Escribe el monto así: 45 o 47.50.» (o el motivo exacto), «Listo» bloqueado |
| «100000», «40,5», «S/ 40», « 40 » | aceptados a propósito; «100000» avisa lo que queda a favor (decisión del 31-10) |

## Notas

- Abrir la hoja deja un comando «a mano» pendiente si la persona se va sin tocar Descartar (13 tras esta corrida). Es inofensivo: el
  abono no lo mira y la precisión de la voz se mide sin ellos (`modelo_stt = 'manual'`).
- La semilla 20261105 repite el sorteo exacto. Los ataques son una prueba temporal de Playwright y no se commitea; los arreglos que
  se aprueben llevan su prueba de regresión.

## Arreglado con OK (5-11)

Cada arreglo llegó con su prueba escrita primero, que falló antes de tocar el código.

| Hallazgo | Arreglo | Prueba |
|---|---|---|
| 1 · Sesión vencida promete «te espera en «Hoy»» | La hoja a mano le pasa `aMano` a `confirmarAbono`; la frase pasa a «Tu sesión terminó. Vuelve a entrar y registra el abono otra vez.» (`sinSesionAMano`). La voz conserva la suya. | Vitest de la frase y e2e «con la sesión vencida, a mano no promete…» |
| 2 · Cliente borrado dice «revisa tu señal» | El error 23503 de la base responde «Ese cliente ya no está en tu cuaderno. Elige a otro.» (también en el abono por voz). | e2e «si el cliente ya no existe, lo dice…» |
| 4 · «4s/0» se leía como 40 | `leerMonto` quita «S/» solo al principio. «1 299» sigue siendo 1299 y «S/ 40» sigue valiendo. | 13 casos de Vitest en `lib/voz/monto-reglas.test.ts` (el archivo no tenía prueba) |
| 3 · Pantalla girada | Sin cambio: se resuelve en A11 con `orientation: "portrait"` en el manifest. | — |

**Repetidos con la misma semilla:** el sorteo (cliente borrado, cerrar mientras guarda, buscador hostil, pantalla
girada) y el núcleo. Resisten todos menos la pantalla girada. «4s/0» ya no está entre los montos aceptados. Invariantes: las 12 en orden
después de cada ataque que escribió. Las 62 pruebas e2e de las tarjetas de voz, que comparten `leerMonto`, `confirmarAbono` y el pie de
la hoja, siguen en verde.
