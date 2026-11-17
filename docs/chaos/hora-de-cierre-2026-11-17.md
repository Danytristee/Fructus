# /chaos · Hoja «Hora de cierre» de Ajustes · 2026-11-17

- **Pantalla:** la hoja «¿A qué hora cierras?» de Ajustes (`components/ajustes/HoraDeCierre.tsx`, `app/(app)/ajustes/acciones.ts` → `fijar_hora_cierre`).
- **Rama:** `claude/configurable-closing-time-b772ab`. **Semilla:** 1117.
- **Base:** solo la local propia de esta copia (`fructus-hola`, `127.0.0.1:56721`).
  - Antes de atacar: volcado de datos e invariantes limpias.
  - Al terminar: se dejó `ajustes_puesto` como estaba; comparada con el volcado, la base quedó idéntica y las invariantes siguen limpias.
- **Conteo:** 10 ataques. Ningún dato malo ni estado imposible; 1 hallazgo de gravedad 4 y 1 observación.
- **La «frase de voz ambigua» del núcleo no aplica:** la hoja no tiene voz. El «monto con coma» se probó como «hora con coma» contra la RPC.

## Hallazgos

### 1 · Gravedad 4: cuando no se guarda, el aviso queda detrás de la hoja

**Repetir:**
1. Abrir la hoja.
2. Cortar la red de las acciones (parchar `window.fetch` para que rechace los pedidos con `Next-Action`) o borrar la cookie `sb-*` de la sesión.
3. Tocar «9 p. m.».

**Evidencia:**
- La hoja sigue abierta y «6 p. m.» sigue marcada.
- El aviso «No se cambió la hora · Revisa tu señal e inténtalo otra vez» sale debajo del renglón de Ajustes, **detrás del velo de la hoja**: atenuado, arriba y lejos de donde tocó la persona.
- Con la sesión vencida, el texto es «Tu sesión terminó. Vuelve a entrar y elige la hora otra vez.», pero no hay botón para entrar.
- La base no cambió (21 antes, 21 después).

**Causa:** `HoraDeCierre` pinta el `<Aviso>` fuera de la `<Hoja>`. Eso sirve para el éxito, porque la hoja se cierra, pero no para el error, porque la hoja queda abierta.

### Observación · Cinco toques en el mismo instante mandan cinco pedidos

**Repetir:** abrir la hoja y, en el mismo instante, tocar 5 veces «4 p. m.» (`for … click()`).

**Evidencia:** salen 5 acciones al servidor. La base queda en 16, la pantalla dice 4 p. m., y hay una sola fila. Guardar la misma hora 5 veces no daña nada, pero el código no frena el toque repetido: la guarda `nueva === hora` no corre hasta que el estado se actualiza. Con dos horas distintas en el mismo instante (5 y 6 p. m.), Next manda las acciones en orden y pantalla y base terminan iguales (18).

## Resistieron

| Ataque | Resultado |
|---|---|
| Horas raras a la RPC como dueño: `"15,5"`, `15.5`, `7`, `24`, `-1`, `0`, `32768`, `null`, `"abc"`, `1e1` | 400 con 22P02, 22003 o 22023. Nada escrito. (`"16"` como texto se acepta: es una hora válida.) |
| Ayudante y contador llaman a `fijar_hora_cierre` | 403, 42501, «Solo el dueño o el administrador…» |
| Sin sesión (`anon`) llama a la RPC o lee la tabla | 401 y 42501 |
| Dueño y ayudante hacen `PATCH` directo, y el dueño hace `POST` de una segunda fila | 42501 por falta de permiso en la tabla. Nada escrito. |
| Dueño y administrador la cambian a la vez (dos sesiones `psql`, una espera 3 s antes de confirmar) | La segunda espera a la primera y gana la última: 21, firmada por el administrador. Hora y firma coinciden. |
| Dos horas distintas en el mismo instante | Pantalla y base iguales (18). |
| Red lenta, 10 s | «Guardando…» tapa la hoja y el segundo toque no pasa. Al final pantalla y base iguales (21). |
| Sesión vencida al elegir | No se guarda nada y se dice (ver hallazgo 1, por dónde se dice). |

## Arreglo propuesto (espera OK)

- **Hallazgo 1:** si falla, el aviso va dentro de la hoja, debajo de las horas. Con la sesión vencida, el aviso lleva el botón «Entrar». Primero se escribe una e2e que corta la red y espera el aviso dentro del diálogo.
- **Observación:** guardar con una marca de «guardando» (`useRef`) para que los toques repetidos no salgan. No cambia ningún dato; es solo para no mandar pedidos de más.

## Después (mismo día)

La hoja se rediseñó como un reloj de ruedas (ADR-0024). Lo que entró de este informe:
- **Hallazgo 1:** el error se dice dentro de la hoja, y con la sesión vencida trae «Entrar otra vez». Lo cubre la e2e «si no se guarda (sin
  señal), se dice dentro de la hoja».
- **Observación:** un segundo toque en «Guardar» mientras la base contesta no manda otro pedido (`useRef`).

Sin volver a atacar con la semilla 1117: la hoja cambió entera. Queda pendiente un `/chaos` de la rueda.
