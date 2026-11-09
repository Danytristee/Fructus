-- Aviso del día por Web Push (fase 2 de la demo): dónde mandar el resumen a cada teléfono que lo pidió.
--
-- El problema: para avisarle a un teléfono sin que tenga la app abierta, el navegador le da a la app una «suscripción»: una dirección
-- del servicio de avisos del navegador (Google, Apple o Mozilla) y dos claves para cifrar lo que se le manda. Hay que guardarla en
-- algún lado, de quién es, y saber si sigue sirviendo. Una dirección de esas es como una llave: quien la tiene puede mandar avisos a
-- ese teléfono, así que no se enseña a nadie ni se escribe en un log.
--
-- Qué cambia: una sola tabla, `suscripciones_push`, que SOLO toca el servidor (service role), igual que `series_comprobante`:
--   - RLS activada y sin políticas, y sin permisos para anon ni authenticated. Ni el dueño la lee desde el navegador: la pantalla
--     dice «Activado» porque el teléfono tiene su suscripción (pushManager), no porque la base se lo cuente.
--   - Escribe el servidor, después de comprobar con la sesión de la persona quién es y qué rol tiene. Así la regla de qué direcciones
--     se aceptan (solo los servicios de avisos conocidos: si no, el servidor mandaría POST a donde le diga cualquiera) vive en un solo
--     lugar, en lib/push-reglas.ts, y no se puede saltar llamando a la base directo con una sesión.
--   - Una dirección es de un solo teléfono: `endpoint` es único. Si en un mismo teléfono entra otra persona, la suscripción pasa a ser
--     de ella (el servidor hace el upsert con service role; con RLS, el update de una fila ajena «no fallaría, solo no tocaría nada»).
--   - Nunca se borra: se desactiva (`activa = false`) con su fecha, y se reactiva si la persona vuelve a pedirlo. Una dirección que el
--     servicio de avisos dice que ya no existe (404/410) se desactiva sola; las demás fallas se anotan en `ultimo_error` (solo el
--     código, nunca la dirección ni datos del puesto) y se reintentan al día siguiente.
--   - Cero estados imposibles: `activa` y `desactivada_en` no pueden contradecirse (CHECK), y la dirección tiene que ser https.
--
-- Lo que NO cambia: ninguna función, ninguna política y ninguna tabla de dinero, stock o comprobantes. No hay función nueva, así que
-- 05_funciones_sin_anon.test.sql no tiene nada que vigilar aquí.

create table suscripciones_push (
  id              bigint generated always as identity primary key,
  usuario_id      uuid not null references perfiles (id) on delete cascade,
  endpoint        text not null unique check (endpoint ~ '^https://[^/\s]+/\S+$' and length(endpoint) <= 1024),
  -- Claves públicas del teléfono para cifrar el aviso (base64url, sin relleno): 65 bytes la de curva P-256 y 16 el secreto de autenticación.
  clave_p256dh    text not null check (clave_p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  clave_auth      text not null check (clave_auth ~ '^[A-Za-z0-9_-]{20,32}$'),
  activa          boolean not null default true,
  creada_en       timestamptz not null default now(),
  desactivada_en  timestamptz,
  ultimo_aviso_en timestamptz,
  ultimo_error    text check (length(ultimo_error) <= 100),
  constraint suscripcion_activa_o_desactivada check (activa = (desactivada_en is null))
);

comment on table suscripciones_push is
  'Teléfonos que pidieron el aviso del día (Web Push). Solo la toca el servidor (service role). La dirección es una llave: no se muestra ni se registra.';

alter table suscripciones_push enable row level security;
revoke all on suscripciones_push from public, anon, authenticated;
-- Explícito: no se depende de los permisos por defecto de Supabase, que pueden cambiar.
grant select, insert, update on suscripciones_push to service_role;
