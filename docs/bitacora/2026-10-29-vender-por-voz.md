# 2026-10-29 · Vender por voz desde el celular (A5)

**Qué cambió:**
- **La venta dictada se guarda una sola vez** (migración `venta_unica_por_comando`):
  - un índice único `ventas(comando_voz_id)` y `registrar_venta` idempotente por comando;
  - un doble toque, un reintento o dos llamadas a la vez devuelven la misma venta;
  - con `"corregido": true` el comando queda como corregido.
- **El botón de «Hoy» graba de verdad** (MediaRecorder) y envía a `/api/voz`:
  - «Te escucho» y la vibración recién cuando el micrófono graba, para que el «Vendí…» del principio no quede fuera;
  - si falla la red o un servicio, el aviso dice qué hacer y el último audio queda en el celular (IndexedDB) para reintentarlo, también tras recargar.
- **La tarjeta de venta**, en una hoja cargada en diferido:
  - cliente, fruta, cajas y precio tocables para corregir;
  - el cliente dudoso se elige entre los parecidos, y el precio sugerido se marca y se recalcula si cambia el cliente;
  - **Pagó / Lo debe** con píldora y medios de pago, más un medidor de cómo queda la deuda;
  - Confirmar fijo abajo, apagado y con la frase de lo que falta mientras falte algo;
  - sello, vibración y sonido cuando la base respondió;
  - Descartar con 5 s para deshacer.
- **La rebaja de toda la venta** se reparte entre las frutas según su peso, al céntimo (`lib/voz/confirmar-venta-reglas.ts`).
- **La latencia** de soltar el botón a ver la tarjeta se mide en el celular y queda en `comandos_voz.latencia_ms` al confirmar o descartar.
- **Confirmar ya no rearma «Hoy» dentro de la respuesta.** El `revalidatePath("/")` demoraba el sello de 2 a 5 s; ahora la acción responde en 120–390 ms y «Hoy» se refresca por detrás.

**Cómo se verificó:**
- pgTAP: 28 en verde, con 10 nuevas (doble llamada, corregido, el índice, el contador).
- Dos confirmaciones a la vez en dos conexiones: una sola venta.
- Vitest: 112 en verde.
- e2e de voz (22) con micrófono falso y `/api/voz` simulado contra la base local: crédito, contado corregido, doble toque, cliente dudoso, descartar con deshacer, sin señal, reintento tras recargar.
- Suite e2e completa: 81 pasan y 1 se salta (la de Groq real corre solo a 412).
- Invariantes: las 12 en orden, y ninguna venta repetida por comando.
- JavaScript de «Hoy» con sesión: 176.9 KB brotli, con tope de 180. La hoja de la tarjeta va aparte (8.7 + 7.5 KB, en diferido).

**Después, con OK:**
- `/formidable`: 8.4 → 9.0 (`docs/formidable/voz-venta-2026-10-29.md`).
- `/chaos` (semilla 20261029): 6 hallazgos resueltos, cada uno con su prueba (`docs/chaos/voz-venta-2026-10-29.md`).
- El más grave: un precio con 3 decimales («1,299») rompía INV-01. Se arregló en la base, también en las compras.
- Migraciones aplicadas al proyecto con `apply_migration`: `20261029162319_venta_unica_por_comando` y `20261029162351_montos_en_centimos`. En el proyecto, INV-01 e INV-05 en 0 y sin stock negativo; los tipos de `public` no cambian.
- Con OK, `20261029185755_funciones_sin_anon`: ninguna función propia se ejecuta sin sesión; `05_funciones_sin_anon.test.sql` lo vigila en el CI.
- `proxy.ts` deja pasar las server actions: cada una revisa la sesión y responde en lenguaje de puesto.
- JavaScript de «Hoy»: 177.2 KB brotli.

**Pendiente:**
- La prueba real con la voz en un celular, y la latencia de punta a punta en 4G.
- **Quedan 3 KB de margen en «Hoy»:** A6 tiene que sumar sus tarjetas dentro de la hoja diferida, no en el botón.
- **E2E inestable con la máquina cargada** (otros stacks de Supabase en Docker): Auth local devuelve `AuthRetryableFetchError` y el login pasa los 15 s. Se reinicia el servidor y se repite.
