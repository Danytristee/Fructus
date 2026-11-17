# 2026-11-17 · La hora de cierre la elige el dueño

- **Qué cambió:** el aviso del día ya no sale siempre a las 7 p. m. El dueño o el administrador eligen la hora de cierre en Ajustes, de 8 a. m. a 11 p. m.: un renglón arriba, una hoja con las 16 horas y un toque. La hora vive en `ajustes_puesto`, una tabla de una sola fila que solo cambia `fijar_hora_cierre` (revisa el rol y deja la firma). `vercel.json` tiene ahora 16 crons a la misma ruta, uno por hora y cada uno una vez al día (Hobby deja 100), y solo avisa el de la hora guardada. La fila «Aviso del día» del menú y el aviso de prueba dicen la hora elegida. Ver ADR-0023.
- **Cómo se verificó:**
  - Vitest: 983 pruebas en verde, 18 nuevas en `lib/hora-cierre-reglas.test.ts`. Esa prueba falla si `vercel.json` y la lista de horas se separan.
  - pgTAP: 318 pruebas en verde, 13 nuevas en `28_hora_de_cierre`. Solo dueño y administrador cambian la hora; ayudante y contador reciben 42501, también con un update directo; nadie pone las 3 a. m.
  - e2e a 412 y 360 px: 43 pruebas en verde y 9 saltadas, que son las del cron a 360 px, como siempre. Hay una prueba nueva que comprueba que el cron de otra hora no avisa nada.
  - En el navegador, el cambio a las 3 p. m. quedó en la base con la firma del dueño.
  - Primero el visto iba al lado del texto, y a 360 px «✓ 11 p. m.» se salía 9 px de la píldora: ahora va en la esquina.
  - `tsc`, ESLint y Knip limpios.
- **En el proyecto de Supabase:**
  - La migración quedó aplicada el mismo día con OK de quien dirige el proyecto. Se aplicó con `supabase db push --linked`, porque el conector MCP se desconectó.
  - Supabase registró la versión `20261117195145`, la misma del archivo.
  - Queda igual que en local: una fila con las 7 p. m., `anon` sin acceso y sin update directo para `authenticated`.
  - El linter da un solo aviso nuevo, y se deja a propósito: `fijar_hora_cierre` es `security definer` y la pueden ejecutar los autenticados, pero revisa el rol antes de tocar nada (anotado en CLAUDE.md).
- **Pendiente:**
  - Ver en Vercel que se registren los 16 crons después del despliegue.
  - `/formidable` y `/chaos` de la hoja: se corrieron más tarde (ver abajo y los informes del día).

## Después: reloj de ruedas con minutos, y el reloj lo lleva la base (ADR-0024)

- **Qué cambió:**
  - Quien dirige el proyecto pidió cambiar la grilla de 16 horas por un reloj que se gira con el dedo, con horas y minutos.
  - En Vercel Hobby un cron llega en cualquier minuto de su hora y no puede cumplir minutos. De tres caminos, eligió que el reloj lo lleve la base.
  - Desde ahora `pg_cron` revisa cada minuto si ya es la hora. Cuando lo es, llama a la ruta con una ficha de un solo uso (`pg_net`), y la ruta reclama el día una sola vez.
  - Los 16 crons de Vercel quedan de respaldo.
  - Los minutos van de 5 en 5.
  - La pieza nueva es `components/ui/Rueda.tsx`: scroll-snap, giro de tambor atado al scroll y teclado.
  - Entraron los arreglos de `/formidable` y `/chaos`: el error dentro de la hoja, «Entrar otra vez», el doble toque, «Ver el cierre de hoy» y la hora que no se parte entre dos renglones.
- **Cómo se verificó:**
  - pgTAP: 342 en verde, 24 nuevas en `29_reloj_del_aviso`. Cubren los minutos de 5 en 5, la ficha vigente, que el reloj llama una vez y el día que se reclama una sola vez.
  - Vitest: 989 en verde.
  - e2e a 412 y 360 px: la hoja (girar con el dedo y con el teclado, tocar un número, sin señal), el cron (`temprano`, ficha, `ya-avisado`), el menú y la vida útil.
  - Al hacer la e2e apareció un error real de la rueda, y se arregló: con varias flechas seguidas, el giro suave informaba las posiciones intermedias y se perdían pasos.
- **Pendiente:** ver en el proyecto que el trabajo `aviso-del-dia` corra cada minuto y que, a la hora de cierre, Vercel conteste. Eso se ve en `cron.job_run_details` y `net._http_response`.
