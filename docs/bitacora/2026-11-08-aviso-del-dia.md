# 2026-11-08 · Aviso del día (Web Push) y «Enviar por WhatsApp» en el cierre

Rama `claude/resumen-push`. Alcance de la demo («resumen diario por Web Push y botón Enviar por WhatsApp»). ADR-0013.

- **Qué cambió:**
  - «Cierre del día» tiene el botón **Enviar por WhatsApp**: un enlace `wa.me` con el cierre ya escrito (la persona elige a quién; no envía nada solo y no suma JavaScript). Un día en cero no lo ofrece.
  - El menú «Más» tiene la fila **Aviso del día**: un interruptor que pide el permiso, suscribe el teléfono y manda un aviso de prueba. Dice qué pasa en iPhone sin instalar, con el permiso bloqueado, y no aparece si el navegador no tiene avisos.
  - Un cron de Vercel (`/api/cron/resumen-diario`, 7 p. m. de Lima, dentro de la hora en Hobby) manda a cada teléfono activo «Vendiste S/ … hoy · Cobraste … · Te deben …». Sin ventas ni abonos, no avisa. Tocarlo abre el cierre.
  - Tabla nueva `suscripciones_push` (migración `20261108212500_avisos_push.sql`, **SQL por aplicar al proyecto: necesita OK**): solo la toca el servidor, nunca se borra (se desactiva con su fecha).
- **Decisiones (QUÉ / POR QUÉ / QUÉ SE ROMPERÍA SIN ESTO):**
  - *7 p. m. de Lima, una vez al día:* el puesto ya cerró y Hobby no deja más de un cron diario. Se cambia en `vercel.json` (hay una prueba que ata esa hora a `HORA_DEL_AVISO_LIMA`). Sin esto el aviso saldría en otra hora que lo que dice la pantalla.
  - *Solo direcciones de servicios de avisos conocidos:* el servidor manda un POST a la dirección que trae el navegador; sin la lista, cualquiera con sesión lo haría apuntar a donde quisiera. La prueba con Chrome de verdad mostró que da `jmt17.google.com` además de `fcm.googleapis.com`: sin esa prueba, parte de los Chrome habrían fallado al activar.
  - *La tabla no se lee desde el navegador:* la dirección es la llave del teléfono. «Activado» sale del propio teléfono.
  - *Un día sin ventas ni abonos no avisa:* ruido.
- **Cómo se verificó:**
  - Vitest: 409 pruebas (84 nuevas): el mensaje del cierre y su enlace; las reglas del aviso; **el cifrado de verdad** (el «teléfono» de la prueba descifra lo que sale del servidor y se mira la firma VAPID, el vencimiento y el tema); el orquestador del cron (día de Lima, caducadas, fallas, de a 5 a la vez); la guarda del cron en tiempo constante; y `public/sw.js` corrido con un navegador de mentira (qué muestra, qué hace al tocarlo, destinos de afuera).
  - pgTAP `13_suscripciones_push` (16): RLS sin políticas, nadie con sesión la lee ni la escribe, dirección única (otro usuario en el mismo teléfono la hereda), `https`, claves con forma, «activa» sin fecha de baja. `05_funciones_sin_anon` sigue en verde (no hay función nueva).
  - e2e (412 y 360 px): `cierre-whatsapp` (8) — el mensaje trae las mismas cifras de la pantalla, el botón mide 56 px; `push-menu` (30) — activar con un navegador simulado, la base, el aviso de prueba descifrado, apagar, reactivar, doble toque, «No permitir», iPhone, rollback si el servidor rechaza, y **el ataque de `/chaos`**: se corta la señal justo al guardar (encontró un defecto: la acción lanzaba, la pantalla no decía nada y el teléfono quedaba con una suscripción que el servidor no conocía; arreglado), se corta al apagar (sigue activado y lo dice) y la sesión vence con el menú abierto; `push-cron` (3) — la ruta de punta a punta contra la base local y un servicio de avisos simulado (401/405 sin secreto; llega a quien corresponde y no a una cuenta desactivada; lo que descifra cada teléfono es lo que dice `resumen_dia()`; 410 → desactivada; 503 → anotada y sigue activa).
  - **e2e de producción** (`tests/e2e-produccion/aviso-del-dia.spec.ts`, app compilada y service worker real): le llega un aviso (por el protocolo de depuración) y lo muestra con su título, texto, etiqueta y destino; si llega ilegible, muestra el genérico. **Con el servicio de avisos de Google de verdad** (`PUSH_REAL=1`, Chromium con perfil normal): activar desde el menú → el servidor manda el aviso de prueba con `web-push` → Google lo entrega → el service worker lo muestra → apagar lo desactiva.
  - Se rompió a propósito la lista de servicios (fallan las pruebas de rechazo) y el filtro de cuenta activa del cron (la prueba e2e falla): las pruebas lo ven.
  - JS de «Hoy»: **151.6 KB brotli** (tope 180); abrir el menú baja 40.9 KB más (la hoja y la fila del aviso, en diferido).
  - Invariantes: la migración no toca dinero, stock ni comprobantes.
  - Capturas a 412 y 360 px: `docs/formidable/capturas/aviso-del-dia-*` y `cierre-whatsapp-*`.

## Pendiente
- **Aplicar la migración al proyecto** (necesita OK) y después correr `get_advisors`: se espera el aviso «RLS activada sin políticas» de `suscripciones_push`, a propósito (igual que `series_comprobante`). Regenerar `lib/supabase/tipos-db.ts` no hace falta: ya está.
- **Configurar las variables en Vercel y en `.env.local`:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (un correo `mailto:` o la dirección https de la app) y `CRON_SECRET`. Se generan con `pnpm push:claves` (imprime; no pegarlas en un chat). Sin ellas, la fila no aparece y el cron contesta 503.
- **Probar en un teléfono real:** que el aviso se vea en la pantalla de bloqueo, en el S25 y en un Android de gama media con ahorro de batería, y en iPhone con la app instalada (solo ahí Safari manda avisos). Ninguna prueba de aquí lo ve.
- **Si el navegador renueva la suscripción** (`pushsubscriptionchange`), el teléfono deja de recibir hasta volver a tocar el interruptor: raro; si pasa, el service worker debería re-suscribir.
- **Ícono pequeño del aviso en Android (`badge`):** falta dibujar uno monocromo (hoy sale el de Chrome).
- **`/formidable` quedó en la pasada rápida** (solo mide); falta la prueba a ciegas de la fila «Aviso del día» y del botón «Enviar por WhatsApp».
- **Desborde a 360 px en el resumen del cierre (ya existía, ver `2026-11-08-exportar-excel.md`):** el botón de WhatsApp tiene su propia columna y no lo hereda.
- **Las pruebas de Playwright cargan la base local de datos de prueba:** `supabase test db` falla en `08_gasto_por_voz` (cuenta los gastos «cargador» de toda la tabla y la base local tiene los de corridas anteriores) y `marco.spec.ts` «la barra de abajo…» sigue fallando por la cantidad de clientes acumulados. Ninguno viene de este cambio; `npx supabase db reset` los deja limpios (no se hizo: otras sesiones comparten esa base).
- **Conflicto esperado con el PR del Excel (#21):** los dos tocan `app/(app)/cierre/page.tsx` (el envoltorio de columna única). Se resuelve dejando `PanelCierre`, `EnviarCierre` y la tarjeta del Excel dentro del mismo `grid grid-cols-1`.
