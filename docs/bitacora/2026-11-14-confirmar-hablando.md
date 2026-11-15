# 2026-11-14 · Confirmar la venta hablando (ADR-0020)

«Hola Fructus» queda en pausa: la app podría cambiar de nombre y con él la frase. Esta obra sigue con lo que no depende del nombre,
en la rama `claude/confirmar-hablando`. La rama `claude/hola-fructus-viabilidad` queda subida, sin PR, hasta que haya nombre.

## Actividad 1 · Callarse envía

- **Qué cambió:** escuchando sin el dedo, el orbe envía solo cuando la persona habló y calló 1.2 s (`lib/voz/silencio-reglas.ts`,
  `useGrabadora`). Mientras se mantiene, manda el dedo. ADR-0018, actualización del 2026-11-14.
- **Cómo se verificó:**
  - Vitest: 12 de la regla del silencio y 16 del gesto.
  - `voz-silencio.spec.ts`, con un micrófono que la prueba prende y apaga: envía al callarse, no envía con una pausa de 0.7 s ni sin
    hablar, y no envía mientras se mantiene. Con `voz.spec.ts`, 30 en verde a 412 y 360 px.
- **Pendiente:**
  - Sin probar con el audífono ni con el ruido del puesto: los 1.2 s, los 0.4 s de voz mínima y los 12 dB sobre el fondo.
  - Si corta a alguien que piensa el precio, sube a 1.5 s. El costo es esperar un poco más en cada venta.
