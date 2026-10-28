# 2026-10-28 · Sesión, roles y marco (A2) y cierre de A1

**Qué cambió:**
- **Piezas `Aviso`, `Vacio`, `Espera` y `Campo`.** `Espera` es el único indicador de guardado y bloquea un segundo toque.
- **Entrar y salir (`/login`):**
  - `proxy.ts` renueva la sesión y no saca a nadie por una caída de red;
  - «Salir» cierra solo ese dispositivo;
  - toda llamada a Supabase tiene un tope de 8 s;
  - registro público cerrado en local (`[auth] enable_signup = false`).
- **Marco `(app)`:** guarda de sesión en el servidor, barra inferior de vidrio con 4 destinos, menú en una hoja (Cierre del día,
  Ajustes, Salir) y un estado vacío en cada destino hasta su actividad.
- **Guardas por rol:** `lib/permisos-reglas.ts`, con su prueba. `/ajustes` y `/cierre` rechazan en el servidor, y una cuenta sin
  perfil ve cómo pedir acceso.
- **Cuentas por enlace de invitación** (ADR-0009): `pnpm cuentas:invitar`, `/auth/confirmar` y `/login/clave`.
- **Seed:** 4 cuentas de prueba (una por rol) y una cuenta sin perfil.

- **Despliegue en Vercel** (`https://fructus-neon.vercel.app`). `vercel.json`:
  - fija la región de las funciones en São Paulo (`gru1`), junto a la base (`sa-east-1`); por defecto era Washington;
  - con `git.deploymentEnabled` solo despliega `main`: las ramas y PR no intentan previews. Con `ignoreCommand`, Vercel igual lo
    intentaba y lo bloqueaba porque quien firma los commits no es miembro del equipo Vonatur (plan Hobby).

**Cómo se verificó:**
- **Código:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (11 pruebas) y `pnpm knip`, en verde.
- **Base:** `npx supabase test db` (18) y `pnpm db:invariantes` (12), en orden.
- **e2e a 412 y 360 px:** 38 pruebas en verde, en varias vueltas seguidas. Cubren:
  - sin sesión;
  - clave equivocada;
  - los 4 roles y la cuenta sin perfil;
  - la navegación;
  - la invitación de punta a punta.
- **Peso de JavaScript:** `pnpm medir:js` da 167.1 KB en `/login` y 177.1 KB en «Hoy» con sesión, contra un tope de 180.

**Pendiente:**
- **El tope de JavaScript:** «Hoy» está al 98 %. Cargar la hoja del menú recién al tocarlo (`components/marco/MenuMas.tsx:30`,
  con `next/dynamic`) antes de sumar el botón de voz en A3.
- **Un toque mientras React se monta:** en desarrollo, un envío del login que llega justo durante ese momento a veces no se completa
  (`app/login/FormularioEntrar.tsx:17`). Medirlo con la versión de producción en un Android de gama media.
- **Contador sin botón de voz y ayudante sin «Anular»:** la regla ya existe (`permisosDe`); se conecta en A3 y A6.
- **Cuentas reales:** la app ya está publicada. Falta fusionar este PR y correr `pnpm cuentas:invitar` (la primera: la hija del dueño,
  como administradora).
