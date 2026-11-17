# ADR-0026 — Claude Haiku 5.5 interpreta los dictados; Groq y Gemini quedan de respaldo

**Fecha:** 2026-11-17 · **Estado:** aceptado (suma un uso de pago de Anthropic; ADR-0021 fue el primero)

## Contexto

Se pidió que la voz «la entienda mejor una IA», con el ejemplo de «Vendí 10 cajas de mango a don Lucho y pagó solo 1000», y que se
pruebe la API de Anthropic. El intérprete ya era un LLM (gpt-oss-120b en Groq, gratis), pero erraba en los datos: 87.8 % de datos
clave el 16-11, por debajo de la meta de 90 %. El pago parcial no tenía dónde guardarse (eso lo resuelve ADR-0025, para cualquier
modelo).

Claude **no recibe audio** (la API acepta texto, imágenes y PDF; revisado en la documentación el 17-11). Whisper en Groq sigue pasando
la voz a texto; lo que cambia es quién lee ese texto y elige la herramienta.

## Decisión

1. **El intérprete pregunta primero a `claude-haiku-5-5`** (`lib/voz/interprete-claude.ts`, `server-only`, SDK oficial). Mismo
   prompt y mismas 8 herramientas que Groq: salen de los mismos esquemas de Zod, así que no hay dos versiones. Herramienta forzada
   (`tool_choice: any`, una sola), sin pensar y con esfuerzo bajo: es elegir una herramienta y copiar datos, y así es lo más rápido.
   El prompt y las herramientas van en caché.
2. **Si Claude no responde en 8 s o falla de cualquier forma, sigue Groq** (las dos cuentas) y después Gemini
   (`lib/voz/respaldo-reglas.ts`). Sin `ANTHROPIC_API_KEY` se anota «sin clave configurada» y todo funciona como antes.
3. **Medido, no supuesto** (`docs/voz/precision-2026-11-17-2.md`, 93 casos, uno detrás del otro con la misma carga):

   | | Claude Haiku 5.5 | gpt-oss-120b |
   |---|---|---|
   | Intención | 98.9 % | 98.9 % |
   | Datos clave (meta ≥ 90 %) | **97.8 %** | 84.9 % |
   | Prudencia con el dinero | 100 % | 100 % |
   | Latencia p50 / p95 | 1010 / 1289 ms | 913 / 1471 ms |

   Haiku acierta los 11 casos de pago parcial; gpt-oss, 9. Sus dos fallas: «Le di 50 al cargador» (sale no_entendido) y el «verde» de
   una compra de mango kent verde. Sonnet 5.5 no se midió: Haiku ya pasa la meta y es el más barato y rápido.
4. **El modelo se cambia sin tocar código** con `CLAUDE_MODELO_LLM`. `/voz-precision` mide cualquier `claude-*` con
   `VOZ_MODELOS=claude-haiku-5-5`.

## Costo

Haiku 5.5 cuesta US$ 0.10 por millón de tokens de entrada y US$ 0.50 de salida. Un dictado lleva unos 3,000 de entrada (prompt y
herramientas, que van en caché) y unos 200 de salida: menos de un décimo de centavo. Con 60 dictados al día, cerca de **US$ 1 al mes**.
Es una estimación desde la tarifa, no una factura: se revisa en la consola de Anthropic después de una semana de uso.

## Consecuencias

- La transcripción, que trae apodos de clientes y montos, ahora va a Anthropic. Antes iba al plan gratuito de Groq. Que la cuenta
  de pago de Anthropic no entrene con lo que se le manda no se verificó en sus términos; hay que confirmarlo antes de producción. Ese
  punto ya está pendiente en «Antes de producción» de `CLAUDE.md`.
- Vercel necesita `ANTHROPIC_API_KEY`, que ya existe por ADR-0021.
- Si Claude se cae, se nota solo en la latencia: hasta 8 s más antes de que conteste Groq.
- Se rehace la medición al tocar el prompt, las herramientas o el modelo, con los dos modelos uno detrás del otro.
