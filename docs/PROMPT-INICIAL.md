# Prompt inicial — construir Fructus con Claude Code

> **Cómo usarlo:** abre Claude Code en la raíz del repo y escribe:
> «Lee `docs/PROMPT-INICIAL.md` y ejecútalo con `/construir`.»
> Todo lo que sigue va dirigido a Claude Code.

---

## Tu rol

Eres el ingeniero principal de **Fructus**. Construyes la demo completa en **2 semanas**, sola o solo, con criterio propio: decides lo técnico
y lo explicas en 3 líneas; preguntas solo lo que el protocolo de `CLAUDE.md` manda preguntar. Tu estándar es un producto que un
mayorista de fruta use de verdad desde su celular a pleno sol, con un diseño que dé gusto, no un trabajo práctico que «funciona».

**Antes de escribir código, lee completos y en este orden:**
1. `CLAUDE.md`: las reglas. Mandan sobre este prompt si algo choca.
2. `docs/interprete-voz.md`: cómo una frase se vuelve una operación.
3. `supabase/migrations/`: el esquema ya existe y está aplicado al proyecto Fructus. No lo rehagas; constrúyelo encima.
4. `docs/adr/` y `docs/bitacora/`.
5. `.claude/skills/`: tus herramientas de trabajo.

## Qué es Fructus

Un ERP **por voz** para un mayorista de frutas de La Hermelinda (Trujillo). Vende por jabas, de 20 a 60 ventas al día, casi siempre a
clientes que vuelven y mucho al crédito (hoy lo anota en un cuaderno). Le cuesta la tecnología y casi siempre tiene las manos ocupadas.

El corazón del producto es un flujo:

> **Mantiene el botón → dice «Vendí 10 jabas de mango kent a don Lucho a 45, lo debe» → suelta → ve una tarjeta grande con lo que se entendió → toca Confirmar → listo.**

Todo lo demás (cuaderno de deudas, stock, cierre del día, comprobantes) existe para que ese flujo valga la pena.

## Stack (resumen; el detalle y las razones están en `CLAUDE.md`)

| Capa | Elección |
|---|---|
| Base técnica | Node 24 · pnpm 10 · Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind CSS 4 · shadcn/ui (Radix) · lucide-react · Zod 4 |
| Datos | Supabase (proyecto **Fructus**, `fwrqquugiktwklleqwfa`) con `@supabase/ssr` |
| Voz | Groq Whisper (`whisper-large-v3-turbo`) → LLM de Groq con tool calling (Gemini Flash de respaldo) → `speechSynthesis` para responder |
| Comprobantes | Sandbox de Lucode (docs: `https://docs.apisunat.pe/`, índice en `https://docs.apisunat.pe/llms.txt`) |
| Pruebas | Vitest · Playwright (412 y 360 px) · pgTAP · `scripts/invariantes.sql` · Knip |
| Publicación | Vercel Hobby · PWA (`app/manifest.ts` + `public/sw.js`) · Web Push |

**Costo cero.** No agregues un servicio de pago ni uno que pida tarjeta. Si algo no se puede hacer gratis, detente y dilo.

**No adivines APIs.** Para Groq, Lucode, Supabase y Next 16, lee la documentación vigente antes de escribir la integración:
- el modelo de Groq con tool calling que esté vigente;
- los campos exactos del JSON de Lucode;
- la forma actual de `@supabase/ssr`.

Anota en un ADR el modelo elegido.

## Cómo trabajas

- **Con `/construir`:** primero presentas la lista de actividades de abajo, ajustada a lo que encuentres en el repo, y esperas el OK. Después ejecutas actividad por actividad. Cada actividad termina con:
  - un corte vertical demostrado (pruebas en verde, captura a 412 px, la base comprobada);
  - **su propio commit** en Conventional Commits.
- **Rama por tarea** (`claude/<tema>`). Nunca directo a `main`. Abres un PR con `/abrir-pr` al cerrar cada actividad o grupo chico de actividades. Fusiona quien dirige el proyecto.
- **Migraciones nuevas:**
  1. primero en local, con su prueba pgTAP;
  2. al proyecto, **solo con OK**, usando `apply_migration` del MCP de Supabase;
  3. después renombras el archivo a la versión real (`list_migrations`), regeneras los tipos y corres `get_advisors`.
- **Cerrar una pantalla u hoja:**
  - **`/formidable`** es obligatoria;
  - **`/chaos`**, si guarda;
  - **`/voz-precision`**, cada vez que tocas la voz.
- **Al cerrar la sesión:** entrada en `docs/bitacora/AAAA-MM-DD-<tema>.md` y ADR si hubo una decisión estructural.
- **Antes de decir «listo»:** la evidencia que pide `CLAUDE.md`. Esto incluye concurrencia, caída externa y persona sin contexto.

## Lo que necesitas que te den (pídelo solo cuando la actividad lo necesite)

| Qué | Para qué actividad |
|---|---|
| Elección de identidad visual entre 3 maquetas | A1 |
| Correos del dueño y de los ayudantes (para crear sus cuentas) | A2 |
| `GROQ_API_KEY` y `GEMINI_API_KEY` en `.env.local` y en Vercel | A4 |
| Token del sandbox de Lucode y RUC emisor de prueba | A9 |
| Catálogo real (frutas, variedades y precio de referencia) y clientes frecuentes con sus apodos | A12 (los de `seed.sql` son ficticios) |
| Secrets `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` en GitHub | A0 (para el trabajo que mantiene despierta la base) |

**Las claves nunca se pegan en el chat ni en un archivo versionado.** Se ponen en `.env.local`, en Vercel o en los secrets de GitHub.

## Actividades

Ajusta el orden si encuentras una dependencia, pero no la recortes sin decirlo.

### Semana 1 — el flujo central

**A0 · Andamiaje.**
- Proyecto Next.js 16 con TypeScript estricto (`strict`, `noUncheckedIndexedAccess`), Tailwind 4, ESLint 9, Vitest, Playwright (perfiles de 412 × 915 y 360 × 800) y Knip.
- Scripts en `package.json`: `dev`, `build`, `typecheck`, `lint`, `test`, `e2e`, `knip`, y `prepare`, que activa `.githooks`.
- Clientes de Supabase en `lib/supabase/` (servidor con `server-only`, y navegador).
- Tipos generados en `lib/supabase/tipos-db.ts`.
- `.env.example` al día.
- *Demostrable:* `pnpm dev` abre una página; el CI pasa los dos trabajos en verde en el PR.

**A1 · Identidad visual.**
- `/identidad-visual`: 3 direcciones como maquetas tocables a 412 px, elección, tokens en `app/globals.css` (con su variante oscura) y fuente con `next/font`.
- Piezas base de `components/ui/`: `Boton`, `Monto`, `Tarjeta`, `Hoja`, `Insignia`, `Aviso`, `Vacio`, `Espera`.
- ADR de la identidad.
- *Demostrable:* una página `/piezas`, solo en desarrollo, muestra cada pieza en claro y oscuro a 412 px.

**A2 · Sesión, roles y marco.**
- Login con correo y contraseña de Supabase Auth, con sesión persistente.
- Layout con barra inferior: Hoy · Clientes · Stock · Ventas.
- Menú con Ajustes y Cierre.
- Guarda por rol en el servidor: el contador no ve botones de registrar y el ayudante no ve Anular.
- Creación de las cuentas reales y sus `perfiles`, con OK: escribe en el proyecto.
- *Demostrable:* e2e entra con cada rol y ve lo que le corresponde.

**A3 · «Hoy».**
- La pantalla del dueño: el botón de voz (todavía sin acción), el resumen del día con `resumen_dia()` (vendido, cobrado, por cobrar, jabas) y las últimas 5 operaciones.
- Estados vacío, de carga y de error.
- *Demostrable:* e2e a 412 y 360 px con datos del seed; `/formidable`.

**A4 · El intérprete (servidor).**
- `POST /api/voz`:
  1. recibe el audio (webm/opus, tope de 60 s y 10 MB);
  2. lo pasa por Whisper con el vocabulario armado desde la base (`productos.alias`, `clientes.alias`);
  3. lo interpreta con el LLM y las herramientas de `docs/interprete-voz.md`;
  4. valida con Zod;
  5. registra en `comandos_voz` (transcripción, intención, JSON, latencia, modelos);
  6. resuelve nombres con `buscar_clientes` y `buscar_productos`;
  7. completa el precio sugerido con `ultimo_precio`;
  8. devuelve la **tarjeta** lista para mostrar.
- Topes de espera de 8 s, con respaldo en Gemini.
- La lógica de armar la tarjeta es pura, en `lib/voz/tarjeta-reglas.ts` con su prueba.
- *Demostrable:* `/voz-precision` sobre `tests/interprete/casos.json` con **90 % o más** de acierto en datos clave y **100 %** de prudencia con el dinero. Informe en `docs/voz/`.

**A5 · Vender por voz (el flujo central).**
- `BotonVoz`:
  - mantener para grabar;
  - estados escuchando → entendiendo → listo, anunciados con `aria-live`;
  - vibración al empezar y al terminar.
- `TarjetaConfirmacion` para `registrar_venta`:
  - cada dato tocable para corregir;
  - el precio sugerido marcado como tal;
  - **Pagó** / **Lo debe** cuando falta la condición, y el medio de pago cuando pagó;
  - las 3 mejores opciones si el cliente es dudoso;
  - un solo **Confirmar** grande, que llama `registrar_venta` con `comando_voz_id`.
- El comando se marca `corregido` o `descartado` según lo que pase.
- El doble toque no duplica: el botón se bloquea y se verifica en la base.
- *Demostrable:*
  - e2e con `/api/voz` simulado: venta al contado y a crédito;
  - el saldo del cliente cambia;
  - las invariantes quedan limpias;
  - `/formidable` y `/chaos`;
  - prueba real con la voz en un celular.

**A6 · El resto de las operaciones por voz.**
- Tarjetas para `registrar_abono`, `registrar_compra` (usa `registrar_compra`), `registrar_merma` y `registrar_gasto`.
- Todas con la misma pieza de tarjeta: una función, una pieza.
- *Demostrable:* e2e de cada una, invariantes limpias y `/chaos` en las que guardan.

### Semana 2 — completar, emitir y pulir

**A7 · Preguntar por voz.**
- `consultar`: quién me debe, deuda de un cliente, ventas de hoy, stock de un producto y resumen del día.
- Respuesta en pantalla y **hablada** con `speechSynthesis`: frases cortas y montos dichos como se dicen («doscientos treinta soles»).
- *Demostrable:* e2e y `/voz-precision` con los casos de consulta.

**A8 · Cuaderno, stock y ventas.**
- **Clientes:** deudores primero, por monto. Ficha con historial y abonos. Alta y edición con alias. Registrar un abono a mano.
- **Stock:** jabas por fruta, con aviso de «quedan pocas». Mermas y compras a mano.
- **Ventas:** historial del día y de la semana. Anular (solo dueño o administrador, con confirmación y motivo).
- Todo usable también sin voz, para el ayudante que prefiera tocar.
- *Demostrable:* e2e por pantalla, `/formidable` en cada una y `/chaos` en las que guardan.

**A9 · Comprobantes en sandbox.**
- Emitir boleta o factura cuando se pide por voz («hazle factura») o desde la venta.
- **Factura solo a clientes con RUC;** si falta, se pide el RUC.
- Integración en el servidor (`lib/comprobantes/lucode.ts` con `server-only`):
  1. `tomar_numero`;
  2. el comprobante se guarda `pendiente` **antes** de enviar;
  3. se envía con tope de espera;
  4. se guarda la respuesta cruda y se actualiza el estado;
  5. hay reintento para los pendientes;
  6. si responde «ya existe», se consulta el estado y se toma esa respuesta.
- Enlace al PDF y botón «Enviar por WhatsApp» (`wa.me` con el enlace).
- *Demostrable:*
  - prueba con Lucode simulado (éxito, rechazo, sin respuesta);
  - una emisión real al sandbox;
  - INV-08 a INV-11 limpias.

**A10 · Cierre del día y exportar.**
- Pantalla de cierre: vendido al contado, a crédito, cobrado, gastos, compras, por cobrar y jabas que quedan.
- Botón **Enviar por WhatsApp** con el resumen en texto.
- **Exportar el mes a Excel** (SheetJS, instalado desde su CDN oficial): ventas, abonos, compras, gastos y comprobantes, para el contador.
- Web Push opcional con el resumen al cerrar el día.
- *Demostrable:* el Excel se abre bien y cuadra con `resumen_dia()` de cada día.

**A11 · App instalable y resistente.**
- PWA instalable con manifest, íconos y service worker mínimo.
- Franja «Sin conexión».
- Si se cae la red, el último audio dictado se conserva en el dispositivo y se reintenta al volver.
- `GET /api/salud` hace una consulta real a la base.
- Presupuesto de velocidad medido con Lighthouse móvil: LCP menor a 2.5 s, 120 KB o menos de JS en «Hoy» y tarjeta en 2.5 s o menos.
- *Demostrable:* instalación en Android, prueba en modo avión y el informe de Lighthouse en `docs/`.

**A12 · Listo para la demo.**
- Datos reales del puesto (catálogo y clientes con apodos), con OK y por migración de datos o desde Ajustes.
- `/formidable` en todas las pantallas, `/chaos` en las que guardan y `/voz-precision` final con audios reales grabados en el puesto.
- Despliegue en Vercel.
- `docs/DEMO.md` con:
  - el guion de 5 minutos;
  - las métricas (acierto de voz, latencia, Lighthouse);
  - qué queda para producción.
- Un video de respaldo de la demo.
- *Demostrable:* la demo completa en un celular real, de punta a punta, sin tocar el teclado salvo para iniciar sesión.

## Criterios de aceptación de la demo

- [ ] Una venta dictada se registra en **menos de 10 segundos** desde que se toca el botón, con **un solo toque** de confirmación.
- [ ] **Acierto de voz:** 90 % o más en datos clave, 100 % de prudencia con el dinero y p95 de 2.5 s o menos hasta la tarjeta.
- [ ] El cuaderno de deudas cuadra siempre: `scripts/invariantes.sql` limpio después de todo `/chaos`.
- [ ] Todas las pantallas pasan `/formidable` con nota de 8 o más y se usan con una mano a 360 px.
- [ ] Contraste de 7:1 en cifras y textos clave, y controles de 48 px o más.
- [ ] Boleta y factura emitidas al sandbox, sin duplicados aunque se toque dos veces o se corte la red.
- [ ] CI en verde. Ninguna clave en el repo. Cero servicios de pago.

## Lo que NO haces sin preguntar

- Aplicar migraciones al proyecto de Supabase.
- Cambiar reglas de dinero, stock, permisos o comprobantes.
- Emitir fuera del sandbox.
- Borrar datos.
- Agregar un servicio o dependencia de pago.
- Cambiar la identidad visual ya elegida.
