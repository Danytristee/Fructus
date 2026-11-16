# ADR-0021 — La IA estima cuánto aguanta cada fruta, una vez al día, y la tabla queda de respaldo

**Fecha:** 2026-11-16 · **Estado:** aceptado (agrega Anthropic al stack; el número 0020 es de «confirmar hablando»)

## Contexto

El aviso de frescura cuenta el calor de cada día, llegada por llegada (`lib/frescura-reglas.ts`), pero parte de una tabla fija de días por
familia de fruta (`lib/vida-util-reglas.ts`). La tabla dice lo mismo para una manzana Pink Lady y para una Delicia de sexta, y nadie la
ajusta: son valores de referencia que no se midieron en el puesto. Se pidió que el sistema estime con IA cuánto tarda en malograrse cada
fruta y avise lo que tiene que salir, usando los créditos de Anthropic, con Claude Sonnet.

Lo que no puede pasar: que un número inventado por un modelo apague el aviso («el mango aguanta 40 días»), que el aviso baile de un día a
otro sin motivo, o que Stock deje de funcionar cuando el modelo no responde.

## Decisión

1. **El modelo estima un solo número por fruta: los días que aguanta a 24° si llega pintona.** El calor de cada día y cómo llegó (verde,
   pintona, madura) los siguen contando las reglas de siempre, encima de ese número. Así el modelo hace lo que sabe (distinguir una variedad,
   una selección o un calibre de otro) y la aritmética queda en código que se prueba.
2. **Una vez al día, junto al aviso de la noche** (`app/api/cron/resumen-diario/route.ts`, 7 p. m. de Lima). Corre a la par del aviso y no
   lo frena: si el modelo falla, el aviso sale igual. La ruta pasa de 30 a 60 s de tope; la llamada al modelo tiene el suyo de 45 s.
3. **Solo se pregunta lo que falta** (`frutasPorEstimar`, `lib/vida-estimada-reglas.ts`): las frutas activas que todavía no tienen
   estimación, primero las que tienen cajas, a lo más 60 por noche. Lo ya estimado no se vuelve a preguntar: la misma pregunta dos noches
   seguidas puede traer dos respuestas, y el aviso bailaría con ellas. La mayoría de las noches no hay llamada.
4. **Lo que contesta el modelo no se cree sin más** (`aceptarEstimaciones`): solo frutas que se le pidieron, una vez cada una, en días
   enteros, con motivo, y **dentro de la mitad de la tabla para arriba o para abajo** (mango, tabla 7: entre 4 y 10). Lo que se va del
   margen se recorta y se cuenta; lo que no cumple se descarta y esa fruta sigue con la tabla.
5. **Se guarda en `vida_util_estimada`: solo se agregan filas, una por fruta y por día, y solo las escribe el servidor.** Todos los roles
   leen; nadie con sesión escribe, edita ni borra (el intento falla con 42501). Rige la del día más reciente (`v_vida_util`). Cada fila lleva
   su motivo y el modelo que la dio.
6. **Stock cuenta con la estimación y dice de dónde sale** (`lib/inventario.ts`, `evaluarProducto`). La hoja «¿por qué?» lo dice al pie:
   «Para estas cajas cuento unos 4 días con clima normal. Lo estimó la IA ayer: De tercera suele llegar más madura: se pasa antes.» Si la
   IA la revisó y coincide con la tabla, dice eso. Sin estimación: «…según la tabla del sistema».
7. **Si algo falla, sigue la tabla.** Sin clave, sin respuesta a tiempo, con un rechazo del modelo, con una respuesta cortada o con la base
   caída: no se guarda nada, el cron lo informa (`vidaUtil.motivo`: `fallo` o `sin-configurar`, con un código) y Stock cuenta con lo que ya
   tenía (la última estimación, o la tabla). Si la lectura de las estimaciones falla, el inventario sale igual con la tabla.
8. **El modelo:** `claude-sonnet-5-5` por el SDK oficial (`@anthropic-ai/sdk`), con salida estructurada validada con Zod
   (`messages.parse` + `zodOutputFormat`) y esfuerzo bajo: es recordar y comparar, no un problema de varios pasos. La llamada vive en
   `lib/vida-estimada/sonnet.ts` (`server-only`). Al modelo solo le llegan nombres de fruta y números de días: nada de clientes, precios ni
   ventas.
9. **Clave:** `ANTHROPIC_API_KEY`, solo en el servidor (`.env.local`, variables de Vercel). Sin ella no se estima y se dice.

## Alternativas descartadas

- **Que el modelo decida directamente «qué sale hoy»:** una respuesta distinta cada noche, sin poder explicar por qué cambió, y Stock
  caído si el modelo no responde. El modelo ajusta un número; la cuenta sigue siendo código.
- **Preguntarle todo el catálogo cada noche:** gasta lo mismo cada día para volver a oír lo mismo, o peor, algo apenas distinto.
- **Estimar por familia de fruta, como la tabla:** pierde justo lo que el modelo aporta (variedad, selección, calibre).
- **Sin margen sobre la tabla:** un error del modelo movería el aviso de todo el puesto sin que nadie lo note.
- **Respaldo a otro modelo si Sonnet rechaza el pedido** (`fallbacks` de la API): solo cubre rechazos por categorías que este pedido no
  toca. El respaldo de Fructus es la tabla, que no depende de ningún servicio.
- **Una ruta de cron aparte:** otra tarea programada y otro secreto para algo que cabe en la pasada de la noche.
- **Llamar al modelo desde Stock, al abrirlo:** la pantalla esperaría a un servicio externo y cada visita costaría una llamada.

## Consecuencias

- **Costo.** La primera noche pregunta por todo el catálogo: 58 frutas se estimaron en 15 s, por unos centavos de dólar (Sonnet 5.5: 2 USD
  por millón de tokens de entrada y 10 de salida). Después, solo las frutas nuevas.
- **Dependencia nueva de pago:** Anthropic, aprobada por quien dirige el proyecto. No es de costo cero como el resto del stack.
- **Hay que poner `ANTHROPIC_API_KEY` en Vercel.** Hasta entonces, producción responde `sin-configurar` y sigue con la tabla.
- **Las pruebas no gastan créditos:** un modelo de mentira (`tests/e2e/sonnet-simulado.mjs`, `VIDA_UTIL_SIMULADOR_URL`, solo direcciones
  locales) contesta por defecto lo mismo que la tabla, para que las demás pruebas de Stock no cambien.
- **Una estimación no caduca sola.** Cambia cuando el puesto da una razón: ver los puntos siguientes.
