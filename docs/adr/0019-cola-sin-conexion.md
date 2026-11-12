# ADR-0019 — Lo que se confirma o se dicta sin señal se guarda en el celular y se envía solo, en orden

**Fecha:** 2026-11-12 · **Estado:** aceptado (reemplaza la parte de ADR-0011 que dejaba la cola para la fase 2)

## Contexto

En La Hermelinda la señal se cae varias veces al día. Hasta ahora, sin señal la app solo avisaba y guardaba **el último audio**: una venta
confirmada con la red colgada terminaba en «toca Confirmar otra vez», y si el dueño dictaba tres ventas seguidas sin señal, solo quedaba la última.
Se pidió que la app reconozca que no hay conexión, encole lo que se haga y, cuando vuelva, lo ingrese todo en orden sin que nadie toque nada, y
que siempre se vea cuándo no hay señal.

## Decisión

1. **Una cola en el celular (IndexedDB, `lib/cola/almacen.ts`).** Cada entrada lleva el orden en que se guardó (llave creciente) y de quién es
   (`usuarioId`: en un celular compartido, lo del ayudante no se envía con la sesión del dueño). Sobrevive a recargar, cerrar la app o quedarse sin batería.
2. **Se guardan datos, no funciones.** Tres clases de entrada (`lib/cola-reglas.ts`):
   - **confirmación**: una tarjeta (venta, abono, merma, gasto, compra) que la persona ya confirmó. **Se envía sola.**
   - **audio**: algo dictado sin señal. Se envía solo y **vuelve como tarjeta por confirmar**: nada se guarda sin que la persona vea lo que se
     entendió (principio 1). En «Hoy» aparece qué es: «Volvió la señal. Confirma tu abono de Don Lucho · S/ 50.00».
   - **por confirmar**: esa tarjeta, esperando a la persona.
3. **Reenviar es seguro porque el servidor ya era idempotente por comando** (`registrar_venta`, `registrar_compra` y el índice único de abonos,
   mermas y gastos). No hay un camino aparte: la cola llama a las mismas server actions y al mismo `POST /api/voz`. No hizo falta ninguna migración.
4. **Cuándo entra algo a la cola** (`useConfirmar`): sin señal (`navigator.onLine`), o si la señal no respondió en 15 s, o si la base no contestó.
   Antes se pedía «toca Confirmar otra vez»; ahora queda en el celular y se reintenta solo. Lo que no se puede encolar (anular, emitir un comprobante,
   guardar un cliente) sin señal dice que necesita señal, sin intentar.
5. **Registrar a mano sin señal** abre la hoja igual, con un comando negativo solo del celular. Al enviarse, la cola abre el comando de verdad y lo
   guarda en la entrada **antes** de confirmar: si después se pierde la respuesta, el reintento usa el mismo comando y no guarda dos veces.
6. **Orden.** Se envía de a una, en el orden en que se guardó. Si la base rechaza una confirmación (el cliente ya no está, sin permiso), esa queda
   marcada y **frena a las confirmaciones que vienen detrás**, hasta que la persona la descarte: el abono dado por una venta que no entró no puede
   entrar solo (principio 3). Los audios no se frenan (igual vuelven como tarjetas).
7. **Cuándo se envía** (`components/cola/ColaProveedor.tsx`, montado una vez en el layout): al volver la señal (`online`), al volver a la app, al
   cargar, y tras una falla con esperas de 5, 10, 20 s y después cada 30 s. Un solo envío a la vez, también entre pestañas (Web Locks). El
   código que envía se baja recién cuando hay algo que enviar. Con la sesión vencida se pausa y pide entrar otra vez.
8. **Siempre se ve** (`components/cola/FranjaConexion.tsx`): una franja pegada arriba, en todas las pantallas con sesión. «Sin señal» (bosque
   profundo, 15:1, icono de wifi cortado) aunque no haya nada guardado; «Enviando lo guardado… Por enviar: 2 ventas»; «La señal está débil… Lo reintento solo, sin repetir nada» (sin
   botón: «Enviar ahora» hacía temer un envío doble, /formidable 2026-11-12); «Tu sesión terminó» con «Entrar otra vez»; un rechazo en rojo
   («No entró: Abono de Don Lucho · S/ 20.00», el motivo y «Quitar de la lista»); y «Listo» unos segundos.
9. **Nada optimista.** Confirmar sin señal no muestra el sello verde: muestra «Quedó en el celular» con un icono quieto, vibra y no suena. El
   «tin-tín» y el sello siguen siendo solo para lo que la base respondió.

## Alternativas descartadas

- **Background Sync en el service worker:** las server actions no se pueden llamar con comodidad desde el SW, y en Safari no existe. El dueño
  tiene la app abierta todo el día: enviar desde la página alcanza.
- **Una ruta `/api/cola` aparte:** dos caminos para guardar lo mismo terminan guardando distinto.
- **Confirmar solos los audios dictados sin señal:** rompe el principio 1. Sin señal no se sabe qué se entendió.
- **Un error rechazado no frena nada:** más simple, pero deja entrar operaciones que dependían de la rechazada.
- **Cachear pantallas y datos para trabajar sin señal:** sigue descartado (ADR-0011): un stock o una deuda viejos no pasan por de ahora.

## Consecuencias

- **La fecha de lo encolado es la del envío,** no la del toque: `registrar_venta` usa `now()`. Si la señal se va a las 11 p. m. y vuelve al día
  siguiente, la venta cuenta para el día siguiente. Corregirlo pide pasar la hora del celular a las RPC (cambio de una regla de dinero: va aparte,
  con OK).
- Sin señal, las búsquedas de la tarjeta (otro cliente, otra fruta) no responden: se puede confirmar lo que ya vino en la tarjeta o en la ficha.
- Al montar, la cola no cambia su contexto si no cambió nada y espera a que la página termine de cargar: un contexto nuevo mientras «Hoy» llegaba
  del servidor hacía que React rearmara secciones aún sin hidratar y por un momento se veían dos veces.
- Primera carga de «Hoy»: 149.7 KB brotli (tope 180).
