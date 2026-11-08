# 2026-11-08 · PWA instalable, pantalla fija y una app más liviana

Pedido del dueño del proyecto, antes de seguir con la facturación de Lucode: que se pueda instalar en cualquier teléfono, que la pantalla quede fija (sin zoom)
y que sea fluida, rápida y gaste poco. Rama `claude/pwa-fluidez`. Decisiones en ADR-0011 (PWA) y ADR-0012 (movimiento y vidrio).

## 1 · Instalar la app (`069329b`)
- **Qué cambió:** manifest, íconos del orbe de Aurora (`pnpm iconos`), metadatos de iPhone, el proxy deja pasar sin sesión lo que el navegador pide sin cookies, y «Instalar la app» en el menú «Más»
  (abre el diálogo donde el navegador deja; en iPhone dice los tres pasos de Compartir; ya instalada, no aparece).
- **Cómo se verificó:** Vitest (`lib/pwa-reglas`, 9 casos), e2e a 412 y 360 px (`pwa.spec.ts`: el manifest se abre sin sesión, cada ícono existe y mide lo que dice, el navegador no ve errores de
  instalación, los tres caminos del menú y la fila ya instalada) y capturas en `docs/formidable/capturas/instalar-app-*`.

## 2 · Pantalla fija (`8b18582`)
- **Qué cambió:** viewport con escala fija, `touch-action: pan-x pan-y`, freno a los gestos de Safari, lo que se toca no se selecciona.
- **Cómo se verificó:** `pantalla-fija.spec.ts` con un pellizco de verdad (protocolo del navegador) y una página de control sin el freno, que sí se amplía.
- **Costo aceptado:** choca con WCAG 1.4.4; está dicho en ADR-0011.

## 3 · Service worker y «Sin conexión» (`d5c02f0`)
- **Qué cambió:** `public/sw.js` (solo muestra la página `sin-conexion.html` si no hay señal al abrir una pantalla; no guarda pantallas ni datos), `/sw.js` sin caché, registro solo en producción.
- **Cómo se verificó:** `pnpm e2e:prod` (compilado, base local): el service worker toma el control, guarda solo la página sin conexión y el ícono, sin señal se ve «Sin conexión» y una consulta falla en vez de
  devolver algo guardado, al volver la señal la pantalla se abre sola.

## 4 · Movimiento liviano (`97d137e`) y 5 · velocidad (este commit)
- **Qué cambió:** orbe, resplandor, punto del gráfico, pulso de stock y fondo de la barra mueven solo `transform` y `opacity`; `vidrio` ya no desenfoca (solo `vidrio-desenfocado`, en lo que flota); sin desenfoque en los velos; un
  `loading.tsx` por pantalla de la barra; frutas sin carga diferida; `/frutas` e `/icons` una semana de caché; `medir:js` cuenta lo que baja un teléfono.
- **Cómo se verificó:** A/B contra la versión anterior en la misma máquina, alternando (tabla en ADR-0012): «Hoy» en reposo de 805 pintados a 2 (y a 0 pasados 9 s); deslizar Ventas y Clientes gasta la mitad de CPU; abrir una hoja de 42 a 57 cuadros
  por segundo. `esqueletos.spec.ts` (compilado, con el servidor atrasado 2.5 s): el esqueleto se ve al instante.

## Pendiente
- **No se probó en un Android real** (ni en un iPhone): todo es del Chromium sin pantalla. Antes de la demo: instalarla en el S25 y en un Android de gama media y mirar la fluidez a ojo.
- **Los números del hilo principal bailan con la carga de la máquina** (hasta 3× entre rondas): por eso las comparaciones alternan las dos versiones.
- **La primera corrida de `marco.spec.ts` en un worktree nuevo falla** por la compilación en frío del servidor de desarrollo (pasa a la segunda). Dos pruebas más (`ventas-detalle`) comparan contra totales globales y fallan si las dos pantallas corren a la vez.
- **El cuadro «Hoy» sigue con el punto latiendo para siempre** (ahora sin repintar): ADR-0012 lo permite; si aun así se quiere quitar, es una línea.
- **El esqueleto de `loading.tsx` es genérico** (encabezado y tres tarjetas); cada pantalla ya pone el suyo con su forma al cargar sus secciones.
- **Si un usuario con baja visión necesita ampliar,** el tamaño se sube en los tokens, no con el zoom (ADR-0011).
