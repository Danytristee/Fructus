# Fructus

ERP simple, **por voz**, para un mayorista de frutas de La Hermelinda (Trujillo, Perú). Vende por jabas, 20 a 60 ventas al día, la mayoría a clientes recurrentes y mucho al crédito (hoy en un cuaderno).

**Fase actual: demo para un proyecto universitario.** Tiene que ser usable de verdad con datos reales del puesto, pero la facturación va a sandbox. Si se aprueba, se implementa con el empresario (ver "Antes de producción").

## Para quién es

| Usuario | Qué hace | Cómo usa la app |
|---|---|---|
| Dueño | Vende, cobra, compra, pregunta | Celular (Samsung S25 Ultra), casi siempre con las manos ocupadas. Usa bien WhatsApp y Yape. |
| Ayudante (1–2) | Registra ventas, abonos, mermas | Celulares Android gama media |
| Administrador (futuro) | Revisa todo en detalle | Escritorio |
| Contador externo | Lee y exporta el mes | Escritorio, solo lectura |

## Principios (no negociables)

1. **Voz primero, pocos toques.** El flujo normal es: mantener el botón → hablar → soltar → ver la tarjeta → 1 toque en Confirmar. Si algo pide más de 2 toques, está mal diseñado.
2. **Nunca se guarda sin confirmación.** La voz propone y la persona confirma. La tarjeta es grande, legible al sol y muestra lo que se entendió, no la transcripción.
3. **Nunca se inventa dinero.** Si no dijo el precio, se sugiere el último (marcado como "sugerido"). Si no dijo si pagó, se pregunta con dos botones (**Pagó** / **Lo debe**). Nunca se asume contado.
4. **Los saldos no se editan; se calculan.** Stock = suma de `movimientos_stock`. Deuda = ventas al crédito − abonos. Corregir = registrar un movimiento nuevo o anular, no editar números.
5. **La fruta se malogra.** La merma es un comando de voz de primera clase, no un ajuste escondido.
6. **Todo comando de voz deja rastro** en `comandos_voz` (transcripción, interpretación, resultado, latencia). Es la base para medir la precisión en el informe universitario.

## Stack (costo 0)

| Capa | Elección | Notas |
|---|---|---|
| App | Next.js (App Router) + TypeScript + Tailwind, como **PWA** | Mobile-first: botón de voz que ocupe media pantalla. La versión escritorio es para administrador y contador. |
| Datos y login | Supabase (Postgres + Auth + RLS) | Organización propia del proyecto. El plan gratis pausa el proyecto tras 7 días sin actividad: hay un ping programado. |
| Voz a texto | Groq `whisper-large-v3-turbo` | Con prompt de vocabulario (apodos y frutas). Ver `docs/interprete-voz.md`. |
| Interpretación | LLM en Groq con tool calling; Gemini Flash como respaldo | `temperature: 0`, `tool_choice: required`. |
| Respuestas habladas | Web Speech API (`speechSynthesis`) | En el navegador, gratis. |
| Comprobantes | Sandbox de Lucode (apisunat.pe) | Plan B gratis: servicio BETA de SUNAT con credenciales MODDATOS. |
| Hosting | Vercel Hobby | Solo uso no comercial: sirve para la demo. Producción → Cloudflare o Vercel Pro. |
| Resumen diario | Web Push + botón "Enviar por WhatsApp" (`wa.me`) | No usar la API de WhatsApp: cobra por mensajes que inicia la empresa. |
| Exportar | SheetJS (Excel) | Ventas, compras y comprobantes del mes para el contador. |

**Todas las claves (Groq, Gemini, Lucode, secret key de Supabase) viven solo en el servidor** (route handlers o Edge Functions). El navegador nunca las ve.

## Base de datos

- Migraciones en `supabase/migrations/`, datos de demo en `supabase/seed.sql`.
- Nombres de tablas, columnas y funciones **en español** (`ventas`, `abonos`, `registrar_venta`). El código de infraestructura puede estar en inglés.
- Las operaciones de varias tablas se hacen por RPC para que sean atómicas: `registrar_venta`, `registrar_compra`, `anular_venta`.
- Lectura de saldos y resúmenes: `v_stock`, `v_saldo_clientes`, `resumen_dia()`, `ultimo_precio()`.
- Búsqueda por apodo: `buscar_clientes(q)`, `buscar_productos(q)` (pg_trgm).
- Roles y RLS:
  - **duenio** y **administrador** pueden hacer todo.
  - **ayudante** inserta ventas, abonos, compras, mermas y gastos, pero no edita ni anula.
  - **contador** solo lee.
  - **comprobantes** y **series** solo los escribe el servidor (service role).
- Ojo con RLS: un `update` sin permiso **no falla, solo no toca filas**. Si una función depende de que el update ocurra, verificar el rol explícitamente (ver `anular_venta`).
- IGV: frutas frescas → afectación `20` (exonerado, Apéndice I de la Ley del IGV). Configurable por producto.

## Comprobantes

- Factura (01) a clientes con RUC; boleta (03) al resto. Se emiten solo si el usuario lo pide ("hazle factura").
- El servidor toma el correlativo con `tomar_numero(serie)`, envía al sandbox, guarda la respuesta cruda en `comprobantes.respuesta` y actualiza el estado.
- El envío puede tardar o no responder: se guarda el comprobante como `pendiente` antes de enviarlo y se reintenta. Nunca se emite dos veces el mismo número; si el proveedor dice que ya existe, se consulta y se toma su respuesta.
- Una venta con comprobante enviado o aceptado **no se anula**: corresponde nota de crédito.

## Alcance de la demo (2 semanas)

**Dentro:** voz → venta (contado y crédito), abonos, compras, mermas, gastos, consultas por voz ("¿quién me debe?", "¿cuánto vendí?"), stock, cierre del día, boleta y factura en sandbox, roles, exportar a Excel.

**Fuera, para la fase 2:** leer facturas de proveedor con la cámara, predicción de compras, modo sin conexión, palabra de activación ("Fructus, ..."), WhatsApp automático.

## Antes de producción

- Confirmar con el contador del empresario cómo emite hoy (usa talonario físico) y si ya está obligado a emitir electrónico.
- Confirmar la afectación de IGV de cada producto.
- Confirmar que las series (F001, B001) no las haya usado antes otro sistema del mismo RUC.
- Pasar de Vercel Hobby a un hosting que permita uso comercial, y Supabase a un plan que no se pause.
- Salir de los niveles gratuitos de LLM que usan los datos para entrenar.
