# ADR-0017 — El botón de voz escucha sin mantener presionado: toque, candado y «Borrar»

**Fecha:** 2026-11-12 · **Estado:** aceptado

## Contexto

Hasta ahora la voz era solo «mantener → hablar → soltar» (CLAUDE.md, «La voz»). El dueño atiende con una caja en la otra mano, y
mantener el pulgar apretado durante toda la frase le ocupa la única mano libre. La revisión del Informe T3 (2026-11-12) llevó a pedir
dos formas de hablar sin mantener el dedo: un toque para empezar y otro para terminar, y deslizar hacia arriba para dejarlo bloqueado,
como los audios de WhatsApp. La palabra de activación («Hola Fructus») queda para después, sobre esta base.

## Decisión

1. **Tres formas, un solo botón y ninguna que elegir.** El gesto vive en `lib/voz/gesto-reglas.ts`, como lógica pura con su prueba:
   - mantener y soltar envía, como siempre;
   - un toque de menos de 300 ms deja el orbe escuchando sin el dedo, y el siguiente toque envía;
   - mientras se mantiene, subir el dedo 94 px (hasta el candado, que va encima del orbe) también lo deja escuchando sin el dedo.
2. **Escuchando sin el dedo, se ve distinto.**
   - El orbe dice «Enviar» con una flecha, y los anillos siguen diciendo que escucha.
   - Junto a la etiqueta aparece «Borrar», lejos del orbe para que no se toque por enviar.
   - Los destinos de la barra de abajo se apartan, solo con opacidad (ADR-0012), mientras el orbe escucha. Un toque desviado no saca
     de «Hoy» a mitad de lo dicho.
3. **Nada se pierde y nada queda prendido.**
   - A los 55 s se envía solo, porque el servidor rechaza audios de más de 60 s.
   - Si se sale de «Hoy» escuchando, el micrófono se apaga sin enviar.
   - Cada `empezar()` de `useGrabadora` tiene su vuelta. El micrófono de una vuelta vencida se apaga apenas llega: antes, varios
     toques seguidos dejaban micrófonos prendidos (/chaos 2026-11-12).
4. **El largo del toque se mide con la hora del evento** (`e.timeStamp`), no con la del manejador. En un Android ocupado, el
   manejador corre tarde y un «mantener» parecía un toque.
5. **La confirmación no cambia:** la tarjeta se confirma con un toque (principio 1).

## Consecuencias

- La etiqueta de reposo dice «Toca o mantén para hablar». Los textos que enseñaban a mantener cambiaron: «Hoy» vacío, el error de
  `/api/voz` sin audio y el de un audio muy corto.
- Con teclado, pulsar Espacio una vez deja el orbe escuchando, y pulsarlo otra vez envía.
- **Sin probar en un teléfono real:** los 300 ms del toque, los 94 px del candado y qué hace Android con el micrófono de una página
  escuchando cuando se bloquea la pantalla. Se miden con el dueño y se ajustan en `gesto-reglas.ts`.
