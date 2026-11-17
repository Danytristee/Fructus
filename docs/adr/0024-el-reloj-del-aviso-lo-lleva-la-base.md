# ADR-0024 — La hora de cierre lleva minutos, y el reloj del aviso lo lleva la base

**Fecha:** 2026-11-17 · **Estado:** aceptado · **Sigue a:** ADR-0023 (la hora de cierre la elige el dueño)

## Contexto

ADR-0023 dejó elegir la hora de cierre en una grilla de 16 horas en punto, y el aviso lo disparaban 16 crons de Vercel Hobby, uno por hora.
Quien dirige el proyecto pidió dos cosas más:
- **Un reloj de ruedas**, que se gira con el dedo, en vez de la grilla: más sencillo, minimalista y sofisticado.
- **Minutos.**

En Hobby, un cron llega en cualquier minuto de su hora (documentación de Vercel, 2026-11-17). Si el dueño elige las 4:30 p. m., el cron de
las 4 puede llegar a las 4:05, antes de que cierre, y el de las 5, a las 5:55. Hobby no puede cumplir un minuto. Se le presentaron tres
caminos, cada uno con lo que gana y lo que paga, y eligió el reloj de Supabase.

## Decisión

1. **Minutos de 5 en 5** (`ajustes_puesto.minuto_cierre`, 0 a 55). Nadie cierra a las 4:37, y la rueda gira 12 posiciones en vez de 60.
   `fijar_hora_cierre(p_hora, p_minuto default 0)` exige lo mismo. Sin el minuto, es la hora en punto, así que la app de antes de este cambio
   sigue funcionando contra la base nueva.
2. **El reloj lo lleva la base:**
   - `pg_cron` corre cada minuto `llamar_al_aviso_del_dia()`, que no hace nada hasta que en Lima son la hora y el minuto de cierre.
   - Entonces crea una **ficha de un solo uso** (32 bytes al azar, vence en 5 minutos) y con `pg_net` llama a `/api/cron/resumen-diario`
     con la ficha en el encabezado `x-ficha-aviso`.
   - Con una llamada en curso no llama otra. Si la llamada se pierde, la ficha vence y a los 5 minutos lo intenta de nuevo.
3. **Sin secretos compartidos.** La ficha nace en la base y la ruta la compara contra la base. `CRON_SECRET` sigue viviendo solo en Vercel,
   y no hubo que agregar ninguna variable nueva.
4. **El día se reclama una sola vez.** Antes de avisar, la ruta llama a `reclamar_resumen_del_dia(ficha)`, que en un solo paso, con candado,
   revisa la ficha (si vino), que ya sea la hora y que nadie haya avisado hoy, y anota el día. Contesta `reclamado`, `temprano`, `ya-avisado`
   o `ficha-invalida` (y entonces la ruta responde 401). Si el resumen no se pudo leer, la ruta suelta el día (`soltar_resumen_del_dia()`) y
   el reloj vuelve a intentar.
5. **Los 16 crons de Vercel quedan de respaldo.** Llaman con `CRON_SECRET` y sin ficha, y pasan por el mismo reclamo. Si la base no llama,
   el aviso sale igual, hasta una hora tarde. Si la base ya avisó, contestan `ya-avisado`.
6. **`aviso_del_dia` es solo del servidor:** una sola fila con la dirección de la app, la ficha y el día reclamado. Tiene RLS sin políticas
   y ningún permiso para `anon` ni `authenticated`, como `series_comprobante`. Las funciones del reloj tampoco se pueden llamar con sesión.
7. **Con `url` vacía, el reloj no llama a nadie.** Así quedan la base local y la del CI. En el proyecto se pone una vez la dirección de la
   app publicada (no es secreta): `update aviso_del_dia set url = 'https://…'`.
8. **La pantalla** es un reloj de dos ruedas (horas de 8 a 11, minutos de 00 a 55) con el periodo al lado:
   - La pieza `components/ui/Rueda.tsx` usa scroll-snap, es un `spinbutton` (se maneja con flechas, Inicio y Fin) y vibra un «clic» en
     cada posición.
   - El giro de tambor lo hace una animación atada al scroll (`rueda-tambor`), solo con `transform` y `opacity`: con la rueda quieta no
     corre nada (ADR-0012).
   - Debajo, una frase dice lo que va a pasar («Te llega todos los días a las 4:30 p. m.»).
   - Girar no guarda nada. Lo guarda «Guardar», que está en la zona del pulgar, con vibración y sonido al confirmar.
9. **Lo que pidieron `/formidable` y `/chaos` del 2026-11-17:**
   - si no se guarda, el aviso sale dentro de la hoja, y con la sesión vencida trae «Entrar otra vez»;
   - un segundo toque mientras guarda no manda otro pedido;
   - después de «empieza mañana» aparece «Ver el cierre de hoy»;
   - «como a las» y «dentro de esa hora» desaparecen, porque ahora la hora se cumple al minuto.

## Alternativas descartadas

- **Solo horas en la rueda:** honesto y sin piezas nuevas, pero no es lo que se pidió.
- **Minutos de adorno con los crons de Vercel:** promete un minuto que no cumple, y a veces avisa antes de que el puesto cierre.
- **Copiar `CRON_SECRET` al Vault de Supabase:** el secreto viviría en dos lugares, y cambiarlo en Vercel rompería el reloj sin aviso.
- **Vercel Pro:** cuesta. Para producción ya está previsto salir de Hobby, y entonces se puede revisar.

## Consecuencias

- **La base corre una consulta por minuto** (`cron.job_run_details` guarda cada corrida y no se limpia sola). A este volumen es despreciable;
  antes de producción se agrega una limpieza.
- **Hay un trabajo `aviso-del-dia` en `cron.job`.** Si el reloj de la base deja de correr, el aviso llega por el respaldo de Vercel, hasta
  una hora tarde.
- **Las pruebas e2e del cron** sueltan el día antes de cada llamada (`soltarElDia`), porque ahora el cron avisa una sola vez por día.
