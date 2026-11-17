# 2026-11-17 · La hora de cierre la elige el dueño

- **Qué cambió:** el aviso del día ya no sale siempre a las 7 p. m. El dueño o el administrador eligen la hora de cierre en Ajustes, de 8 a. m. a 11 p. m.: un renglón arriba, una hoja con las 16 horas y un toque. La hora vive en `ajustes_puesto`, una tabla de una sola fila que solo cambia `fijar_hora_cierre` (revisa el rol y deja la firma). `vercel.json` tiene ahora 16 crons a la misma ruta, uno por hora y cada uno una vez al día (Hobby deja 100), y solo avisa el de la hora guardada. La fila «Aviso del día» del menú y el aviso de prueba dicen la hora elegida. Ver ADR-0023.
- **Cómo se verificó:**
  - Vitest: 983 pruebas en verde, 18 nuevas en `lib/hora-cierre-reglas.test.ts`. Esa prueba falla si `vercel.json` y la lista de horas se separan.
  - pgTAP: 318 pruebas en verde, 13 nuevas en `28_hora_de_cierre`. Solo dueño y administrador cambian la hora; ayudante y contador reciben 42501, también con un update directo; nadie pone las 3 a. m.
  - e2e a 412 y 360 px: 43 pruebas en verde y 9 saltadas, que son las del cron a 360 px, como siempre. Hay una prueba nueva que comprueba que el cron de otra hora no avisa nada.
  - En el navegador, el cambio a las 3 p. m. quedó en la base con la firma del dueño.
  - Primero el visto iba al lado del texto, y a 360 px «✓ 11 p. m.» se salía 9 px de la píldora: ahora va en la esquina.
  - `tsc`, ESLint y Knip limpios.
- **Pendiente:**
  - Aplicar la migración `20261117195145_hora_de_cierre.sql` al proyecto de Supabase (espera OK) y renombrarla con su versión real.
  - Ver en Vercel que se registren los 16 crons después del despliegue.
  - `/formidable` y `/chaos` de la hoja nueva: sin correr.
