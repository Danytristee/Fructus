# Fructus — reglas del proyecto

Este archivo define cómo se trabaja en este repo, con Claude Code o con cualquier otra herramienta. **Léelo completo antes de tocar código.**
Si una skill, una plantilla o una costumbre de afuera choca con lo que dice aquí, **gana este archivo**. Si algo de aquí ya no sirve, se
cambia aquí, con su razón y su ADR (`docs/adr/`). No se ignora en silencio.

Fructus es un ERP **por voz** para un mayorista de frutas de La Hermelinda (Trujillo, Perú). Vende por jabas, entre 20 y 60 ventas al día,
casi siempre a clientes que vuelven y mucho al crédito (hoy lo anota en un cuaderno). El dueño atiende con las manos ocupadas: **el
producto es el celular y la voz**. La versión de escritorio existe para quien revisa: un administrador o el contador.

**Fase actual: demo para un proyecto universitario, en 2 semanas.** Tiene que ser usable de verdad, con datos reales del puesto, y la
facturación va a sandbox. Si se aprueba, se implementa con el empresario (ver «Antes de producción»).

## Para quién es

| Usuario | Qué hace | Dónde y cómo |
|---|---|---|
| **Dueño** | Vende, cobra, compra, pregunta | Samsung Galaxy S25 Ultra, de pie en el puesto, a pleno sol, con ruido moderado y las manos ocupadas. Usa bien WhatsApp y Yape. |
| **Ayudante** (1 o 2) | Registra ventas, abonos y mermas | Android de gama media, mismas condiciones |
| **Administrador** (futuro) | Revisa todo en detalle | Escritorio |
| **Contador externo** | Lee y exporta el mes | Escritorio, solo lectura |

## Los 12 principios (no negociables)

Adaptados de los de CAYLA Retail, que ya probaron su valor allá.

1. **La voz propone, la persona confirma.** Nada se guarda sin un toque de confirmación. La tarjeta muestra lo que se *entendió*, no la transcripción.
2. **Nunca se inventa dinero.** Si no dijo el precio, se sugiere el último y se marca «sugerido». Si no dijo si pagó, se pregunta con dos botones (**Pagó** / **Lo debe**). Nunca se asume contado.
3. **Cero estados imposibles.** Si el stock o una deuda pueden quedar en un estado imposible, el diseño está mal, no el código. Se corrige el esquema, la RLS o la RPC; no se parcha con una validación después.
4. **Una sola fuente de verdad.** Stock = suma de `movimientos_stock` (solo se agregan filas). Deuda = ventas al crédito − abonos. Nada de eso se edita a mano: se corrige registrando un movimiento nuevo o anulando.
5. **La fruta se malogra.** La merma es un comando de primera clase, no un ajuste escondido.
6. **Celular primero, de verdad.** Se diseña y se prueba a 360–412 px antes que a cualquier otro ancho. El escritorio se adapta; no manda.
7. **Diseño excelente o no está terminado.** Una pantalla que funciona pero se ve mal, se lee mal al sol o pide más de dos toques no está lista (ver «Diseño»).
8. **Todo puede fallar.** Groq, Gemini, Lucode, Supabase y la red del mercado pueden no responder ahora mismo. La app se degrada con gracia, dice qué pasó en lenguaje de puesto y nunca pierde lo que la persona dictó.
9. **Simplicidad radical.** Muchas piezas pequeñas y componibles, no una pieza que «hace todo». Diseña para 60 ventas al día, no para un supermercado.
10. **Pasos verificables.** Nada se construye en un salto de fe: cada paso se demuestra funcionando, en el navegador a ancho de celular, no solo con build y lint.
11. **Cada decisión estructural se documenta.** Va en un ADR, en este archivo o en el comentario de la migración, nunca solo en un chat.
12. **Causa raíz, no parches.** Si algo es lento o frágil, se diagnostica hasta el fondo.

## Reglas de ejecución (autonomía)

- **Se ejecuta directo, sin pedir permiso:** código, componentes, pruebas, refactors dentro de lo que se está construyendo, migraciones en la base local.
- **Se detiene y se confirma antes de:**
  - aplicar una migración al proyecto de Supabase;
  - cambiar una regla de dinero, stock, permisos o comprobantes;
  - emitir contra un ambiente de SUNAT o Lucode que no sea sandbox;
  - borrar datos;
  - una decisión que afecte a más de un módulo;
  - agregar una dependencia de pago o un servicio nuevo.
- **Nunca se borran datos.** Se anula o se marca inactivo. No hay `delete` en `movimientos_stock`, `ventas`, `abonos` ni en catálogos con historial.
- **Al frenar una decisión riesgosa:** firme pero tranquilo. Se explica el porqué y el costo, se propone la ruta más sólida y la decisión final es de quien dirige el proyecto.

### Protocolo de pregunta

Antes de preguntar, pasa este test (lo hace cumplir `/decide`):
1. ¿La respuesta **no** vive ya en el repo, el esquema, los ADR o la bitácora?
2. ¿Elegir mal cuesta más que deshacerlo en menos de 30 minutos?
3. ¿Depende de cómo opera el negocio, y no de cómo funciona Postgres o Next.js?

Si no pasa el test, **decide tú**, ejecuta y explícalo en 3 líneas: **QUÉ HICE / POR QUÉ ASÍ / QUÉ SE ROMPERÍA SIN ESTO**.
Si pasa el test, pregunta con un máximo de 3 opciones. Cada opción lleva **Ganas / Pagas** y un ejemplo real del puesto (nunca `foo`/`bar`).
Termina con tu recomendación y con «si no respondes, ejecuto [X]».

## Stack (costo 0)

Versiones mínimas: se instala la última estable dentro de esa línea, y el lockfile manda.

| Capa | Elección | Por qué |
|---|---|---|
| Runtime | **Node 24 LTS** (`.nvmrc`), **pnpm 10** | Igual que CAYLA Retail. pnpm es rápido y estricto con las dependencias. |
| Framework | **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript 5** en modo `strict` | Server Components por defecto: menos JavaScript en un Android de gama media. |
| Estilos | **Tailwind CSS 4**, tokens en `app/globals.css` (`@theme`) | Una sola fuente de colores, tipografía y espacios. |
| Piezas de interfaz | **shadcn/ui** (sobre Radix y Tailwind) como código fuente en `components/shadcn/`, envuelto por las piezas de Fructus en `components/ui/` | El código se copia al repo, no es una dependencia: accesibilidad resuelta y estética propia con los tokens (ADR-0005). |
| Iconos | **lucide-react** | Un solo set, trazo uniforme. |
| Validación | **Zod 4** | Toda salida del LLM, todo formulario y todo cuerpo de API se valida con un esquema antes de usarse. |
| Datos y login | **Supabase** (Postgres 17 + Auth + RLS) con `@supabase/ssr` y `@supabase/supabase-js` | Ver «Base de datos». |
| Voz a texto | **Groq** `whisper-large-v3-turbo` | Nivel gratuito real, rápido, acepta prompt de vocabulario. |
| Interpretación | **LLM en Groq** con tool calling; **Gemini Flash** de respaldo | `temperature: 0`, `tool_choice: "required"`. Ver `docs/interprete-voz.md`. |
| Respuesta hablada | **Web Speech API** (`speechSynthesis`) | Viene en el navegador, gratis. |
| Comprobantes | **Sandbox de Lucode** (apisunat.pe) | Plan B gratis: servicio BETA de SUNAT con credenciales MODDATOS. |
| PWA | `app/manifest.ts` de Next + un service worker mínimo en `public/sw.js` | Se instala como app; Web Push para el resumen del día. |
| Excel | **SheetJS**, instalado desde su CDN oficial (`https://cdn.sheetjs.com/`) | El paquete `xlsx` de npm está congelado en una versión vieja. |
| Pruebas | **Vitest 4** (lógica pura), **Playwright** (de punta a punta a ancho de celular), **pgTAP** con `supabase test db` (la base) | Ver «Calidad». |
| Calidad | **ESLint 9** (`eslint-config-next`), **Knip** (código muerto) | Igual que CAYLA Retail. |
| Hosting | **Vercel Hobby** | Solo uso no comercial: sirve para la demo. Para producción, Cloudflare o Vercel Pro. |

**No se usa, salvo un ADR que lo justifique:**
- ORM (Prisma, Drizzle): las consultas van al cliente de Supabase y las operaciones de varias tablas, a RPC.
- Kits visuales completos que se instalan como dependencia (MUI, Chakra, Mantine). shadcn/ui sí, con las reglas de ADR-0005.
- Librerías de estado global (Redux, Zustand): alcanza con Server Components, `useState` y la URL.
- CSS-in-JS.
- La API de WhatsApp (cobra por los mensajes que inicia la empresa).
- Cualquier servicio con tarjeta de crédito obligatoria.

## Estructura del código

Una sola app de Next.js en la raíz. **No es un monorepo:** CAYLA Retail lo necesita porque tiene dos apps; aquí sería ceremonia (ADR-0003).
La organización interna sí es la de CAYLA Retail, porque está probada.

```
app/
  (app)/                rutas con sesión
    page.tsx            «Hoy»: botón de voz + resumen del día (la pantalla del dueño)
    clientes/           cuaderno: quién debe, ficha del cliente, abonos
    stock/              jabas por fruta, mermas, compras
    ventas/             historial, anular, comprobante
    cierre/             cierre del día, exportar mes (escritorio también)
    ajustes/            catálogo, usuarios y roles (solo dueño/administrador)
  login/
  api/
    voz/route.ts        audio → transcripción → interpretación (solo servidor)
    comprobantes/       emitir y reintentar en sandbox (solo servidor)
    salud/route.ts      consulta real a la base, para el ping y para diagnosticar
  manifest.ts  layout.tsx  globals.css
components/
  ui/                   UNA pieza por función: Boton, Hoja, Tarjeta, Campo, Monto, Insignia, Aviso, Vacio, Espera
  shadcn/               lo que genera `shadcn add` (button.tsx, sheet.tsx…); solo lo importa components/ui/
  voz/                  BotonVoz, TarjetaConfirmacion, EstadoVoz
  <dominio>/            ventas/, clientes/, stock/ …
lib/
  supabase/             servidor.ts (import "server-only"), navegador.ts, tipos-db.ts (generado)
  voz/                  stt.ts, interprete.ts, esquemas.ts (Zod), resolver.ts
  comprobantes/         lucode.ts (import "server-only")
  formato.ts            dinero (S/, es-PE), fechas y horas de Lima
  <tema>-reglas.ts      lógica pura de negocio, con <tema>-reglas.test.ts al lado
supabase/
  migrations/           con la versión real que asigna Supabase
  seed.sql              datos de demo
  tests/                pgTAP (supabase test db)
scripts/                invariantes.sql y utilidades
tests/e2e/              Playwright, a ancho de celular
docs/
  adr/  bitacora/  maquetas/  interprete-voz.md  PROMPT-INICIAL.md
.claude/skills/         skills del proyecto (ver «Skills»)
```

**Reglas de capas:**
- **La lógica de negocio es pura y vive en `lib/*-reglas.ts` con su prueba al lado.** No importa React ni Supabase. Ejemplos: armar la tarjeta a partir de la interpretación, calcular el precio sugerido, decidir si una similitud basta para elegir un cliente solo, formatear el resumen del día.
- **Server Components por defecto.** `"use client"` solo donde hay interacción: el botón de voz, una hoja, un formulario.
- **Un Server Component nunca llama como función algo que vive en un archivo `"use client"`.** Next no lo detecta al compilar y la pantalla se cae en el navegador (pasó dos veces en CAYLA Retail).
- **Todo lo que toca una clave lleva `import "server-only"`:** clientes de Groq, Gemini y Lucode, y la secret key de Supabase.
- **Lecturas** desde Server Components o route handlers. **Escrituras** por RPC (`registrar_venta`, `registrar_compra`, `anular_venta`) o por insert directo cuando es una sola tabla (abonos, mermas, gastos). La RLS es la seguridad; la interfaz solo es comodidad.
- **Archivos** en `kebab-case` (`ventas-reglas.ts`), **componentes** en `PascalCase` (`TarjetaConfirmacion.tsx`). Un componente por archivo. Un archivo de más de ~250 líneas pide partirse.
- **Nombres:** tablas, columnas, funciones de la base y textos en español. Variables y funciones de TypeScript en español cuando son del negocio (`registrarVenta`, `saldoCliente`), en inglés cuando son de infraestructura (`fetchWithTimeout`).
- **Nada de `any`.** Los tipos de la base salen de `lib/supabase/tipos-db.ts`, que se regenera tras cada migración (`generate_typescript_types` del MCP de Supabase o `supabase gen types`).

## Celular primero (reglas medibles)

Se prueba con Playwright y en el navegador a estos anchos, en este orden:
- **412 × 915**: el S25 Ultra del dueño.
- **360 × 800**: Android de gama media.
- **390 × 844**.
- Al final, **1280 × 800** para el escritorio.

1. **Zona del pulgar.** La acción principal vive en el tercio de abajo. El **botón de voz** está fijo abajo al centro, mide **96 px o más** y se alcanza con una mano.
2. **Controles de 48 × 48 px como mínimo** y 8 px de separación entre controles. Nada importante depende de un gesto difícil ni de `hover`.
3. **Legible al sol.**
   - Texto base de 17 px o más.
   - Cifras clave (total, deuda, stock) de 28 px o más, con `tabular-nums`.
   - Contraste de **7:1** para textos y cifras importantes (WCAG AAA) y de 4.5:1 para el resto.
   - El color nunca es la única señal: siempre acompaña un texto o un icono.
4. **Hojas, no ventanas.** En celular, todo diálogo sube desde abajo (hoja) con un solo `<Hoja>` (`components/ui/Hoja.tsx`). En escritorio, el mismo componente se ve centrado.
5. **Navegación de abajo** con 4 destinos como máximo: Hoy · Clientes · Stock · Ventas. Ajustes y Cierre viven en un menú.
6. **Teclado solo cuando no hay otra.** Si hay que escribir un número: `inputmode="decimal"`, campo grande, el teclado no tapa el botón de guardar.
7. **Seguro en bordes.** Se usan `100dvh` y `env(safe-area-inset-*)`. Nunca hay scroll horizontal.
8. **Tacto y sonido.** Al confirmar, `navigator.vibrate(30)` donde exista y un sonido corto. La persona sabe que se guardó sin mirar.
9. **Presupuesto de velocidad (Android de gama media en 4G), ADR-0006:**
   - **Mandan LCP menor a 2.5 s e INP menor a 200 ms**, medidos en un Android real o con Lighthouse móvil.
   - **180 KB brotli o menos de JavaScript** en la primera carga de «Hoy» (el piso de Next 16 ya son 147 KB). Se mide con `pnpm build && pnpm medir:js / 180`.
   - En «Hoy» el navegador no carga supabase-js: el resumen llega del servidor y la tarjeta se confirma con una server action.
   - **De soltar el botón de voz a ver la tarjeta: 2.5 s o menos** (se mide en `comandos_voz.latencia_ms`).
10. **Sin conexión, se dice.** Si se cae la red, una franja lo dice y el botón de voz explica que no puede enviar. Lo dictado no se pierde: el audio pendiente se guarda en el dispositivo y se reintenta. La cola sin conexión completa es de la fase 2; en la demo, al menos se avisa y se conserva el último audio.

## Diseño: excelente, no correcto

El objetivo es que el dueño entienda cada pantalla **en 5 segundos, sin manual**, y que se vea como una app que da gusto usar, no como un
formulario del gobierno. El diseño se juzga por lo que la persona **hace**, no por si «le gusta».

### Identidad visual: se elige una vez, mirando

1. **Antes de la primera pantalla se corre `/identidad-visual`.** Usa `frontend-design` y `ui-ux-pro-max` para proponer **3 direcciones visuales distintas**. Cada una trae paleta, tipografía, forma de los botones, tono y su versión de la pantalla «Hoy» y de la tarjeta de confirmación, todo como **maqueta tocable** en `docs/maquetas/identidad/`, probada a 412 px.
2. **Quien dirige el proyecto elige** (o mezcla) mirando las maquetas en el celular, no leyendo una descripción.
3. **Lo elegido se escribe una sola vez** en `app/globals.css` (`@theme`: colores, tipografía, radios, sombras, espacios) y queda en un ADR. Desde ese momento, **los tokens son la única fuente**: nada de hex sueltos, `rgba()` a mano ni `bg-white` en un componente.
4. **Después de eso, las skills de diseño de afuera se consultan, no mandan** (regla de CAYLA Retail): sirven para accesibilidad, criterios de UX y cómo elegir un gráfico, pero no cambian colores ni piezas ya decididas. **Nunca se corre `ui-ux-pro-max` con `--persist`**: crearía un `design-system/MASTER.md` que competiría con `globals.css`.

### Reglas de oficio visual

- **Una función, una pieza.** «Confirmar», «Cancelar», una insignia de estado o un monto se dibujan igual en toda la app. Si hace falta una variante, se agrega a la pieza de `components/ui/`; no se crea otra pieza.
- **shadcn/ui es materia prima, no la pieza.** Lo que genera `shadcn add` vive en `components/shadcn/` y solo lo importa `components/ui/`; una pantalla nunca importa de `components/shadcn/`. Sus variables (`--background`, `--primary`, …) se definen en `globals.css` apuntando a los tokens de Fructus.
- **Espaciado en múltiplos de 4**, alineación a una grilla, jerarquía clara: un protagonista por pantalla.
- **Tipografía:** una familia (cargada con `next/font`) y, como mucho, una segunda para las cifras. Cifras con `tabular-nums`.
- **Dinero siempre con `Monto`:** `S/ 1,250.00`, con `Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" })`. Las deudas tienen un color propio y además un texto («debe»).
- **Modo claro por defecto,** porque se usa al sol. Los tokens nacen con su variante oscura, así que activarla después no cuesta nada.
- **Movimiento sutil y con propósito:** la hoja sube, la tarjeta aparece, el éxito se confirma. Nada de rebotes ni animaciones decorativas. Se respeta `prefers-reduced-motion`.
- **Un solo indicador de carga a pantalla completa** para guardados, montado una vez en el layout. Las secciones usan esqueletos con `Suspense`. Nunca un «Cargando…» suelto. **Nada optimista en dinero ni en stock:** se muestra éxito solo cuando la base respondió.
- **Estados completos.** Cada pantalla diseña su estado vacío (qué falta y qué hacer), su error (en tres líneas y en lenguaje de puesto), su carga y su primer uso.

### Las 9 leyes de Formidable (de CAYLA Retail, adaptadas al celular)

Si dos leyes chocan, gana la que va primero.

1. **Sin manual.**
2. **Una pregunta, una respuesta:** un protagonista y una acción principal por pantalla.
3. **Simplicidad profunda:** la complejidad se traduce a un veredicto («don Lucho te debe S/ 230»), no se esconde ni se muestra cruda.
4. **Lenguaje de puesto:** «tú», español peruano neutro, frases cortas, cero jerga.
5. **Contenido primero:** la fruta, el cliente y el dinero pesan más que los marcos.
6. **Lo difícil, a un toque:** el «¿por qué?» existe, pero detrás de un toque.
7. **Perdonar antes que preguntar:** se confirma solo lo irreversible (dinero, stock, comprobantes); lo reversible ofrece «Deshacer».
8. **Quitar antes de agregar.**
9. **De punta a punta:** vacíos, errores, primer uso, carga y 360 px se cuidan como la pantalla principal.

**`/formidable` es obligatoria al terminar o rediseñar cualquier pantalla u hoja.** Mide, hace un recorrido a ciegas, califica y propone los 3 cambios de mayor impacto antes de tocar nada.

## La voz

El flujo completo, el prompt y las herramientas del intérprete viven en `docs/interprete-voz.md`.

- **Mantener → hablar → soltar → tarjeta → Confirmar.** Un toque largo graba (`MediaRecorder`, `audio/webm;codecs=opus`) y al soltar se envía a `POST /api/voz`. El botón tiene tres estados visibles y anunciados con `aria-live`: escuchando, entendiendo y listo.
- **El servidor hace todo lo sensible:**
  1. Whisper, con el prompt de vocabulario armado desde la base.
  2. El LLM con las herramientas.
  3. La validación con Zod.
  4. El registro en `comandos_voz`.
  5. La resolución de nombres con `buscar_clientes` y `buscar_productos`.

  El navegador recibe la tarjeta lista para mostrar.
- **La tarjeta** dice en grande lo que se entendió: cliente, fruta, jabas, precio, total, y si pagó o lo debe.
  - Cada dato es tocable para corregirlo.
  - Si la similitud de un nombre es menor a 0.45, muestra las 3 mejores opciones para elegir.
  - Las dudas del intérprete salen como una línea discreta.
  - Un solo botón grande: **Confirmar**.
- **Si algo falla, se dice qué hacer.**
  - Si Groq no responde en **8 s** (`AbortSignal.timeout`), se intenta con Gemini.
  - Si tampoco responde, sale «No te entendí, inténtalo otra vez» y el audio se conserva.
  - Toda llamada externa lleva un tope de espera. Ningún `catch` se traga un error sin registrarlo.
- **Responder hablando** solo en consultas («¿quién me debe?»), con `speechSynthesis` en `es-PE` o `es-US`. Una venta se confirma con vibración, sonido y la tarjeta en verde; no hace falta voz.
- **Precisión medible.** Los casos de `docs/interprete-voz.md` viven en `tests/interprete/casos.json`, y `/voz-precision` los corre contra el modelo real. Meta de la demo: **90 % o más de acierto** en intención y datos clave. Se mide antes de cada entrega.

## Base de datos

- **Proyecto Supabase:** **Fructus** (`fwrqquugiktwklleqwfa`, región `sa-east-1`, Postgres 17), en la organización de Danytristee. Con el MCP de Supabase se aplican migraciones, se consultan los logs y se revisan los avisos del linter.
- **Desarrollo local:** `npx supabase start` (Docker) levanta la misma base con las migraciones y `seed.sql`. Se rompe y se rehace con `npx supabase db reset` sin miedo: el estado local nunca es la fuente de verdad.
- **Migraciones:**
  1. Se escriben primero en local y se prueban con `db reset` y `supabase test db`.
  2. Con OK de quien dirige el proyecto, se aplican al proyecto con `apply_migration`.
  3. El archivo se renombra a la **versión que asignó Supabase** (`list_migrations`).
  4. **Una migración aplicada no se edita;** la corrección va en un archivo nuevo.
- **Escribir una migración que corra igual en local, en CI y en el proyecto:** si depende de algo que solo existe en uno (como `rls_auto_enable()`, que crea el proyecto alojado), se envuelve en un `do $$ … if exists … $$`.
- **Tras cada migración:** regenerar `lib/supabase/tipos-db.ts`, correr `get_advisors` (seguridad y rendimiento) y explicar cada aviso nuevo, sea que se arregle o que se deje.
- **Nombres en español**, `snake_case`, plural (`ventas`, `abonos`). Llaves foráneas explícitas (`cliente_id`, nunca `cli`).
- **Operaciones de varias tablas, por RPC** para que sean atómicas: `registrar_venta`, `registrar_compra`, `anular_venta`.
- **Lecturas de saldos:** `v_stock`, `v_saldo_clientes`, `resumen_dia()`, `ultimo_precio()`. Búsqueda por apodo: `buscar_clientes(q)` y `buscar_productos(q)` (pg_trgm).
- **Roles y RLS:**
  - **duenio** y **administrador** pueden hacer todo.
  - **ayudante** inserta operaciones, pero no edita ni anula.
  - **contador** solo lee.
  - **comprobantes** y **series** solo los escribe el servidor (service role).
- **Trampas de RLS que ya costaron caro:**
  - Un `update` sin permiso **no falla, solo no toca filas**. Si una función depende de que el update ocurra, verifica el rol explícitamente (ver `anular_venta`).
  - En las políticas, `auth.uid()` va dentro de `(select auth.uid())` para que se evalúe una vez por consulta y no una vez por fila.
  - Supabase da `EXECUTE` a `anon` y `authenticated` en toda función nueva. Si no deben llamarla, revócalo en la misma migración.
- **Avisos del linter que se dejan a propósito:**
  - `series_comprobante` tiene RLS sin políticas porque solo la toca el servidor.
  - `rol_actual()` es `security definer` y la pueden ejecutar los autenticados, porque las políticas la necesitan.
  - Los avisos de rendimiento (políticas permisivas múltiples, llaves foráneas sin índice) no importan a este volumen; se revisan antes de producción.
- **IGV:** frutas frescas → afectación `20` (exonerado, Apéndice I de la Ley del IGV). Es configurable por producto.
- **Invariantes:** `scripts/invariantes.sql` revisa lo que la base no impide sola. Por ejemplo, que el total de una venta sea la suma de sus ítems, que cada ítem tenga su salida de stock y que una venta anulada tenga su devolución. Sale con error si algo no cuadra. Corre en el CI y después de cada ataque de `/chaos`.

## Comprobantes

- **Factura (01)** para clientes con RUC, **boleta (03)** para el resto. Se emiten solo cuando la persona lo pide («hazle factura»).
- **Cómo se emite:**
  1. El servidor toma el correlativo con `tomar_numero(serie)`.
  2. Guarda el comprobante como `pendiente` **antes** de enviarlo.
  3. Lo envía al sandbox de Lucode.
  4. Guarda la respuesta cruda en `comprobantes.respuesta` y actualiza el estado.
- **Si el envío no responde, se reintenta.** Nunca se emite dos veces el mismo número. Si el proveedor dice que el comprobante ya existe, se consulta su estado y se toma esa respuesta.
- **Una venta con comprobante enviado o aceptado no se anula:** corresponde nota de crédito.

## Seguridad y claves

- **Todas las claves viven solo en el servidor:** Groq, Gemini, Lucode, la secret key de Supabase y las VAPID privadas. Solo pueden ir al navegador las que empiezan con `NEXT_PUBLIC_`: la URL de Supabase y la publishable key.
- **Las claves se guardan en tres lugares, nunca en otro:** `.env.local` (fuera de git), las variables de Vercel y los *secrets* de GitHub. Nunca en un archivo versionado, en un log ni pegadas en el chat.
- **Logs con ids, nunca con nombres, DNI, RUC ni teléfonos.** La transcripción de voz se guarda en la base (`comandos_voz`), no en logs del servidor.
- **Un hallazgo de seguridad no se escribe en un archivo versionado.** Se le dice a quien dirige el proyecto por chat.

## Calidad

| Qué | Con qué | Cuándo |
|---|---|---|
| Lógica pura (`lib/*-reglas.ts`) | Vitest, prueba al lado del archivo | Siempre. Una regla sin prueba no está terminada. |
| Base (RPC, RLS, invariantes) | pgTAP en `supabase/tests/` + `scripts/invariantes.sql` | Cada migración trae su prueba: el caso feliz, el rechazo por rol y el caso borde (crédito sin cliente, venta sin ítems). |
| Pantallas de punta a punta | Playwright en `tests/e2e/`, con el dispositivo emulado a 412 y 360 px | Los flujos críticos: dictar y confirmar una venta, registrar un abono, ver «quién me debe», cierre del día. |
| Intérprete de voz | `/voz-precision` sobre `tests/interprete/casos.json` | Antes de cada entrega y al tocar el prompt o el modelo. |
| Pantallas que guardan | `/chaos` | Al terminar cada pantalla u hoja que guarda. |
| Diseño | `/formidable` | Al terminar o rediseñar cada pantalla u hoja. |
| Código muerto | Knip | En el CI. |

- **Pre-commit** (`.githooks/pre-commit`): revisa **solo lo que estás commiteando** (tipos, `vitest related` y ESLint), como en CAYLA Retail, porque un hook lento se termina salteando. Se activa con `pnpm install` (script `prepare`). Solo en una emergencia real: `git commit --no-verify`.
- **CI** (`.github/workflows/ci.yml`): tipos, lint, pruebas, Knip y build. Hay un segundo trabajo que levanta Supabase con Docker y corre pgTAP y las invariantes. **Un PR en rojo no se fusiona.**
- **Mantener viva la base:** `.github/workflows/mantener-despierta.yml` consulta la base cada 3 días para que el plan gratis no la pause. Necesita los secrets `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`.

## Flujo de trabajo

**Al abrir sesión:**
1. `git status --short`.
2. `git fetch origin && git merge origin/main`. Se hace al empezar, no solo antes de subir.
3. Leer este archivo y las últimas entradas de `docs/bitacora/` (`ls docs/bitacora | tail`).

**Rama por tarea, nunca directo a `main`:**
- Las sesiones de Claude Code crean la suya (`claude/<tema>`).
- El trabajo humano directo usa `<usuario>/<dominio>-<tema>`, por ejemplo `dany/voz-tarjeta`.
- En un repo privado del plan gratuito, GitHub no permite proteger `main` con reglas. La protección es esta disciplina más el CI en rojo.

**Pasos verificables:** cada actividad termina demostrada (prueba en verde y captura a 412 px) y con **su propio commit**. Para obras de varios pasos se usa `/construir`.

**Commits en Conventional Commits** (scope = dominio):
- `feat(voz): tarjeta de confirmación con precio sugerido`
- `fix(clientes): saldo no contaba abonos del día`
- `test(base): rls del ayudante en abonos`

**PR al cerrar cada paso verificable, no al final del proyecto.** Se abre con `/abrir-pr`. Si cambia una pantalla, la descripción lleva una captura a 412 px. Fusiona quien dirige el proyecto.

**Documentación:**
- **ADR** en `docs/adr/NNNN-titulo.md` el mismo día de cada decisión estructural.
- **Bitácora:** una entrada, un archivo, en `docs/bitacora/AAAA-MM-DD-<tema>.md`. Son 3 a 6 líneas: qué cambió, cómo se verificó y qué queda pendiente.
- `docs/interprete-voz.md` se actualiza si cambia el prompt, las herramientas o los casos.

**Al explicar algo nuevo** (un concepto o un cambio en el modelo de datos):
1. Empieza por el problema, no por la definición.
2. Usa una analogía del puesto (jabas, cuaderno, balanza).
3. Muestra cómo se ve mal hecho.
4. Indica `archivo:línea` para volver a verlo.

## Antes de decir «listo»

Se responde con evidencia; si algo no se probó, se dice «sin probar».
- **Funciona:**
  - el comando de prueba con su resultado;
  - la captura a 412 px (y a 360 px si es pantalla nueva);
  - en una pantalla que guarda, la consulta que muestra lo que quedó en la base.
- **Concurrencia:** qué pasa si el dueño y un ayudante registran lo mismo a la vez, o si se toca Confirmar dos veces.
- **Caída externa:** qué ve la persona si Groq, Lucode o Supabase no responden.
- **Persona sin contexto:** ¿lo entiende alguien que nunca vio la app? `/formidable` hace esa prueba a ciegas.

## Skills

### Del proyecto (`.claude/skills/`, viajan con el repo)

| Skill | Para qué | Cuándo |
|---|---|---|
| `/identidad-visual` | Propone 3 direcciones visuales como maquetas tocables, ayuda a elegir y fija los tokens | Una vez, antes de la primera pantalla, y si se decide rediseñar la identidad |
| `/construir` | Ejecuta una obra grande actividad por actividad, cada una un corte vertical con su commit | Pantallas, módulos, migración con RPC e interfaz |
| `/formidable` | Lleva una pantalla u hoja al nivel «se entiende en 5 segundos» a ancho de celular | Obligatoria al terminar o rediseñar una pantalla u hoja |
| `/chaos` | Usa mal la app a propósito (doble toque, sin red, voz ambigua, dos personas a la vez) y revisa las invariantes | Obligatoria al terminar una pantalla u hoja que guarda |
| `/voz-precision` | Corre los casos del intérprete contra el modelo real y mide acierto y latencia | Al tocar el prompt, el modelo o el vocabulario; antes de cada entrega |
| `/decide` | Aplica el protocolo de pregunta a una decisión puntual | Cuando no está claro si preguntar o decidir |
| `/abrir-pr` | Pone la rama al día, corre lo que toca el cambio y abre el PR con la descripción completa | Siempre que se abre un PR |

Vienen de las skills de CAYLA Retail (`construir`, `formidable`, `chaos`, `decide`, `abrir-pr`), adaptadas a una persona, a la voz y al celular. `/identidad-visual` y `/voz-precision` son propias de Fructus.

### De afuera (vienen en el repo; se consultan, no mandan)

Desde ADR-0004 viajan en `.claude/skills/`: nadie tiene que instalarlas. La lista completa, con el para qué, el commit de origen y la licencia
de cada una, está en `docs/terceros/README.md`. No se editan a mano: se actualizan con `npx skills update -p` y el diff se revisa.

| Para | Skills |
|---|---|
| Diseño | `frontend-design` (base de `/identidad-visual`), `ui-ux-pro-max` (**nunca con `--persist`**), `shadcn`, `ui-styling`, `web-design-guidelines`, `accessibility` |
| Movimiento | `emil-design-eng`, `animate`, `animation-performance`, `review-animations` (solo a pedido) |
| React y Next.js | `vercel-react-best-practices`, `vercel-composition-patterns`, `frontend-ui-engineering`, `core-web-vitals`, `performance-optimization` |
| Base de datos | `supabase`, `supabase-postgres-best-practices` |
| PWA | `pwa-expert` para caché, actualización y envío en segundo plano. **Para Next.js manda la guía oficial** (`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`): `pwa-expert` sugiere `next-pwa`, que no se usa. |
| Oficio | `test-driven-development`, `debugging-and-error-recovery`, `security-and-hardening`, `source-driven-development`, `code-review-and-quality`, `verification-before-completion`, `doubt-driven-development` (reglas de dinero y stock), `api-and-interface-design` (`/api/voz`), `observability-and-instrumentation` |
| Dentro de `/construir` y `/abrir-pr` | `planning-and-task-breakdown` e `incremental-implementation` (cortar actividades), `git-workflow-and-versioning` y `ci-cd-and-automation` (commits, ramas y CI) |

Para el trabajo de varios pasos mandan `/construir`, `/decide` y `/abrir-pr`: traen las reglas de Fructus (migraciones con su versión real, captura a 412 px, `/formidable` y `/chaos` como compuertas, bitácora). Las de afuera aportan técnica dentro de ellas, no las reemplazan.

**Orden de autoridad:** este archivo → los ADR → `app/globals.css` → las skills del proyecto → las de afuera.

## Vocabulario e idioma

- **Español siempre:** textos de interfaz, comentarios que explican el negocio, ADR, bitácora y commits.
- **En pantalla:** «cliente» (no «clienta» ni «comprador»), «jaba» (también se acepta «caja» por voz), «lo debe» / «pagó», «abono», «merma» («se malogró»), «ayudante», «dueño».
- **Tono:** se trata de «tú», con frases cortas. Los montos siempre en soles con `S/`.
- **Nombres:** la base y los dominios usan los mismos nombres que la pantalla. No se inventan sinónimos entre capas.

## Alcance de la demo (2 semanas)

**Dentro:**
- voz → venta, al contado y al crédito;
- abonos, compras, mermas y gastos;
- consultas por voz («¿quién me debe?», «¿cuánto vendí?», «¿cuántas jabas me quedan?»);
- stock, cuaderno de clientes y cierre del día;
- boleta y factura en sandbox;
- roles, login y exportar el mes a Excel;
- PWA instalable con resumen diario por Web Push y botón «Enviar por WhatsApp».

**Fuera, para la fase 2:**
- leer facturas de proveedor con la cámara;
- predicción de compras;
- cola completa sin conexión;
- palabra de activación («Fructus, …»);
- WhatsApp automático;
- modo oscuro activado.

## Antes de producción

- Confirmar con el contador del empresario cómo emite hoy (usa talonario físico) y si ya está obligado a emitir electrónico.
- Confirmar la afectación de IGV de cada producto.
- Confirmar que las series (F001, B001) no las haya usado antes otro sistema del mismo RUC.
- Pasar de Vercel Hobby a un hosting que permita uso comercial, y Supabase a un plan que no se pause.
- Salir de los niveles gratuitos de LLM que usan los datos para entrenar.
- Revisar los avisos de rendimiento del linter y los índices.
