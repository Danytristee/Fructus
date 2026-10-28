# ADR-0009 — Las cuentas se crean con un enlace de invitación, sin correo

**Fecha:** 2026-10-28 · **Estado:** aceptado

## Contexto

En Fructus nadie se registra solo: el registro público está apagado en el proyecto y en local. Las cuentas del dueño, los ayudantes y
el contador las crea quien administra. Hacía falta una forma de entregar el acceso que cumpla tres condiciones:

- **ninguna contraseña viaja por el chat, por un archivo ni por un log** (`CLAUDE.md`, «Seguridad y claves»);
- **no depende de un servicio de correo:** el correo gratuito de Supabase solo envía a los miembros del equipo del proyecto, y uno
  propio (SMTP) sería un servicio nuevo;
- **llega a un dueño que vive en WhatsApp.**

## Decisión

- `pnpm cuentas:invitar <correo> "<nombre>" <rol>` (`scripts/invitar.mjs`, con la secret key que sale de `.env.local`) hace tres cosas:
  - crea la cuenta con `auth.admin.generateLink({ type: "invite" })`, o pide un enlace `recovery` si la cuenta ya existía;
  - guarda su `perfil` con el rol;
  - **imprime un enlace de un solo uso**, que vence en 1 hora y se envía por WhatsApp.
- El enlace lleva a `/auth/confirmar`, que canjea el `token_hash` por una sesión con `verifyOtp`. Luego lleva a `/login/clave`, donde
  la persona elige su clave (8 caracteres como mínimo).
- **Un enlace vencido, usado o inventado** lleva a `/login?enlace=vencido`, con el aviso «Ese enlace ya no sirve».
- El mismo comando sirve para **reenviar el acceso** a quien olvidó su clave.
- «Salir» cierra la sesión **solo en ese dispositivo** (`signOut({ scope: "local" })`): si el dueño sale en la computadora, sigue con
  sesión en su celular.

## Alternativas descartadas

- **Invitación por correo de Supabase:** no llega fuera del equipo del proyecto sin un SMTP propio, que sería un servicio nuevo.
- **Crear la cuenta con una clave inicial y pasarla:** esa clave viajaría por el chat o por WhatsApp en texto.
- **Pantalla de alta de usuarios en Ajustes:** es lo correcto a futuro (A12), pero hoy sería una pantalla más para 3 cuentas.

## Consecuencias

- El enlace es una credencial por una hora. Lo genera y lo envía quien administra, nunca un asistente en un chat.
- Necesita que la app esté publicada (`SITIO_URL`): sin una dirección pública, el enlace no abre en el celular.
- Cuando Ajustes tenga la gestión de usuarios (A12), usará esta misma lógica desde el servidor.
