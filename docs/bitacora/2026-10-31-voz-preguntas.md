# 2026-10-31 · A7: preguntar por voz

**Actividad 1 · «¿Quién me debe?» y la pieza de respuesta.**
- Qué cambió: `lib/voz/consultas.ts` lee la base y `lib/voz/consultas-reglas.ts` arma la respuesta (veredicto, los 5 que más deben y lo que se dice en voz alta). `/api/voz` la manda con la tarjeta y deja el comando como «confirmado»; si no llega, la tarjeta la pide con la acción `responderConsulta`. `TarjetaConsulta` la muestra y la dice con `speechSynthesis` (voz de Perú si existe; si no, de Latinoamérica). Los montos se dicen en palabras (`lib/voz/palabras-reglas.ts`: «veintiún soles», «dos mil cuatrocientos setenta y dos soles con cincuenta céntimos»).
- Una pregunta no se «descarta» ni queda «sin confirmar»: cerrar la hoja no da aviso.
- Cómo se verificó: Vitest (palabras y respuesta), e2e de consultas a 412 y 360 px (lo dicho se graba reemplazando `speechSynthesis`) y la regresión de las tarjetas de voz. La captura a 360 px mostró la lista y «Listo» cortados a la derecha: la grilla tomaba el ancho del contenido. Ahora es una columna `minmax(0, 1fr)` y el nombre se corta antes que el monto.

**Actividad 2 · Deuda de un cliente y stock de una fruta.**
- Qué cambió: `respuestaDeudaCliente` (debe, al día o a favor) y `respuestaStockProducto` (sin stock o en negativo no muestra una cifra imposible: dice «No te queda»). Si el nombre no se entendió, `TarjetaConsulta` pide elegirlo con `EditorBusqueda` y recién responde.
- Cómo se verificó: Vitest (8 de consultas) y 12 e2e a 412 y 360 px; a 360 px nada se sale de la hoja.

## Pendiente
- El contador no puede dictar (`/api/voz` responde 403), así que tampoco puede preguntar. Decidir si las consultas se abren al contador.
- En desarrollo, React monta dos veces y la respuesta empieza a decirse dos veces (la segunda corta a la primera). En producción no pasa.
- `voz-abono` «respuesta perdida» falló una vez con 48 pruebas en paralelo y no se repitió en 2 corridas más: vigilar.
