# 2026-10-31 · A7: preguntar por voz

**Actividad 1 · «¿Quién me debe?» y la pieza de respuesta.**
- Qué cambió: `lib/voz/consultas.ts` lee la base y `lib/voz/consultas-reglas.ts` arma la respuesta (veredicto, los 5 que más deben y lo que se dice en voz alta). `/api/voz` la manda con la tarjeta y deja el comando como «confirmado»; si no llega, la tarjeta la pide con la acción `responderConsulta`. `TarjetaConsulta` la muestra y la dice con `speechSynthesis` (voz de Perú si existe; si no, de Latinoamérica). Los montos se dicen en palabras (`lib/voz/palabras-reglas.ts`: «veintiún soles», «dos mil cuatrocientos setenta y dos soles con cincuenta céntimos»).
- Una pregunta no se «descarta» ni queda «sin confirmar»: cerrar la hoja no da aviso.
- Cómo se verificó: Vitest (palabras y respuesta), e2e de consultas a 412 y 360 px (lo dicho se graba reemplazando `speechSynthesis`) y la regresión de las tarjetas de voz. La captura a 360 px mostró la lista y «Listo» cortados a la derecha: la grilla tomaba el ancho del contenido. Ahora es una columna `minmax(0, 1fr)` y el nombre se corta antes que el monto.

**Actividad 2 · Deuda de un cliente y stock de una fruta.**
- Qué cambió: `respuestaDeudaCliente` (debe, al día o a favor) y `respuestaStockProducto` (sin stock o en negativo no muestra una cifra imposible: dice «No te queda»). Si el nombre no se entendió, `TarjetaConsulta` pide elegirlo con `EditorBusqueda` y recién responde.
- Cómo se verificó: Vitest (8 de consultas) y 12 e2e a 412 y 360 px; a 360 px nada se sale de la hoja.

**Actividad 3 · Ventas, gastos, resumen del día y stock general.**
- Qué cambió: `respuestaVentasHoy`, `respuestaGastosHoy`, `respuestaResumenDia` y `respuestaStock`, con el mismo `resumen_dia()` y el mismo `leerResumen()` que «Hoy» (ahora también trae compras y gastos), así lo que se dice cuadra con lo que se ve. Cada fila lleva su ícono: el cliente, la fruta o ninguno.
- Cómo se verificó: Vitest (15 de consultas) y 14 e2e de consultas a 412 y 360 px.
- **Entorno local, no la app:** con los 3 Supabase de CAYLA corriendo en Docker (36 contenedores), los e2e en paralelo hicieron que el servidor no alcanzara a Auth (`AuthRetryableFetchError`, estado 0) y que PostgREST dejara conexiones «idle in transaction (aborted)», que después responden `25P02` a todo. Se arregla con `docker restart supabase_rest_fructus supabase_kong_fructus` y corriendo con `--workers=1`. Después: 14 de 14.

**Actividad 4 · Cierre.**
- 8 casos nuevos de consulta en `tests/interprete/casos.json` (56 en total). `/voz-precision` sobre los 16 de consulta: 100 % de intención y de datos clave (`docs/voz/precision-2026-10-31-consultas.md`). Los 56 no se midieron: el cupo del día de Groq no alcanzaba.
- JavaScript de «Hoy»: 177.3 KB brotli (tope 180). `/formidable` 8.8, con 3 cambios propuestos (`docs/formidable/voz-respuestas-2026-10-31.md`). `/chaos` no aplica: la hoja no guarda.

- La tarjeta de respuesta no tenía tope al pedir la respuesta: con la señal colgada, el esqueleto quedaba para siempre. Ahora, a los 15 s, dice «No pude leer tu cuaderno…» y ofrece «Intentar otra vez» (e2e «si la señal se cuelga»).

## Pendiente
- El contador no puede dictar (`/api/voz` responde 403), así que tampoco puede preguntar. Decidir si las consultas se abren al contador.
- En desarrollo, React monta dos veces y la respuesta empieza a decirse dos veces (la segunda corta a la primera). En producción no pasa.
- Ver si el tope de 8 s de `fetchWithTimeout` (que corta pedidos a PostgREST con la máquina cargada) es lo que deja las conexiones abortadas; en producción no se ha visto.
- Next corre las server actions de a una: si un pedido queda colgado, el reintento (aquí y en Confirmar) espera a que el navegador lo dé por caído. Con una señal que se cae no pasa; con una que se cuelga minutos, sí. Ver si conviene cortar el pedido en el cliente.
- `voz-abono` «respuesta perdida» falló una vez con 48 pruebas en paralelo y no se repitió en 2 corridas más: vigilar.
