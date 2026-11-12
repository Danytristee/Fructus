# /chaos · Botón de voz con toque, candado y X (2026-11-12)

- **Pantalla:** el orbe de «Hoy» (`components/voz/VozHoy.tsx`, `BotonVoz.tsx`, `useGrabadora.ts`, `lib/voz/gesto-reglas.ts`).
- **Rama:** `claude/sistema-revision-correcciones-b0e8ed` · **Semilla:** 2026111201 · **Ataques:** 8 · **Resistieron:** 7.
- **Base:** este botón no escribe (graba y envía audio; guardar es de la tarjeta, que no cambió). `/api/voz` simulado. Invariantes: las 12 en orden antes y después. No se hizo `db reset` porque la base local la comparte otra sesión y ningún ataque escribió.
- **Adaptación del núcleo:** sin campos ni montos ni escrituras propias, el núcleo fue doble toque, red cortada y tocar mientras entiende. Voz ambigua, monto con coma y concurrencia de dos cuentas no aplican a este cambio.
- **Cómo se midió:** Playwright a 412 px con un micrófono falso. Un script envuelve `getUserMedia` y cuenta las pistas de micrófono que siguen `live`.

## Hallazgo

### 1 · El micrófono queda prendido tras toques rápidos seguidos (A1)

No es un estado imposible en la base, pero el micrófono queda escuchando sin que nadie lo sepa. Afecta la privacidad y la batería, y no se nota en la pantalla.

- **Pasos:** cinco toques seguidos al orbe (40 ms cada uno), esperar 2.5 s, un toque más para enviar.
- **Evidencia:** tras los 5 toques, 3 pistas `live`. Después de enviar siguen 2 `live`, y la pantalla vuelve a «Toca o mantén para hablar».
- **Causa:** `useGrabadora` usa una sola bandera `soltado` para todas las llamadas. Un `empezar()` nuevo la vuelve a `false` mientras el `getUserMedia` anterior todavía no respondió. Ese flujo viejo arranca su propia grabadora y la nueva lo pisa en `grabadora.current`: queda huérfano y prendido (`components/voz/useGrabadora.ts`, `empezar`).
- **Antes del cambio:** ya podía pasar manteniendo y soltando muy rápido, pero era raro. Con el toque para escuchar, tocar varias veces seguidas es natural.
- **Arreglado (con OK):** cada `empezar()` lleva su número de vuelta; si al llegar el permiso ya no es la vuelta vigente, o se terminó, apaga sus pistas. La prueba e2e `voz.spec.ts` «tocar el orbe muchas veces seguidas…» falló antes del arreglo (2 pistas vivas, 5 de 5 corridas) y pasa después (8 de 8).

## Resistieron

| Ataque | Qué pasó |
|---|---|
| A2 · Red cortada escuchando sin el dedo, luego tocar para enviar | No intenta enviar, dice «Sin señal…», guarda el audio y ofrece Reintentar. Micrófono apagado. |
| A3 · Tocar tres veces mientras entiende (respuesta lenta de 3 s) | Una sola llamada a `/api/voz`, una hoja, micrófono apagado. |
| A4 · Escuchar sin el dedo 57 s | A los 55 s envía solo: una llamada, la hoja abierta, micrófono apagado. |
| A5 · Salir de «Hoy» escuchando sin el dedo | No envía nada y el micrófono se apaga. |
| A6 · Teclado: Espacio corto y después Espacio | Queda escuchando y el segundo Espacio envía: una llamada, la hoja. |
| A7 · Subir hasta el candado y volver a bajar antes de soltar | Queda escuchando sin el dedo (igual que WhatsApp: el candado ya cerró). Por diseño. |
| A8 · Permiso de micrófono negado con un toque | Pide el permiso en lenguaje de puesto. Sin X, sin bloqueo y con la barra visible. |

## Sin probar

- Bloquear el celular o cambiar de app escuchando sin el dedo. Android puede cortar el micrófono de una página en segundo plano y no se puede simular sin un teléfono real.
