# /chaos · Reloj de ruedas de la hora de cierre y reloj del aviso · 2026-11-17

- **Pantalla:** la hoja «¿A qué hora cierras?» de Ajustes con dos ruedas (`components/ajustes/HoraDeCierre.tsx`, `components/ui/Rueda.tsx`).
  Detrás: `fijar_hora_cierre(p_hora, p_minuto)` y el reloj de la base (`llamar_al_aviso_del_dia`, `reclamar_resumen_del_dia`,
  `/api/cron/resumen-diario` con la ficha). Ver ADR-0024.
- **Rama:** `claude/configurable-closing-time-b772ab` (`a6d7165`). **Semilla:** 1118.
- **Base:** solo la local propia de esta copia (`fructus-hola`, `127.0.0.1:56721`).
  - Antes: volcado de datos e invariantes limpias.
  - Al terminar: comparada con el volcado, la base quedó idéntica, y las invariantes siguen limpias.
  - La regla de la dirección de `aviso_del_dia` se aflojó un momento para que `pg_net` llegara a esta máquina, y se volvió a poner igual.
- **Conteo:** 14 ataques; los 14 resistieron. Ningún hallazgo; 2 observaciones.
- **No aplica:** la «frase de voz ambigua» del núcleo, porque la hoja no tiene voz.

## Resistieron

| # | Ataque | Resultado |
|---|---|---|
| 1 | Minutos raros a la RPC como dueño: 37, 60, -5, 2.5, null | 400 (22023 «Los minutos van de 5 en 5», o 22P02). Nada escrito. |
| 2 | 7:55 a. m. | 400, 22023, «La hora de cierre va de las 8 a. m. a las 11:55 p. m.» |
| 3 | `"16"` y `"30"` como texto; 23:55 | Se aceptan: son horas válidas. |
| 4 | Con sesión de dueño: `reclamar_resumen_del_dia`, `llamar_al_aviso_del_dia`, `soltar_resumen_del_dia`, leer `aviso_del_dia` | 403 y 42501. Nadie con sesión toca el reloj ni ve la ficha. |
| 5 | Dos reclamos del día a la vez (uno retiene el candado 2 s) | El primero `reclamado`; el segundo espera y recibe `ya-avisado`. |
| 6 | Dos corridas del reloj encimadas | La segunda ve la llamada en curso: una sola ficha. |
| 7 | **El camino completo:** `pg_cron` → `pg_net` → la ruta con la ficha | 200: la ruta acepta la ficha, reclama el día y arma el resumen. La ficha queda gastada. |
| 8 | La misma ficha otra vez y una ficha vencida | 401 las dos. |
| 9 | **20 llamadas al cron a la vez**, con el secreto | 1 arma el aviso; 19 reciben `ya-avisado`. |
| 10 | Cinco toques a «Guardar» en el mismo instante | 1 pedido al servidor; la hoja se cierra. |
| 11 | Girar a 5 p. m. y cerrar la hoja sin guardar (Escape) | El renglón sigue en 7 p. m. y al reabrir la rueda está en 7. |
| 12 | Girar muy lejos hacia arriba y hacia abajo; Inicio y Fin con el teclado | Se detiene en 8 a. m. y en 11 p. m.; Fin da 55 e Inicio da 00. La frase siempre dice lo mismo que la rueda. |
| 13 | Sesión vencida al guardar | Dentro de la hoja: «No se cambió la hora · Tu sesión terminó…», con «Entrar otra vez». Nada escrito. |
| 14 | Red lenta (10 s) y después cortada | «Guardando…» tapa la hoja. Después, dentro de ella: «Revisa tu señal…». La rueda queda donde estaba para reintentar. Nada escrito. |
| — | 360 px con `prefers-reduced-motion` | Las ruedas quedan planas (sin animación de tambor), funcionan igual y no hay desborde. |

## Observaciones

- **Hacia dónde girar.** En la prueba a ciegas, la persona dudó si para pasar de 7 a 5 se desliza hacia arriba o hacia abajo (es hacia
  abajo, como en el reloj del iPhone). Dijo que probaría una vez y cambiaría de sentido, y la frase de abajo («Te llega todos los días a
  las…») se lo dice al instante. No se propone cambio (ley 8). Si en el puesto se ve que se equivocan, una pista corta sobre las ruedas.
- **En local el reloj no llega a la app** con `http://127.0.0.1`, porque dentro del contenedor esa dirección es el propio contenedor. En el
  proyecto la dirección es `https://…`, así que no afecta. Para probar el camino completo en local se usó `host.docker.internal`, con la
  regla aflojada un momento.
