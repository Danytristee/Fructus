# 2026-11-14 · Aviso de frescura: se construye lo que mostró la maqueta

Obra de varias actividades (`/construir`), sobre la maqueta aprobada en `docs/maquetas/frescura/` (Stock en dos pestañas). El modelo elegido para la estimación es Claude Sonnet 5.5. Cada actividad tiene su commit.

## Actividad 1 · La temperatura del puesto, por voz y a mano

- **Qué cambió:** tabla `temperaturas` y vista `v_temperatura_dia` (migración `20261114190000_temperatura_diaria`, solo en local). Las lecturas solo se agregan: corregir es anotar otra, y la temperatura de un día es su última lectura. Herramienta nueva del intérprete, `registrar_temperatura` («hoy hizo 29 grados»), con su tarjeta (`TarjetaTemperatura`: una cifra y dos botones, sin teclado), su guardado idempotente por comando (`confirmarTemperatura`) y su lugar en la cola sin conexión. En «Hoy», si falta la de hoy y esa semana ya se anotó alguna, una tarjeta la pide después del aviso de stock.
- **Cómo se verificó:** pgTAP `18_temperatura_diaria` (11 pruebas: caso feliz, doble toque, corregir, rango, fecha no creíble, ayudante que no edita, contador que no anota) y las otras 17 en verde tras `db reset`. Vitest 645 en verde. Playwright `voz-temperatura.spec.ts` a 412 y 360 px: dictada, corregida, «290» mal oído, salto grande con ayer, descartar, a mano desde «Hoy» y sin señal (queda en el celular y entra una sola vez). Tipos, lint y Knip limpios; las 12 invariantes en orden. Capturas en `docs/formidable/capturas/temperatura-2026-11-14/`.
- **Concurrencia y caídas:** dos toques en Confirmar guardan una lectura (índice único por comando). Si dos personas anotan el mismo día, quedan las dos y vale la última. Sin señal va a la cola; si la base no responde, lo mismo.

## Pendiente

- **Sin probar: `/voz-precision`.** El prompt ganó una línea y una herramienta, y hay 3 casos nuevos en `tests/interprete/casos.json` (65 en total). No se pudo medir contra el modelo real porque este worktree no tiene la clave de Groq en `.env.local`. Hay que correrlo antes de fusionar.
- **`/formidable` y `/chaos`** de la tarjeta de la temperatura y del pedido en «Hoy»: se corren al cerrar la obra, con Stock ya en dos pestañas.
- **La migración no está aplicada al proyecto de Supabase:** se pregunta antes, y al aplicarla el archivo toma la versión que asigne.
- La base local es una sola para todos los worktrees. Para correr pgTAP hubo que hacer `db reset`, que quita el catálogo real y la historia de demo: se vuelven a cargar con `scripts/demo/*.sql`.
- `components/voz/VozHoy.tsx:131` tiene un aviso de lint anterior a esta obra (`react-hooks/exhaustive-deps`).
