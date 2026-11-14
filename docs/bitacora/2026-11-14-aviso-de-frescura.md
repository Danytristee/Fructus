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

## Actividad 3 · «¿Cómo llegó?» en la compra

- **Qué cambió:** la entrada de stock, que es la llegada, guarda cómo llegó la fruta: verde, pintón o maduro (migración `20261114200000_como_llego_la_fruta`, solo en local; `registrar_compra` lo recibe en cada ítem). Es opcional: si no se dijo queda sin decir y la cuenta lo trata como pintón. El intérprete lo entiende en la compra («llegaron 30 de mango kent verde a 32») y sabe que en «manzana verde» es parte del nombre. La tarjeta de compra pregunta «¿Cómo llegó?» con tres botones y dice al toque cuánto va a aguantar con la temperatura de hoy; con varias frutas se elige dentro de cada una. Solo se pregunta (y se guarda) en la fruta que madura en la caja. La tabla de vida útil pasó a `lib/vida-util-reglas.ts`: verde aguanta 1.4 veces lo de la tabla y maduro, la mitad.
- **Cómo se verificó:** pgTAP `19_como_llego_la_fruta` (9 pruebas) y las otras 18 en verde. Vitest 686. Playwright `voz-compra-llegada.spec.ts` a 412 y 360 px (cambiar lo dicho queda como corrección; sin decir no se inventa; a la piña no se le pregunta; varias frutas) y `voz-compra.spec.ts` sin cambios. Tipos, lint y Knip limpios; invariantes en orden. Captura en `docs/formidable/capturas/compra-como-llego-2026-11-14/`.
- **Concurrencia y caídas:** el segundo toque devuelve la misma compra y no cambia cómo llegó. Una tarjeta que esperaba en la cola desde antes de este cambio se lee igual (los campos nuevos son opcionales).

## Actividad 4 · Stock en dos pestañas y la hoja «¿por qué?»

- **Qué cambió:** Stock abre en «Qué hacer» (los avisos, con lo que tiene que salir hoy primero, y al final el clima del puesto) y guarda en «Tu stock» los totales y la lista por fruta. Se fueron el anillo y los tres recuadros: la cuenta de frutas que piden algo hoy va en la pestaña. Cada fruta dice con palabras lo que le queda a sus llegadas («12 salen hoy · 30 aguantan 5 días») y, al tocar una llegada o un aviso de frescura, la hoja «¿por qué?» muestra qué gastó cada día, con qué temperatura, y cuánto le quitó el calor. Desde el clima se anota o se corrige la temperatura de hoy. En escritorio no hay pestañas: las dos partes van lado a lado, como antes (ADR-0015). `TableroStock` se partió en `QueHacer`, `ListaStock`, `ClimaPuesto`, `HojaPorQue` y `EtiquetaLlegada`; las frases viven en `lib/frescura-frases-reglas.ts`.
- **Cómo se verificó:** Vitest 701. Playwright a 412 y 360 px: `stock-frescura.spec.ts` (el porqué desde el aviso y desde la llegada, las dos pestañas, el clima al final y su botón), `stock-tablero.spec.ts` (la cuenta de la pestaña cuadra con las etiquetas «Hoy»), `stock-merma.spec.ts` y `stock-compra.spec.ts` adaptadas a las pestañas. Sin scroll horizontal y sin controles de menos de 48 px en las dos pestañas. Tipos, lint y Knip limpios. Capturas en `docs/formidable/capturas/stock-dos-pestanas-2026-11-14/`.
- **Sin probar:** el escritorio (1280 px) no se revisó en el navegador en esta actividad; la estructura de dos columnas es la misma que había.

## Actividad 6 · El aviso de la noche y la pregunta por voz (se adelantó a la 5)

- **Por qué se adelantó:** la actividad 5 (que Claude Sonnet estime cuánto aguanta cada fruta) no se puede probar todavía: en esta máquina no hay clave de Anthropic. La 6 no depende de ella.
- **Qué cambió:** el cron de las 7 p. m. manda, después del resumen del día, un segundo aviso si hay fruta que tiene que salir mañana: «Mañana tienen que salir 18 cajas · Mango Kent (12) y Papaya (6). Hoy hizo 30°.», que abre Stock (`avisoDeFrescura` en `lib/push-reglas.ts`). Lleva su propia etiqueta para no reemplazar al resumen, sale aunque el día no haya tenido ventas, y no sale si no hay nada por salir. Por voz se puede preguntar «¿qué tiene que salir hoy?» (consulta `que_sale_hoy`): responde con las cajas de hoy, fruta por fruta, lo de mañana aparte, y lo dice en voz alta.
- **Cómo se verificó:** Vitest 716 (`push-reglas`, `resumen-diario`, `consultas-reglas`). Playwright: `voz-consulta.spec.ts` a 412 y 360 px (la respuesta sale de la base por la misma cuenta que Stock) y `push-cron.spec.ts` contra el servicio de avisos simulado (cada teléfono recibe el resumen y después el de frescura, cifrados y con temas distintos; al que caducó o falló no se le manda el segundo). Tipos, lint y Knip limpios; invariantes en orden.
- **Caída externa:** si no se puede leer lo que tiene que salir, el resumen del día sale igual y queda registrado.

## Actividad 5 · Claude Sonnet estima cuánto aguanta cada fruta — sin hacer

- Falta la clave de Anthropic (`ANTHROPIC_API_KEY`) en `.env.development.local` de este worktree, y después en Vercel. Sin ella no se puede probar ni una llamada real, y una integración de pago no se da por hecha sin verla responder.
- Hasta entonces el aviso funciona con la tabla de referencia de `lib/vida-util-reglas.ts`.
- Tampoco está «Sigue buena» (la maqueta lo mostraba junto a «Se malogró»): es la señal que le falta a la estimación para corregirse cuando avisa antes de tiempo.

## Pendiente

- **Sin probar: `/voz-precision`.** El prompt ganó tres reglas (la temperatura, cómo llegó la fruta y la pregunta de qué sale hoy), una herramienta, un campo en la compra y la consulta `que_sale_hoy`; hay 8 casos nuevos en `tests/interprete/casos.json` (70 en total). No se pudo medir contra el modelo real porque este worktree no tiene la clave de Groq en `.env.local`. Hay que correrlo antes de fusionar.
- **`/formidable` y `/chaos`** no se corrieron: faltan sobre Stock en dos pestañas, la hoja «¿por qué?», la tarjeta de la temperatura, el pedido en «Hoy» y «¿Cómo llegó?» en la compra. Son obligatorias antes de dar la obra por cerrada.
- Este worktree no tenía las claves locales del aviso (VAPID y el secreto del cron): se generaron con `scripts/generar-claves-push.mjs --archivo .env.development.local` solo para probar. No se versionan.
- **Las dos migraciones no están aplicadas al proyecto de Supabase:** se pregunta antes, y al aplicarlas cada archivo toma la versión que asigne.
- Los factores de «cómo llegó» (verde 1.4, maduro 0.5) y la lista de frutas que maduran en la caja (`lib/vida-util-reglas.ts`) son valores de referencia, no medidos en el puesto.
- La base local es una sola para todos los worktrees. Para correr pgTAP hubo que hacer `db reset`, que quita el catálogo real y la historia de demo: se vuelven a cargar con `scripts/demo/*.sql`.
- `components/voz/VozHoy.tsx:131` tiene un aviso de lint anterior a esta obra (`react-hooks/exhaustive-deps`).
- `tests/e2e/stock-compra.spec.ts:206` («respuesta perdida al confirmar») falla a los dos anchos desde antes de esta obra; ya estaba anotado en la bitácora del 12-11 (viene de la cola sin conexión).
- `tests/e2e/stock-tablero.spec.ts:69` falla a los dos anchos desde antes de esta obra: inserta cajas con fecha de hace 10 días, y desde `20261112190000_fecha_del_celular` la base cambia una fecha de más de 48 horas por la de ahora, así que nunca aparece «Sin movimiento». Hay que insertar y después mover la fecha, como hace `stock-frescura.spec.ts`.
- Las llegadas solo cubren las entradas de los últimos 45 días (`lib/inventario.ts`). Si el stock es mayor que esas entradas, lo que sobra es más viejo y no entra en la cuenta ni en el aviso.
