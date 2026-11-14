# Intérprete de comandos de voz

Convierte lo que el usuario dice en una **intención con datos estructurados**. El intérprete **no** guarda nada ni busca IDs: devuelve texto tal como se dijo (`cliente_texto`, `producto_texto`), y la app lo resuelve con `buscar_clientes` / `buscar_productos` y lo muestra en la tarjeta de confirmación.

```
audio ──► Whisper (Groq) ──► transcripción ──► LLM con tool calling ──► intención + datos
           ▲ prompt con vocabulario                                         │
           │ (apodos y frutas del negocio)                                  ▼
                                                     resolver nombres → tarjeta → 1 toque → RPC
```

## 1. Prompt de vocabulario para Whisper

Whisper acepta un `prompt` corto que sesga la ortografía. Se arma **en el servidor** en cada llamada con los nombres reales de la base:

```
Venta de fruta por cajas en La Hermelinda, Trujillo. Frutas: albaricoque, bomba, caqui, cereza chilena,
ciruela chilena angelino fortuna larryaan nectarín pink lady, kiwi cilíndrico americano chileno riñón,
manzana buena delicia nacional pink lady roja americana chilena royal verde, membrillo, … Clientes: don lucho, …
Proveedores: el de piura, chao. Pagos: Yape, Plin, efectivo, transferencia, al crédito, lo debe, abonó, a cuenta.
```

Cada fruta va **una vez**, con las palabras de sus variedades sin repetir (ADR-0016): con el catálogo real, la lista de frases
(«ciruela chilena angelino, ciruela chilena fortuna…») medía 808 caracteres, pasaba el tope de ~700 y se comía a los clientes. La
selección («premium», «4ta») no va: Whisper la escribe bien solo.

Parámetros: `model: whisper-large-v3-turbo`, `language: es`, `temperature: 0`.

## 2. Prompt de sistema del intérprete

```text
Eres el intérprete de comandos de Fructus, el sistema de un mayorista de frutas de
La Hermelinda (Trujillo, Perú). Recibes la transcripción de lo que dijo el dueño o un
ayudante en su puesto y llamas EXACTAMENTE UNA herramienta.

Cómo habla el negocio:
- La unidad por defecto es la CAJA (también dicen "jaba": es lo mismo). "10 de mango" = 10 cajas.
- "a 45" o "a 45 soles" después de un producto = precio POR CAJA, no el total.
- "le dejé a 40", "le rebajé 5", "le hice 20 de descuento" = rebaja. Si dice el precio
  final ("le dejé a 40"), ese es precio_unitario; si dice un monto descontado al total,
  va en descuento_total.
- Crédito (condicion = "credito"): "lo debe", "al fiado", "a cuenta", "me apuntas",
  "anótalo", "me paga el sábado" (o cualquier día), "se lo debo" (en compras). Si aparece
  una de estas, condicion NO es null. Contado: "me pagó", "pagó", "cancelado".
- Medios: "me yapeó"/"por Yape" = yape; "plin"/"me plineó" = plin; "en efectivo",
  "en billete", "en sencillo" = efectivo; "transferencia", "depósito" = transferencia.
- A los clientes les dicen por apodo, por su negocio o por su puesto: copia la forma
  en que lo dijeron en cliente_texto ("don Lucho", "la del puesto 12"). Escribe los
  números en cifras ("puesto doce" → "puesto 12").
- "Malograda", "podrida", "se pasó", "se echó a perder" = merma.
- En una compra, "verde", "pintón" o "pintona", "maduro" o "madura" dicen cómo llegó esa
  fruta: va en estado del ítem ("verde", "pinton", "maduro"). Si no lo dijo, estado = null.
  Ojo: en "manzana verde" o "plátano verde", verde es parte del nombre de la fruta, no
  cómo llegó: va en producto_texto y estado = null.
- "Hoy hizo 29 grados", "el termómetro marca 31", "estamos a 28 grados" = registrar_temperatura
  (la temperatura del puesto, en grados).

Reglas que NO se rompen:
1. Nunca inventes dinero. Si no dijo precio, precio_unitario = null (la app sugiere
   el último precio cobrado a ese cliente).
2. Si no dijo si pagó o si lo debe, condicion = null. NO asumas contado. La app le
   preguntará con dos botones.
3. Si dijo cómo le pagaron ("me yapeó", "me plineó", "en efectivo", "por transferencia",
   "cancelado"), entonces pagó: condicion = "contado".
4. Si dijo "pagó" pero no cómo, medio_pago = "efectivo".
5. Si algo es ambiguo, llénalo con tu mejor lectura y explica la duda en `dudas`
   (frases cortas, en español, para mostrar en la tarjeta).
6. Si la frase no es un comando del negocio o no se entiende, usa no_entendido.
7. Una frase puede traer varios productos para el mismo cliente: van como varios items.
```

### 2b. El catálogo del puesto (medido, todavía NO aplicado)

`lib/voz/catalogo-reglas.ts` lo arma desde la base (productos, clientes con sus apodos y proveedores). Por ejemplo:

```text
Lo que hay en este puesto (si lo que dijo calza con uno de estos, cópialo completo: "manzana verde premium", no "manzana";
"el flaco Carlos", no "Carlos"):
- Productos: albaricoque premium, albaricoque extra, …, manzana verde premium, manzana verde comercial, membrillo 3era, …
- Clientes: don lucho / lucho (Luis Paredes); la señora rosa / puesto 12 (Rosa Quispe); …
- Proveedores: el de piura / piura (Transportes Piura Norte); chao / el de chao (Agrícola Chao).
"Me trajo", "llegó" y "compré" son compras a un proveedor, nunca ventas.
```

La idea: sin catálogo, el modelo parte «plátano isla del de Chao» en producto y proveedor equivocados y toma «el de Chao me
trajo…» por una venta (`docs/voz/precision-2026-10-28.md`). **Se midió con el catálogo ficticio del seed y no se aplicó:** no sumó
datos clave y bajó la intención (`docs/voz/precision-2026-10-28-3.md`). `interpretar()` acepta el catálogo, pero hoy nadie se lo pasa.
**Medido otra vez el 30-10 con el catálogo real** (`tests/interprete/catalogo.json`): la intención cae de 100 % a 70.8 %, porque
el modelo responde `no_entendido` cuando la fruta no está en la lista («Producto 'limón' no está en el catálogo»). Antes de volver a
probar, la redacción tiene que decir que la lista ayuda a escribir el nombre, no que manda (`docs/bitacora/2026-10-30-dudas-y-cupo-groq.md`).

## 3. Herramientas (formato OpenAI / Groq)

```json
[
  {
    "type": "function",
    "function": {
      "name": "registrar_venta",
      "description": "El usuario vendió fruta a un cliente.",
      "parameters": {
        "type": "object",
        "properties": {
          "cliente_texto": { "type": ["string", "null"], "description": "Cliente tal como lo nombró. null si no lo dijo." },
          "items": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "object",
              "properties": {
                "producto_texto": { "type": "string" },
                "cantidad": { "type": "number", "description": "Cajas." },
                "precio_unitario": { "type": ["number", "null"], "description": "Precio por caja. null si no lo dijo." }
              },
              "required": ["producto_texto", "cantidad", "precio_unitario"]
            }
          },
          "descuento_total": { "type": ["number", "null"] },
          "condicion": { "type": ["string", "null"], "enum": ["contado", "credito", null] },
          "medio_pago": { "type": ["string", "null"], "enum": ["efectivo", "yape", "plin", "transferencia", null] },
          "comprobante": { "type": "string", "enum": ["ninguno", "boleta", "factura"], "default": "ninguno" },
          "dudas": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["cliente_texto", "items", "condicion", "medio_pago", "comprobante", "dudas"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "registrar_abono",
      "description": "Un cliente pagó parte o todo lo que debe.",
      "parameters": {
        "type": "object",
        "properties": {
          "cliente_texto": { "type": "string" },
          "monto": { "type": "number" },
          "medio_pago": { "type": "string", "enum": ["efectivo", "yape", "plin", "transferencia"] },
          "dudas": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["cliente_texto", "monto", "medio_pago", "dudas"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "registrar_compra",
      "description": "Le llegó fruta de un proveedor (entra stock y es un egreso).",
      "parameters": {
        "type": "object",
        "properties": {
          "proveedor_texto": { "type": ["string", "null"] },
          "items": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "object",
              "properties": {
                "producto_texto": { "type": "string" },
                "cantidad": { "type": "number" },
                "costo_unitario": { "type": ["number", "null"] },
                "estado": { "type": ["string", "null"], "enum": ["verde", "pinton", "maduro", null], "default": null, "description": "Cómo llegó la fruta: verde, pintón o maduro. null si no lo dijo." }
              },
              "required": ["producto_texto", "cantidad", "costo_unitario"]
            }
          },
          "condicion": { "type": ["string", "null"], "enum": ["contado", "credito", null] },
          "dudas": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["proveedor_texto", "items", "condicion", "dudas"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "registrar_merma",
      "description": "Fruta que se malogró y sale del stock sin venderse.",
      "parameters": {
        "type": "object",
        "properties": {
          "producto_texto": { "type": "string" },
          "cantidad": { "type": "number" },
          "motivo": { "type": ["string", "null"] }
        },
        "required": ["producto_texto", "cantidad", "motivo"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "registrar_gasto",
      "description": "Un gasto que no es compra de fruta.",
      "parameters": {
        "type": "object",
        "properties": {
          "categoria": { "type": "string", "enum": ["flete", "alquiler", "servicios", "personal", "otros"] },
          "monto": { "type": "number" },
          "descripcion": { "type": ["string", "null"] },
          "medio_pago": { "type": "string", "enum": ["efectivo", "yape", "plin", "transferencia"], "default": "efectivo" }
        },
        "required": ["categoria", "monto", "descripcion", "medio_pago"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "registrar_temperatura",
      "description": "La temperatura que marca el termómetro del puesto.",
      "parameters": {
        "type": "object",
        "properties": {
          "grados": { "type": "number", "description": "Grados Celsius que marca el termómetro." }
        },
        "required": ["grados"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "consultar",
      "description": "Una pregunta sobre el negocio.",
      "parameters": {
        "type": "object",
        "properties": {
          "consulta": {
            "type": "string",
            "enum": ["ventas_hoy", "quien_me_debe", "deuda_cliente", "stock", "stock_producto", "gastos_hoy", "resumen_dia"]
          },
          "cliente_texto": { "type": ["string", "null"] },
          "producto_texto": { "type": ["string", "null"] }
        },
        "required": ["consulta", "cliente_texto", "producto_texto"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "no_entendido",
      "description": "La frase no es un comando del negocio o no se entiende.",
      "parameters": {
        "type": "object",
        "properties": { "motivo": { "type": "string" } },
        "required": ["motivo"]
      }
    }
  }
]
```

Llamar con `tool_choice: "required"` y `temperature: 0`.

## 4. Casos de prueba (deben pasar antes de la demo)

| Transcripción | Herramienta | Datos clave |
|---|---|---|
| "Vendí 10 cajas de mango kent a don Lucho a 45, me yapeó" | registrar_venta | cliente "don Lucho", 10 × 45, contado, yape |
| "Diez de papaya para la del puesto doce, lo debe" | registrar_venta | cliente "la del puesto 12", precio null, crédito |
| "5 de plátano seda y 3 de piña al Paraíso a 30 y 40, factura" | registrar_venta | 2 items, comprobante factura, condicion null |
| "Mango a don Lucho, 8 jabas, le dejé a 42" | registrar_venta | precio_unitario 42 |
| "Don Lucho me abonó 200 en efectivo" | registrar_abono | 200, efectivo |
| "Llegaron 50 cajas de plátano isla del de Chao a 25" | registrar_compra | 50 × 25 |
| "Se malograron 3 jabas de papaya" | registrar_merma | 3 |
| "Pagué 80 de flete" | registrar_gasto | flete, 80 |
| "Hoy hizo 29 grados" | registrar_temperatura | 29 |
| "Llegaron 30 cajas de mango kent verde a 32, lo pagué" | registrar_compra | 30 × 32, estado verde, contado |
| "Llegaron 20 cajas de manzana verde a 90" | registrar_compra | producto "manzana verde", estado null |
| "¿Quién me debe?" | consultar | quien_me_debe |
| "¿Cuánto me debe el flaco?" | consultar | deuda_cliente, "el flaco" |
| "¿Cuántas cajas de mango me quedan?" | consultar | stock_producto, "mango" |
| "Oye, ¿ya almorzaste?" | no_entendido | — |

Estos casos viven en `tests/interprete/casos.json` y `/voz-precision` los corre contra el modelo real. La tasa de acierto es una métrica del proyecto universitario. Un caso que falla nunca se borra para mejorar el número.

## 5. Después de interpretar

1. Registrar el comando en `comandos_voz` (transcripción, intención, JSON, latencia).
2. Resolver `cliente_texto` / `producto_texto` con `buscar_*`. Similitud ≥ 0.45 **y** al menos 0.15 por encima del segundo → se
   elige sola; si no, la tarjeta muestra las 3 mejores opciones para tocar una. El margen existe por el catálogo real (ADR-0016):
   «manzana verde» calza igual con la Premium (0.64) y con la Comercial (0.58), y elegir una sería adivinar. `buscar_productos`
   compara contra fruta + variedad + selección, contra el nombre completo con marca y calibre, y contra los alias
   («membrillo de cuarta»). Un alias nunca es el nombre a secas de una fruta con varias selecciones.
3. Precio null → `ultimo_precio(cliente, producto)`, marcado como "sugerido" en la tarjeta.
4. Condición null → dos botones grandes: **Pagó** / **Lo debe**.
5. Al confirmar → `registrar_venta` / `registrar_compra` con `comando_voz_id` (marcan el comando como `confirmado`). Abonos, mermas y gastos se insertan directo en su tabla y la app marca el comando.
6. Si el usuario editó algo de la tarjeta, marcar el comando como `corregido` **antes** de guardar (la RPC solo cambia comandos que siguen `pendiente`). Si lo descartó, `descartado`.

## 6. Dónde vive y cómo se mide

| Pieza | Archivo | Prueba |
|---|---|---|
| Herramientas y validación | `lib/voz/esquemas.ts` (Zod, genera el JSON Schema para Groq) | `lib/voz/esquemas.test.ts` |
| Prompt de sistema | `lib/voz/prompt.ts` (idéntico a la sección 2; una prueba lo verifica) | `lib/voz/esquemas.test.ts` |
| Voz a texto | `lib/voz/stt.ts` (Groq Whisper, Gemini de respaldo, tope de 8 s) | `pnpm voz:stt` → `docs/voz/stt-*.md` |
| Vocabulario y catálogo | `lib/voz/catalogo-reglas.ts`, `lib/voz/catalogo.ts` (caché de 5 min) | `lib/voz/catalogo-reglas.test.ts` |
| Intérprete | `lib/voz/interprete.ts` (Groq `openai/gpt-oss-120b`, Gemini de respaldo, tope de 8 s) | `pnpm voz:precision` → `docs/voz/precision-*.md` |
| Tarjeta | `lib/voz/tarjeta-reglas.ts` (lógica pura) | `lib/voz/tarjeta-reglas.test.ts` |
| Resolver | `lib/voz/resolver.ts` (buscar_*, ultimo_precio) | `tests/e2e/voz-api.spec.ts` |
| Todo junto | `app/api/voz/route.ts` | `tests/e2e/voz-api.spec.ts` |

El modelo del intérprete se eligió con números (`docs/voz/precision-2026-10-28.md`): `gpt-oss-120b` le ganó a `gpt-oss-20b` en
intención y datos, con la misma latencia. Se cambia con `GROQ_MODELO_LLM`, y solo después de correr `/voz-precision`.
