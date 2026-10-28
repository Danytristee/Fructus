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
Venta de fruta por cajas en La Hermelinda, Trujillo. Clientes: don Lucho, la señora Rosa,
el Paraíso, Santa Ana, el flaco Carlos, el Mochica. Frutas: mango Kent, mango Edward,
plátano de seda, plátano isla, papaya, piña golden, mandarina, uva red globe, palta fuerte,
limón. Pagos: Yape, Plin, efectivo, al crédito, lo debe, abonó.
```

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
- Crédito: "lo debe", "al fiado", "a cuenta", "me apuntas", "me paga el sábado",
  "anótalo". Contado: "me pagó", "pagó", "cancelado".
- Medios: "me yapeó"/"por Yape" = yape; "plin"/"me plineó" = plin; "en efectivo",
  "en billete", "en sencillo" = efectivo; "transferencia", "depósito" = transferencia.
- A los clientes les dicen por apodo, por su negocio o por su puesto: copia la forma
  en que lo dijeron en cliente_texto ("don Lucho", "la del puesto 12"). Escribe los
  números en cifras ("puesto doce" → "puesto 12").
- "Malograda", "podrida", "se pasó", "se echó a perder" = merma.

Reglas que NO se rompen:
1. Nunca inventes dinero. Si no dijo precio, precio_unitario = null (la app sugiere
   el último precio cobrado a ese cliente).
2. Si no dijo si pagó o si lo debe, condicion = null. NO asumas contado. La app le
   preguntará con dos botones.
3. Si dijo "pagó" pero no cómo, medio_pago = "efectivo".
4. Si algo es ambiguo, llénalo con tu mejor lectura y explica la duda en `dudas`
   (frases cortas, en español, para mostrar en la tarjeta).
5. Si la frase no es un comando del negocio o no se entiende, usa no_entendido.
6. Una frase puede traer varios productos para el mismo cliente: van como varios items.
```

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
                "costo_unitario": { "type": ["number", "null"] }
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
| "¿Quién me debe?" | consultar | quien_me_debe |
| "¿Cuánto me debe el flaco?" | consultar | deuda_cliente, "el flaco" |
| "¿Cuántas cajas de mango me quedan?" | consultar | stock_producto, "mango" |
| "Oye, ¿ya almorzaste?" | no_entendido | — |

Estos casos viven en `tests/interprete/casos.json` y `/voz-precision` los corre contra el modelo real. La tasa de acierto es una métrica del proyecto universitario. Un caso que falla nunca se borra para mejorar el número.

## 5. Después de interpretar

1. Registrar el comando en `comandos_voz` (transcripción, intención, JSON, latencia).
2. Resolver `cliente_texto` / `producto_texto` con `buscar_*`. Similitud ≥ 0.45 → se elige sola; menor → la tarjeta muestra las 3 mejores opciones para tocar una.
3. Precio null → `ultimo_precio(cliente, producto)`, marcado como "sugerido" en la tarjeta.
4. Condición null → dos botones grandes: **Pagó** / **Lo debe**.
5. Al confirmar → `registrar_venta` / `registrar_compra` con `comando_voz_id` (marcan el comando como `confirmado`). Abonos, mermas y gastos se insertan directo en su tabla y la app marca el comando.
6. Si el usuario editó algo de la tarjeta, marcar el comando como `corregido` **antes** de guardar (la RPC solo cambia comandos que siguen `pendiente`). Si lo descartó, `descartado`.
