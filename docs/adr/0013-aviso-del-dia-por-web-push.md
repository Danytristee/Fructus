# ADR-0013 — El resumen del día llega al teléfono como un aviso (Web Push), sin servicios nuevos

**Fecha:** 2026-11-08 · **Estado:** aceptado

## Contexto

El dueño atiende con las manos ocupadas y se olvida de mirar cómo va el día. El alcance de la demo prometía «resumen diario por Web Push y
botón Enviar por WhatsApp». El aviso tiene que salir del servidor sin que la app esté abierta, no puede costar (CLAUDE.md: nada de servicios con
tarjeta, nada de la API de WhatsApp) y no puede decir cifras que no sean las de «Hoy».

## Decisión

1. **Web Push estándar**, con la librería `web-push` 3.6.7 (MPL-2.0, sin servicio detrás: cifra el aviso y lo firma con VAPID; cada navegador lo
   entrega por el servicio de su fabricante, gratis). No se usa la 4.0.0 porque salió el 2026-11-06; se actualiza con calma. El envío usa
   `fetch` con tope de 8 s y sin seguir redirecciones (la librería solo arma el pedido), y no hay clave de terceros que pagar.
2. **Una sola ruta de cron** (`/api/cron/resumen-diario`, en `vercel.json`: `0 0 * * *` = 7 p. m. de Lima). Lee el día con `resumen_dia()`
   (la misma función de «Hoy») y manda el aviso solo si hubo ventas o abonos. **En Vercel Hobby el cron corre «dentro de la hora»**, no a la
   hora exacta: en pantalla se dice «como a las 7 p. m.». Sin el secreto de Vercel (`CRON_SECRET`, comparado en tiempo constante) no hace nada.
3. **La tabla `suscripciones_push` es solo del servidor** (RLS sin políticas, sin permisos para anon ni authenticated; igual que
   `series_comprobante`). La dirección de un aviso es la llave de ese teléfono: no se lee desde el navegador ni se registra. La escribe una
   acción del servidor, con la llave de servicio, después de comprobar la sesión y el rol (los cuatro que ven el cierre).
4. **Solo se aceptan direcciones de servicios de avisos conocidos** (Google, Apple, Mozilla, Windows; `lib/push-reglas.ts`): sin esto, una
   persona con sesión haría que el servidor mande un POST a donde ella diga. La regla vive en un solo lugar (el servidor) y la base solo exige
   `https`. La prueba con un Chrome de verdad mostró que da direcciones de `jmt17.google.com` además de `fcm.googleapis.com`: ambas están.
5. **Nunca se borra:** una dirección que el servicio dice que ya no existe (404/410) se desactiva con su fecha; las demás fallas se anotan con
   su código y se reintentan mañana. Una clave del servidor mal puesta (401/403) **no** desactiva nada: se vería en rojo en el cron (502).
6. **Un aviso repetido se ve una vez:** cada aviso lleva una etiqueta del día (`resumen-AAAA-MM-DD`) y el mismo tema ante el servicio de avisos,
   así que si el cron corre dos veces el teléfono muestra uno. Vence a las 6 horas: pasado eso ya no es «tu día».
7. **Qué dice:** «Vendiste S/ 1,250.00 hoy» y, abajo, «58 cajas en 9 ventas · Cobraste S/ 1,030.00 · Te deben S/ 3,420.00». Solo cifras: ni
   nombres de clientes ni teléfonos (el aviso se ve en la pantalla de bloqueo). Tocarlo abre el cierre del día, donde está el botón «Enviar por
   WhatsApp». Un día sin ventas ni abonos no avisa: sería ruido y el dueño aprendería a ignorarlo.
8. **Se activa desde el menú «Más»** («Aviso del día»): pide el permiso dentro del toque (el iPhone lo exige), suscribe el teléfono, lo guarda y
   manda un aviso de prueba, para ver cómo llega sin esperar a la noche. Si el servidor no guarda el teléfono, se deshace la suscripción del
   teléfono (nunca un «Activado» que no avisa). Su código se baja solo al abrir el menú (ADR-0006). La clave pública llega por el servidor, no por
   una variable `NEXT_PUBLIC_`.
9. **«Enviar por WhatsApp»** es un enlace `wa.me` con el cierre ya escrito: la persona elige a quién y lo manda. No envía nada solo y no
   suma JavaScript.
10. **El service worker** (`public/sw.js`) sigue siendo escrito a mano: muestra el aviso (siempre algo: si llega ilegible, uno genérico; Chrome lo
    exige) y al tocarlo abre el cierre. El destino solo puede ser una ruta de la app, nunca una dirección de afuera.

## Variables nuevas (solo servidor; nunca en un chat ni en un archivo versionado)

`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (un correo `mailto:` o la dirección https de la app) y `CRON_SECRET`. Se generan con
`pnpm push:claves`. Van en `.env.local`, en las variables de Vercel y, si hace falta, en los secrets de GitHub. Sin ellas, la fila «Aviso del día» no
aparece y el cron contesta 503 diciendo qué falta (los nombres, no los valores). `PUSH_SIMULADOR_URL` solo la usan las pruebas y solo se acepta si
apunta a esta misma máquina.

## Alternativas descartadas

- **La API de WhatsApp para mandar el resumen solo:** cobra por cada mensaje que inicia la empresa (CLAUDE.md). Se deja el enlace `wa.me`.
- **Un servicio de avisos de terceros (OneSignal, Firebase Cloud Messaging directo):** una cuenta, una clave más y datos del puesto en otro lado,
  para algo que el estándar ya hace gratis.
- **Que el navegador lea la tabla para decir «Activado»:** abre la tabla de llaves a la sesión. El estado sale del propio teléfono.
- **Una función de base `guardar_suscripcion`:** con `security definer` podía llamarse desde el navegador con una dirección inventada; como acción del
  servidor, la regla de qué direcciones valen no se puede saltar.
- **Avisar siempre, aunque no haya ventas:** ruido.

## Consecuencias

- **Probado de punta a punta con el servicio de avisos de Google** (Chromium con perfil normal, la app compilada, el service worker real): activar
  desde el menú manda el aviso de prueba, Google lo entrega y el service worker lo muestra (`PUSH_REAL=1 pnpm e2e:prod`). **No se probó en un
  teléfono real:** ni el aviso en la pantalla de bloqueo, ni Android con ahorro de batería, ni Safari en iPhone.
- Si el navegador cambia la suscripción por su cuenta (`pushsubscriptionchange`), el teléfono deja de recibir hasta que se vuelva a tocar el
  interruptor. Es raro; si pasa en el puesto, el service worker debería re-suscribir.
- Chrome no deja usar avisos en incógnito, y un teléfono con «ahorro de datos» extremo puede demorarlos: el aviso es una comodidad, el cierre
  sigue en la app.
- Hobby limita el cron a una vez al día y sin hora exacta. Para otra hora o más avisos (por ejemplo, uno por la mañana con el stock), hay que
  pasar a Vercel Pro o a un cron externo gratuito que llame a la misma ruta con el secreto.
- El ícono pequeño del aviso en Android (`badge`) todavía es el de Chrome: falta dibujar uno monocromo.
