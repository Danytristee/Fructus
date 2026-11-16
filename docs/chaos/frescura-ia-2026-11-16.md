# /chaos · «Sigue buena» y la estimación de la noche · 2026-11-16

- **Pantalla:** la hoja «¿por qué?» de una llegada que ya pasó su último día bueno, con el botón «Sigue buena»
  (`components/inventario/SigueBuena.tsx`, `anotarSigueBuena` en `app/(app)/acciones-frescura.ts` → `revisiones_frescura`). De paso,
  lo que guarda la estimación de cada noche (`vida_util_estimada`), por la API.
- **Rama:** `claude/frescura-ia`. **Semilla:** 20261116.
- **Base:** solo la local propia de este worktree (`127.0.0.1:56421`). Respaldo de datos antes de empezar; invariantes limpias antes y
  después. Las 10 frutas de prueba quedaron inactivas; sus revisiones se quedan (no se borra nada).
- **Conteo:** 10 ataques, cada uno con su fruta. Primera pasada: 9 resistieron y 1 fue hallazgo, más 2 observaciones. Con los arreglos,
  los mismos 10 ataques: **10 resisten.**
- **Sin probar:** en un teléfono real (todo fue con el navegador emulando 412 × 915 y 800 × 360).

**Núcleo:** doble toque; red cortada al tocar; dos cuentas a la vez. La frase de voz ambigua y el monto con coma no aplican: esta hoja
no tiene voz ni montos.
**Sorteados con la semilla:** respuesta perdida; señal lenta; sesión vencida; pantalla vieja (ya no hay cajas); celular echado;
recargar después de anotar; permisos y entradas hostiles por la API.

## Hallazgo

### 1 · Dato malo en silencio: se podía anotar la revisión de una llegada que no existe (gravedad 2) — arreglado

**Repetir:** con la sesión de una cuenta que registra, escribir en `revisiones_frescura` sin pasar por la app, con un día de llegada
en el que no entró nada de esa fruta.

**Evidencia:** la fila quedaba guardada (`ayudanteLlegadaQueNoExiste: ok`). La app nunca la habría creado (mira el inventario antes de
anotar), y Stock no la mostraba; pero la estimación de la noche la habría contado como evidencia de que esa fruta dura más.

**Causa:** la comprobación vivía solo en la acción del servidor. La app es comodidad; la base es la regla.

**Arreglo:** un trigger en la base (`revision_de_una_llegada_que_existe`): la revisión tiene que ser de un día en que entraron cajas
de esa fruta, y que llegaron así. Prueba primero: `22_revisiones_frescura.test.sql`, tres casos que estaban en rojo. Mismo ataque,
misma semilla: `23514`, ninguna fila. La tabla nunca llegó al proyecto sin el trigger: va en la misma migración.

## Observaciones (arregladas)

- **Cinco toques en el mismo instante mandaban cinco pedidos.** La base dejaba una sola fila, pero cada pedido leía el inventario
  entero. Ahora sale uno (`llamadasAlServidor: 5 → 1`).
- **La frase con la sesión vencida** decía «registra que sigue buena otra vez». Ahora: «Tu sesión terminó. Vuelve a entrar y anótalo
  otra vez.»

## Resistieron

| Ataque | Qué pasó |
|---|---|
| Doble toque (5 en el mismo instante) | 1 fila; la hoja pasa a «Sigue buena» y el botón desaparece. |
| Red cortada al tocar | «No se pudo guardar. Revisa tu señal e inténtalo otra vez.» 0 filas. Al reintentar, 1 fila. |
| Respuesta perdida (la base guardó, la respuesta no llegó) | Dice que no se pudo guardar; al tocar otra vez la acción ve que ya está anotada y la hoja cambia. 1 fila. |
| Señal lenta (6 s) | Velo «Anotando…» sobre la pantalla: no se puede tocar otra vez. 1 pedido, 1 fila. |
| Dueño y ayudante a la vez | 1 fila (del primero que llegó); los dos ven «Sigue buena». |
| Sesión vencida | Lo dice y no guarda. 0 filas. |
| Pantalla vieja (otro ya registró la merma de todas las cajas) | «Esa llegada ya no está por revisar. Mira Stock otra vez.» 0 filas. |
| Celular echado (800 × 360) | Se llega al botón, se anota. Sin desborde. |
| Recargar después de anotar | Sigue «Sigue buena», sin botón. 1 fila. |
| Por la API | El contador y quien no tiene sesión no anotan (`42501`); nadie anota con fecha de mañana, a nombre de otro, con una llegada futura, una fruta que no existe o un estado inventado; nadie borra; ni el dueño escribe una estimación; sin sesión no se lee nada. |

**Concurrencia del cron** (dos pasadas la misma noche): la segunda contesta `sin-novedad` y no duplica (`tests/e2e/vida-estimada.spec.ts`);
la base lo impide igual con «una por fruta y por día».

**Caída del modelo:** sin clave, con error 500 o con un rechazo, el cron contesta, el aviso de la noche sale y Stock sigue con lo que
tenía (`lib/vida-estimada/estimar-del-dia.test.ts` y la prueba e2e «si el modelo falla»).
