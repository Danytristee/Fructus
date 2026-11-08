# ADR-0011 — La app se instala en el teléfono, no se amplía, y avisa cuando no hay señal

**Fecha:** 2026-11-08 · **Estado:** aceptado

## Contexto

El dueño usa Fructus de pie, con una mano, a pleno sol. Pidió tres cosas: que se pueda instalar como una app en cualquier teléfono, que la
pantalla quede fija (sin ampliar ni achicar con los dedos) y que sea rápida y liviana. Hasta ahora no había nada de PWA: ni manifest, ni íconos,
ni service worker (ADR-0006 lo dejó escrito como decisión, no como código).

## Decisión

1. **Instalable.** `app/manifest.ts` (id `/`, `standalone`, vertical, colores del `--fondo` de Aurora, atajos a Clientes, Stock y Ventas) y
   íconos del orbe de voz en `public/icons/` (192 y 512, «any» y «maskable»), `app/apple-icon.png` (iPhone) y `app/icon.png` y `favicon.ico`
   (pestaña). Los dibuja `scripts/generar-iconos.mjs` (`pnpm iconos`). El color de fondo que vive fuera del CSS está en `COLOR_DE_FONDO`
   (`lib/pwa-reglas.ts`) y una prueba falla si se separa de `--fondo`.
2. **El proxy deja pasar sin sesión** el manifest, `sw.js`, los íconos y `sin-conexion.html`: el navegador los pide sin cookies y, redirigidos al
   login, el teléfono decía «no se puede instalar».
3. **El botón «Instalar la app»** vive en el menú «Más». Chrome, Edge y Samsung Internet avisan con `beforeinstallprompt` (se guarda al
   cargar la página, no al abrir el menú) y el botón abre su diálogo con un toque. Safari en iPhone no tiene ese diálogo: ahí el botón dice los
   tres pasos de Compartir. Ya instalada, no aparece. La lógica de qué ofrecer es pura (`lib/pwa-reglas.ts`).
4. **Pantalla fija.** El viewport fija la escala en 1 (`maximum-scale=1`, `user-scalable=no`); `touch-action: pan-x pan-y` en `html` frena el
   pellizco y el doble toque; `PantallaFija` cancela los gestos de Safari, que ignora `user-scalable=no` desde iOS 10. Lo que se toca
   (botones, enlaces, la barra) no se selecciona ni abre «copiar enlace»; los campos y las fichas sí se pueden seleccionar.
5. **Service worker mínimo** (`public/sw.js`, escrito a mano como pide ADR-0006). Hace una sola cosa: si al abrir una pantalla no hay señal (o
   el servidor no contesta en 12 s), muestra `sin-conexion.html` en vez de la página de error del navegador. **No guarda pantallas ni datos**
   (una venta, una deuda o un stock viejos no deben pasar por de ahora: principios 2 y 8), **no toca `_next/static`** (lleva el hash en el nombre
   y el navegador ya lo guarda para siempre) y **no intercepta nada que no sea abrir una pantalla**. Usa la precarga de navegación para no perder
   tiempo al despertar. Se registra solo en producción y `/sw.js` sale sin caché para que un cambio llegue a los teléfonos.
6. **Se prueba compilado.** El service worker no corre en desarrollo, así que `pnpm e2e:prod` compila contra la base local
   (`scripts/entorno-local.mjs`) y corre `tests/e2e-produccion/`. Se niega a correr si la base no es local: `.env.local` apunta al proyecto de verdad.

## Alternativas descartadas

- **Cachear el HTML o las respuestas para abrir sin señal:** muestra datos viejos como si fueran de ahora. La cola completa sin conexión es de la fase 2.
- **Serwist o `next-pwa`:** ya descartados en ADR-0006; para una sola función no hace falta una librería.
- **Prohibir el zoom solo con el viewport:** iPhone lo ignora; sin el freno a los gestos, el pellizco sigue ampliando.
- **Un botón «Instalar» único para todos:** en iPhone no puede hacer nada. Mejor decir los pasos que prometer un botón que no existe.

## Consecuencias

- **Accesibilidad:** impedir el zoom choca con el criterio WCAG 1.4.4 (cambiar el tamaño del texto). Se acepta por pedido expreso, y se compensa con el texto base de 17 px o más
  y las cifras de 28 px o más (`CLAUDE.md`, «Celular primero»). Si algún usuario con baja visión lo necesita, el tamaño se sube en los tokens, no con el zoom.
- Una instalación nueva trae el service worker sin pedir nada; una versión nueva reemplaza a la vieja al abrir la app.
- En fase 2, `sw.js` es el lugar de la cola del último audio y de las notificaciones (Web Push).
- Instalar en iPhone depende de Safari (o de «Añadir a pantalla de inicio» de otros navegadores desde iOS 16.4): la app solo puede explicarlo.
