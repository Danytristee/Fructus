# 2026-11-14 · Aviso de frescura: se construye lo que mostró la maqueta

Obra de varias actividades (`/construir`), sobre la maqueta aprobada en `docs/maquetas/frescura/` (Stock en dos pestañas). El modelo elegido para la estimación es Claude Sonnet 5.5. Cada actividad tiene su commit.

## Actividad 1 · La temperatura del puesto, por voz y a mano

- **Qué cambió:** tabla `temperaturas` y vista `v_temperatura_dia` (migración `20261114190000_temperatura_diaria`, solo en local). Las lecturas solo se agregan: corregir es anotar otra, y la temperatura de un día es su última lectura. Herramienta nueva del intérprete, `registrar_temperatura` («hoy hizo 29 grados»), con su tarjeta (`TarjetaTemperatura`: una cifra y dos botones, sin teclado), su guardado idempotente por comando (`confirmarTemperatura`) y su lugar en la cola sin conexión. En «Hoy», si falta la de hoy y esa semana ya se anotó alguna, una tarjeta la pide después del aviso de stock.
- **Cómo se verificó:** pgTAP `18_temperatura_diaria` (11 pruebas: caso feliz, doble toque, corregir, rango, fecha no creíble, ayudante que no edita, contador que no anota) y las otras 17 en verde tras `db reset`. Vitest 645 en verde. Playwright `voz-temperatura.spec.ts` a 412 y 360 px: dictada, corregida, «290» mal oído, salto grande con ayer, descartar, a mano desde «Hoy» y sin señal (queda en el celular y entra una sola vez). Tipos, lint y Knip limpios; las 12 invariantes en orden. Capturas en `docs/formidable/capturas/temperatura-2026-11-14/`.
- **Concurrencia y caídas:** dos toques en Confirmar guardan una lectura (índice único por comando). Si dos personas anotan el mismo día, quedan las dos y vale la última. Sin señal va a la cola; si la base no responde, lo mismo.

## Actividad 2 · «Por malograrse» cuenta el calor de cada día

- **Qué cambió (regla de stock, con OK):** antes una fruta avisaba cuando su lote más viejo pasaba el 60 % y el 85 % de los días de una tabla fija. Ahora cada llegada lleva su cuenta (`lib/frescura-reglas.ts`): cada día en el puesto gasta una parte de su vida, y con calor gasta más (el doble cada 10 grados sobre 24°). El aviso es «tiene que salir hoy» (su último día bueno es hoy, o ya pasó) o «sale mañana», y dice cuántas cajas, de qué día y cuánto le quitó el calor. «Te sobra» usa los días que de verdad le quedan a la llegada más vieja. Un día sin lectura se cuenta con la última anotada (hasta una semana atrás) y, si no hay, con 24°: sin ninguna temperatura la fruta dura lo que decía la tabla.
- **Cómo se verificó:** Vitest 672 en verde (`frescura-reglas.test.ts`, 22 pruebas con la semana de la maqueta; `inventario-reglas.test.ts`, 29). Playwright `stock-frescura.spec.ts` a 412 y 360 px: con calor, la papaya de hace 3 días sale hoy y la manzana del mismo día no; «Hoy» dice «N frutas tienen que salir hoy». Tipos, lint y Knip limpios; invariantes en orden. Capturas en `docs/formidable/capturas/frescura-calor-2026-11-14/`.
- **Caída externa:** si la temperatura no se puede leer, el inventario igual sale y cada día cuenta como uno normal.

## Pendiente

- **Sin probar: `/voz-precision`.** El prompt ganó una línea y una herramienta, y hay 3 casos nuevos en `tests/interprete/casos.json` (65 en total). No se pudo medir contra el modelo real porque este worktree no tiene la clave de Groq en `.env.local`. Hay que correrlo antes de fusionar.
- **`/formidable` y `/chaos`** de la tarjeta de la temperatura y del pedido en «Hoy»: se corren al cerrar la obra, con Stock ya en dos pestañas.
- **La migración no está aplicada al proyecto de Supabase:** se pregunta antes, y al aplicarla el archivo toma la versión que asigne.
- La base local es una sola para todos los worktrees. Para correr pgTAP hubo que hacer `db reset`, que quita el catálogo real y la historia de demo: se vuelven a cargar con `scripts/demo/*.sql`.
- `components/voz/VozHoy.tsx:131` tiene un aviso de lint anterior a esta obra (`react-hooks/exhaustive-deps`).
- `tests/e2e/stock-tablero.spec.ts:70` falla a los dos anchos desde antes de esta obra: inserta cajas con fecha de hace 10 días, y desde `20261112190000_fecha_del_celular` la base cambia una fecha de más de 48 horas por la de ahora, así que nunca aparece «Sin movimiento». Hay que insertar y después mover la fecha, como hace `stock-frescura.spec.ts`.
- Las llegadas solo cubren las entradas de los últimos 45 días (`lib/inventario.ts`). Si el stock es mayor que esas entradas, lo que sobra es más viejo y no entra en la cuenta ni en el aviso.
