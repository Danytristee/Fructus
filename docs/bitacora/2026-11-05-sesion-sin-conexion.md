# 2026-11-05 · Sesión sin conexión: una caída de la base ya no dice «cuenta no activa»

- **Qué cambió:** `exigirSesion` (`lib/sesion.ts`) registraba el error del perfil pero seguía como si no hubiera perfil: permisos vacíos y
  `CuentaInactiva` («Pídele al dueño del puesto que te dé acceso»). Ahora `lib/sesion-reglas.ts` (`estadoDelPerfil`, pura y con su prueba)
  distingue `activo`, `inactivo` (la base respondió y no hay perfil activo) y `sin-conexion` (la consulta falló o pasó el tope de 8 s).
  En `sin-conexion` `permisos` es `null`: el compilador obliga a mirarlo. El marco (`app/(app)/layout.tsx`) y las pantallas que deciden
  por el rol (Hoy, Cierre, Ajustes) muestran `SesionSinConexion` («No pudimos conectar», con «Volver a intentar»); el encabezado no dibuja
  un menú recortado. Las otras pantallas leen solo `supabase` y ya tenían su propio «No pudimos leer…».
- **Cómo se verificó:** Vitest (5 casos nuevos, 183 en total en verde al subir), tipos, ESLint y Knip. E2E `tests/e2e/sesion-sin-conexion.spec.ts`
  a 412 y 360 px: con `docker stop supabase_rest_fructus` se ve el aviso (no «cuenta no activa»), el botón queda en el tercio de abajo y,
  al levantar la API, «Volver a intentar» trae «Hoy»; en «Ajustes», dentro de la app, no dice «es solo para el dueño». Probé que la prueba
  falla con el comportamiento viejo. «Una cuenta sin perfil activo no ve la app» (`roles.spec.ts`) sigue pasando a 412 y 360 px.
  JavaScript de «Hoy»: 177.2 KB brotli. `/formidable` 8.5 → 9.1 (`docs/formidable/sin-conexion-2026-11-05.md`).
- **Entorno:** la prueba detiene el contenedor de la API de la base local, así que se salta sola con más de un worker: córrela con
  `--workers=1` y sin que otra sesión use la misma base. `PUERTO=3100 pnpm e2e …` corre el servidor de cada worktree por separado.

## Pendiente
- **Mismo error en la voz:** `app/api/voz/route.ts:30` y `sesion()` de `lib/voz/accion-servidor.ts:21` leen el perfil y, si la consulta falla,
  lo tratan como «sin permisos»: dictar sin señal puede responder «Tu cuenta no puede registrar operaciones». Arreglo parecido (error → 503 o «Revisa tu señal»).
- **Mismo error en la sesión:** si `getClaims()` falla por red, `exigirSesion` manda a `/login` aunque `proxy.ts` dejó pasar para que «la pantalla decida».
- Avisar «Sigue sin señal» cuando el reintento falla otra vez (estado de interfaz).
- Repetir la prueba ciega con el dueño.
