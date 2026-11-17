# ADR-0023 — La hora de cierre la elige el dueño, con un cron por cada hora posible

**Fecha:** 2026-11-17 · **Estado:** aceptado · **Cambia:** el punto 2 de ADR-0013 (la hora fija de las 7 p. m.)

## Contexto

El aviso del día salía siempre a las 7 p. m., escrito en `vercel.json` (`0 0 * * *`). Un puesto que cierra a las 3 p. m. recibía su resumen
cuatro horas tarde, cuando ya no le servía. Uno que cierra a las 9 p. m. lo recibía con el día a medias. Quien dirige el proyecto pidió que la
hora se pueda ajustar.

ADR-0013 daba por hecho que «Hobby limita el cron a una vez al día» y que otra hora pedía Vercel Pro o un cron externo. La documentación de
Vercel (revisada el 2026-11-17) dice otra cosa: en Hobby cada cron corre **una vez al día**, pero un proyecto puede tener **100 crons**, y
varios pueden llamar a la misma ruta.

## Decisión

1. **Una hora para todo el puesto, no una por teléfono.** Es la hora en que cierra el puesto, y el aviso dice cómo le fue al puesto. La
   eligen el dueño y el administrador en Ajustes. El ayudante y el contador la ven en la fila «Aviso del día» del menú.
2. **De 8 a. m. a 11 p. m. de Lima, en punto** (`HORAS_DE_CIERRE`, `lib/hora-cierre-reglas.ts`). Antes de las 8 el día recién empieza y el
   resumen saldría vacío. Después de medianoche ya sería el resumen de otro día. Nace con las 7 p. m., la hora que ya tenía.
3. **Un cron por cada hora posible:** 16 entradas en `vercel.json`, todas a `/api/cron/resumen-diario`, cada una una vez al día. El cron mira
   la hora de Lima del momento en que llegó y solo hace algo si es la hora guardada. Los demás contestan `{ motivo: "no-es-la-hora" }` sin
   tocar nada más. En Hobby el cron de una hora llega en cualquier minuto de esa hora: por eso basta comparar la hora, y en pantalla se
   sigue diciendo «como a las…». `lib/hora-cierre-reglas.test.ts` falla si `vercel.json` y la lista de horas se separan.
4. **La estimación de vida útil (ADR-0021) va en el mismo cron de la hora de cierre:** sigue corriendo una vez al día.
5. **En la base, `ajustes_puesto`: una sola fila** (la llave es `true`), con `hora_cierre` entre 8 y 23 y la firma de quien la cambió. La lee
   cualquiera con sesión activa y nadie la cambia con un update directo. Con RLS, un update sin permiso no falla, solo no toca filas, y el
   dueño creería haberla cambiado. La cambia `fijar_hora_cierre(p_hora)` (`security definer`): revisa el rol y rechaza con 42501.
6. **Si el cron no puede leer la hora, usa la de fábrica (7 p. m.):** mejor un aviso a esa hora que ninguno (principio 8). Con la base caída
   el resumen tampoco se puede leer, y eso ya sale en rojo.
7. **En Ajustes es un solo renglón arriba**, porque debajo de 58 frutas no la encontraba nadie. Al tocarlo sube una hoja con las 16 horas a
   la vista. Un toque guarda y cierra la hoja: no hay teclado ni botón «Guardar», porque el cambio se deshace con otro toque. Al guardar, dice
   si el aviso sale desde hoy o, si esa hora ya pasó, desde mañana.

## Alternativas descartadas

- **Una hora por teléfono** (en `suscripciones_push`): cada persona elegiría la suya. Pero el aviso dice cómo le fue al puesto y la hora es la
  del cierre del puesto. Si hiciera falta, se agrega después sin tocar los crons.
- **Un solo cron cada hora (`0 * * * *`):** Hobby no lo deja desplegar.
- **`pg_cron` + `pg_net` en Supabase llamando a la ruta:** funcionaría, pero suma una pieza nueva que configurar y vigilar en la base, y el
  secreto del cron tendría que vivir también allí.
- **Un cron externo gratuito:** un servicio más, con el secreto en otro lado.
- **Las 24 horas:** a las 3 a. m. el resumen sería el del día que recién empieza.

## Consecuencias

- Vercel llama 16 veces al día a la ruta, y 15 de esas llamadas terminan en una consulta de una fila. Es despreciable en Hobby.
- Si se cambia la hora a una que ya pasó, ese día no sale aviso, y la pantalla lo dice («empieza mañana»). Si se cambia a una más tarde
  después de que el aviso de hoy ya salió, sale otra vez con las cifras al día y reemplaza al anterior en el teléfono (misma etiqueta del día).
- Las pruebas e2e del cron ponen la hora de cierre en la hora de ahora. Antes de las 8 a. m. de Lima se saltan, y lo dicen.
- Para un horario exacto (no «dentro de la hora») sigue haciendo falta Vercel Pro. Para producción ya está previsto salir de Hobby.
