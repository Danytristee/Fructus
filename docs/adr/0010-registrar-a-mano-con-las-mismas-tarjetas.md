# ADR-0010 — Registrar a mano con las mismas tarjetas, y dos reglas nuevas en la base

**Fecha:** 2026-11-05 · **Estado:** aceptado (las dos migraciones esperan el OK para el proyecto de Supabase)

## Contexto

Fructus es voz primero, pero la voz puede fallar (principio 8: Groq, la red del mercado, el ruido) y el ayudante a veces prefiere tocar.
A8 pidió que todo se pueda hacer también sin voz: abono, merma, compra, alta de cliente y anular una venta.

Hacerlo con formularios propios habría duplicado las reglas de dinero y de stock que ya viven en las tarjetas de voz (nunca asumir
contado, no guardar sin costo, al crédito exige proveedor, el doble toque, la respuesta perdida). Cada copia es un sitio donde esas
reglas pueden divergir.

El problema de fondo es el **doble guardado**. Las tarjetas de voz son idempotentes porque cada operación lleva el `comando_voz_id` de
su comando y un índice único por comando rechaza el segundo (abonos, mermas, gastos, compras, ventas). A mano no hay comando de voz.

## Decisión

1. **A mano se usa la misma tarjeta, llenada con lo que se toca.** `OperacionAMano` abre la hoja con una tarjeta vacía (o con lo que ya se
   sabe: el cliente de su ficha, la fruta de su fila) y las mismas acciones guardan, con las mismas reglas. Lo propio de «a mano» es solo
   la presentación: la tarjeta pide en vez de marcar en rojo, el monto o las cajas empiezan vacíos (nunca se inventan), y con la sesión
   vencida el aviso dice «registra … otra vez» en vez de «te espera en Hoy».
2. **Cada hoja abre un comando «a mano»** (`abrirComandoAMano`: `modelo_stt = 'manual'`, `transcripcion = '(a mano)'`). Así los índices
   únicos por comando siguen valiendo y **no hace falta migración** para que un doble toque o una respuesta perdida no dupliquen. La
   precisión de la voz se mide sin los comandos `manual`; un abono o una merma a mano cuenta como «corregido» porque nada vino de la voz.
3. **Un cliente no se crea dos veces con el mismo nombre** (`clientes_nombre_unico`: índice único sobre `lower(btrim(nombre))` entre
   clientes activos). El alta es un insert directo en una sola tabla y no tiene comando; sin el índice, un reintento creaba dos «Luis
   Paredes» y la voz ya no podía elegir uno solo. La acción trata el choque como «ya estaba» si el cliente que existe es idéntico al que se
   quiso guardar (un reintento), y dice «Ya tienes un cliente con ese nombre» si es otro.
4. **Anular una venta pide motivo y deja quién y cuándo.** `ventas` guarda `anulada_en`, `anulada_por` y `motivo_anulacion`; la restricción
   `venta_anulada_con_motivo` hace imposible una anulada sin motivo (de 3 a 200 letras) y una registrada con datos de anulación; y
   `anular_venta(id, motivo)` reemplaza a `anular_venta(id)`. Lo que no cambia: solo dueño y administrador, no se anula con comprobante
   enviado o aceptado, se devuelve el stock, todo en una transacción. Una venta anulada sigue en el historial, marcada, y no cuenta en
   los totales.

## Alternativas descartadas

- **Una clave de envío (`uuid`) en cada tabla** que la hoja genera al abrirse: es lo más «limpio», pero son cuatro columnas, cuatro índices
  y cambiar `registrar_compra`, todo con migración y OK, para resolver lo que el comando «a mano» ya resuelve con lo que existe.
- **Formularios propios por operación:** duplicarían las reglas de dinero y de stock (ver Contexto).
- **Dejar que el alta de clientes se proteja solo con un botón que se desactiva:** no cubre la respuesta perdida; es lo que el principio 3
  manda no hacer.

## Consecuencias

- Abrir una hoja a mano y cerrarla sin tocar «Descartar» deja un comando `pendiente`: inofensivo (ningún guardado lo mira), pero se acumula.
  Se pueden limpiar los `manual` pendientes de más de un día.
- Hay un hallazgo de permisos pendiente, informado por separado a quien dirige el proyecto: no forma parte de A8 y no se detalla aquí.
- La tarjeta de abono ahora admite `monto: null` (a mano arranca sin monto). La de merma usa `cantidad: 0` como «sin cajas».
- Las dos migraciones se probaron en local (`db reset` desde cero, 93 pruebas pgTAP de 11 archivos, invariantes). **No están en el proyecto
  de Supabase:** al aplicarlas se renombran a la versión real que asigne Supabase y se regeneran los tipos desde el proyecto
  (`lib/supabase/tipos-db.ts` de esta rama sale de la base local, sin el esquema `graphql_public`).
- Antes de aplicar `clientes_nombre_unico` a un proyecto con datos hay que comprobar que no haya dos clientes activos con el mismo nombre
  (la consulta está en el comentario de la migración).
