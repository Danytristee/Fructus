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
  va en descuento_total. Ojo: "ME dejó 200" o "me dio 200" es lo que el cliente PAGÓ, no una rebaja.
- Crédito (condicion = "credito"): "lo debe", "al fiado", "a cuenta", "me apuntas",
  "anótalo", "me paga el sábado" (o cualquier día), "se lo debo" (en compras). Si aparece
  una de estas, condicion NO es null. Contado: "me pagó", "pagó", "cancelado".
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
3. Si dijo cómo le pagaron ("me yapeó", "me plineó", "en efectivo", "por transferencia",
   "cancelado"), entonces pagó: condicion = "contado". Si pagó solo una parte, no es
   contado: es "credito" con lo que pagó en pago_parcial.
4. Si dijo "pagó" (todo o una parte) pero no cómo, medio_pago = "efectivo".
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

### 2c. Corregir hablando (ADR-0020)

Con manos libres, Fructus lee la venta y pregunta «¿Confirmo?». Si en vez de confirmar la persona corrige («no, son ocho cajas», «a
cuarenta», «es para don Lucho»), `POST /api/voz/respuesta` vuelve a llamar al intérprete.

- **El prompt de sistema no cambia.** Lo que cambia es el mensaje del usuario (`mensajeCorreccion`, `lib/voz/prompt.ts`):
  - lleva **la venta actual en los campos de `registrar_venta`**: el celular la arma con `ventaActual` y el servidor la valida con `esquemaVentaActual`;
  - lleva lo que respondió la persona;
  - dice dos reglas explícitas: el cliente es el mismo si no nombra a otro, y «45 con 50» es un precio de 45.50 (lo que va después de «con» son los céntimos).
- **Por qué la venta va en datos:** al principio se mandaba la lectura en frases. El /chaos del 2026-11-16 encontró que en 3 de 12 corridas el modelo perdía al cliente, y que «No, a 45 con 50» salía 50 (una vez, «total 50 con 400 de rebaja»). Con la venta en datos y las dos reglas, las 17 correcciones que Groq respondió salieron bien: 12 de 12 y 5 de 5. El resto de esa corrida fueron cortes del plan gratuito (429).
- **Lo que vuelve:** un `registrar_venta` como el de una venta dictada. Pasa por Zod, por `resolver` y por `armarTarjeta`, y vuelve como tarjeta nueva para leer y confirmar. En voz alta se dice solo lo que cambió respecto de la tarjeta anterior, con el total si cambió el dinero (`guionCorreccion`, `lib/voz/lectura-reglas.ts`; ADR-0020, 2026-11-17). «Repite» lee la venta entera.
- **Sin contenido no se llama al modelo:** una respuesta como «no» o «sí» se repregunta (`pareceCorreccion`). «Repite» o «¿qué?» vuelven a leer, también sin modelo (`pideQueRepita`).
- **Si el modelo no devuelve una venta,** la respuesta cuenta como «otra cosa».
- **Los casos** viven en `tests/interprete/casos.json`: los `correccion-*`, con `correccionDe`, que es la venta actual en datos.

## 3. Herramientas (formato OpenAI / Groq)

**Lo que es de una sola herramienta va aquí, no en el prompt de la sección 2:** en su descripción o en la de su campo (qué frases
son la temperatura, cómo se dice que la fruta llegó verde, qué pregunta es cada `consulta`). El 14-11 se pusieron tres reglas así
en el prompt general y el modelo dejó de entender «¿Cómo voy?», «¿Cuántas cajas de mango me quedan?» y «Le di 50 al cargador»
(`docs/voz/precision-2026-11-16.md`). Con esas reglas en las descripciones, los tres vuelven a salir bien.

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
                "precio_unitario": { "type": ["number", "null"], "description": "Precio por caja. null si no lo dijo o si dijo un total." },
                "total_item": { "type": ["number", "null"], "description": "Si dijo cuánto fue TODO por esa fruta («todo por 500»): ese total, sin dividir." }
              },
              "required": ["producto_texto", "cantidad", "precio_unitario"]
            }
          },
          "descuento_total": { "type": ["number", "null"] },
          "condicion": { "type": ["string", "null"], "enum": ["contado", "credito", null] },
          "pago_parcial": { "type": ["number", "null"], "description": "Si pagó SOLO UNA PARTE al llevarse la fruta, cuánto pagó (condicion = credito). No es un descuento." },
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
                "estado": { "type": ["string", "null"], "enum": ["verde", "pinton", "maduro", null], "default": null, "description": "Cómo llegó esa fruta, si lo dijo: \"verde\", \"pintón\" o \"pintona\" (pinton), \"maduro\" o \"madura\". Si no lo dijo, null. En \"manzana verde\" o \"plátano verde\", verde es parte del nombre de la fruta: va en producto_texto y aquí null." }
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
      "description": "La temperatura del puesto: \"hoy hizo 29 grados\", \"el termómetro marca 31\", \"estamos a 28 grados\".",
      "parameters": {
        "type": "object",
        "properties": {
          "grados": { "type": "number", "minimum": -99, "maximum": 999, "description": "Grados Celsius que marca el termómetro, en cifras. \"28 grados y medio\" = 28.5." }
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
            "enum": ["ventas_hoy", "quien_me_debe", "deuda_cliente", "stock", "stock_producto", "gastos_hoy", "resumen_dia", "que_sale_hoy"],
            "description": "Qué pregunta. ventas_hoy: cuánto vendió hoy. quien_me_debe: quiénes le deben. deuda_cliente: cuánto debe un cliente. stock: todo lo que tiene. stock_producto: cuántas cajas le quedan de UNA fruta. gastos_hoy: cuánto gastó hoy. resumen_dia: cómo va el día (\"¿cómo voy?\"). que_sale_hoy: qué fruta tiene que salir hoy o se va a malograr, qué vender primero."
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
| "Vendí 10 cajas de mango a don Lucho a 500 y pagó solo 1000" | registrar_venta | 10 × 500, crédito, pago_parcial 1000, efectivo (nunca contado con S/ 4,000 de descuento: ADR-0025) |
| "Vendí 10 de mango a don Lucho a 45, a cuenta" | registrar_venta | crédito, pago_parcial null («a cuenta» sola es crédito) |
| "Le vendí 10 cajas de mango a don Lucho, todo por 500, lo debe" | registrar_venta | precio_unitario null, total_item 500 (la tarjeta lo divide: 50) |
| "Tres cajas de palta a don Lucho por 100 soles, lo debe" | registrar_venta | total_item 100: no se divide exacto, el precio queda por elegir (nunca 100 la caja) |
| "Vendí 10 de mango a don Lucho a 45, me dio 500 y le di 50 de vuelto" | registrar_venta | contado, pago_parcial null |
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
| "¿Qué tiene que salir hoy?" | consultar | que_sale_hoy |
| "Oye, ¿ya almorzaste?" | no_entendido | — |

Estos casos viven en `tests/interprete/casos.json` y `/voz-precision` los corre contra el modelo real. La tasa de acierto es una métrica del proyecto universitario. Un caso que falla nunca se borra para mejorar el número.

## 5. Después de interpretar

0. En una compra, quitar el estado que era parte del nombre (`lib/voz/como-llego-reglas.ts`): si la fruta se llama «manzana
   verde» y la frase dijo «verde» una sola vez, no llegó verde. Se decide contando, no se le pide al modelo.
1. Registrar el comando en `comandos_voz` (transcripción, intención, JSON, latencia).
2. Resolver `cliente_texto` / `producto_texto` con `buscar_*`. Similitud ≥ 0.45 **y** al menos 0.15 por encima del segundo → se
   elige sola; si no, la tarjeta muestra las 3 mejores opciones para tocar una. El margen existe por el catálogo real (ADR-0016):
   «manzana verde» calza igual con la Premium (0.64) y con la Comercial (0.58), y elegir una sería adivinar. `buscar_productos`
   compara contra fruta + variedad + selección, contra el nombre completo con marca y calibre, y contra los alias
   («membrillo de cuarta»). Un alias nunca es el nombre a secas de una fruta con varias selecciones.
3. Precio null → `ultimo_precio(cliente, producto)`, marcado como "sugerido" en la tarjeta. Si dijo un total (`total_item`), el precio
   es ese total entre las cajas, contado en la tarjeta (`precioDeTotal`), y no se sugiere otro. Si no sale exacto en céntimos
   («3 por 100»), queda por elegir con la duda escrita. El modelo no divide: «3 cajas por 100» salía a 100 la caja.
4. Condición null → dos botones grandes: **Pagó** / **Lo debe**.
4b. `pago_parcial` (ADR-0025) → la venta va al crédito y la tarjeta dice cuánto pagó y cuánto queda debiendo. Si lo que pagó llega al
   total con precios dichos («me dio 500 y le di 50 de vuelto»), es contado. Con un precio sugerido no se decide solo: si llega al
   total, la tarjeta pide corregirlo. Se guarda como abono atado a la venta (`registrar_venta`, `pago_inicial`).
5. Al confirmar → `registrar_venta` / `registrar_compra` con `comando_voz_id` (marcan el comando como `confirmado`). Abonos, mermas y gastos se insertan directo en su tabla y la app marca el comando. En las dos formas, solo quien dictó el comando (o el dueño o el administrador) puede guardar con él: la RLS lo exige.
6. Si el usuario editó algo de la tarjeta, marcar el comando como `corregido` **antes** de guardar (la RPC solo cambia comandos que siguen `pendiente`). Si lo descartó, `descartado`.

## 6. Dónde vive y cómo se mide

| Pieza | Archivo | Prueba |
|---|---|---|
| Herramientas y validación | `lib/voz/esquemas.ts` (Zod, genera el JSON Schema para Groq) | `lib/voz/esquemas.test.ts` |
| Prompt de sistema | `lib/voz/prompt.ts` (idéntico a la sección 2; una prueba lo verifica) | `lib/voz/esquemas.test.ts` |
| Voz a texto | `lib/voz/stt.ts` (Groq Whisper con dos cuentas, Gemini `gemini-3.1-flash-lite` de respaldo, tope de 8 s) | `pnpm voz:stt` → `docs/voz/stt-*.md` |
| Vocabulario y catálogo | `lib/voz/catalogo-reglas.ts`, `lib/voz/catalogo.ts` (caché de 5 min) | `lib/voz/catalogo-reglas.test.ts` |
| Intérprete | `lib/voz/interprete.ts`: Claude `claude-haiku-5-5` (`lib/voz/interprete-claude.ts`, ADR-0026), después Groq `openai/gpt-oss-120b` con dos cuentas y Gemini `gemini-3.1-flash-lite`; tope de 8 s cada uno | `pnpm voz:precision` → `docs/voz/precision-*.md` |
| Tarjeta | `lib/voz/tarjeta-reglas.ts` (lógica pura) | `lib/voz/tarjeta-reglas.test.ts` |
| Resolver | `lib/voz/resolver.ts` (buscar_*, ultimo_precio) | `tests/e2e/voz-api.spec.ts` |
| Todo junto | `app/api/voz/route.ts` | `tests/e2e/voz-api.spec.ts` |

**El orden de los proveedores** vive en `lib/voz/respaldo-reglas.ts`, con su prueba. Para la voz a texto: Groq con `GROQ_API_KEY` →
Groq con `GROQ_API_KEY_RESPALDO` (otra cuenta, con su propio cupo gratuito) → Gemini. Para el intérprete va **Claude primero**
(ADR-0026: Claude no escucha audio, pero entiende mejor el texto) y después el mismo orden; si Claude falla por lo que sea, se pasa a Groq.
- La cuenta de respaldo solo se prueba si la principal respondió 429 (sin cupo), 401 o 403 (clave rechazada).
- Si Groq no respondió en 8 s, se cayó o devolvió algo inválido, la otra cuenta daría lo mismo y sumaría otros 8 s de espera: se
  pasa directo a Gemini.
- `/voz-precision` mide cada modelo solo contra su servicio (`solo: "groq"` o `solo: "anthropic"`). Con Groq usa las dos cuentas: es el mismo modelo, así que los números no cambian y el cupo es el doble.
- Medido el 2026-11-16 contra Groq real, con la principal rechazada: el intérprete respondió con la de respaldo en 1.2 s en total.
- **Gemini, el 2026-11-17:** con la clave nueva, `gemini-2.5-flash` respondía 404 («ya no está disponible para usuarios nuevos»): el
  respaldo nunca habría funcionado. Los flash completos daban 503 por demanda en el plan gratuito. `gemini-3.1-flash-lite` respondió:
  con los 22 casos de dinero y pago parcial, intención 95.5 %, datos 90.9 %, sin inventos (uno no respondió en 8 s). Se cambia con
  `GEMINI_MODELO_LLM` y `GEMINI_MODELO_STT`. Para la voz a texto falta medirlo con audios reales del puesto: con una voz sintética
  se equivocan todos, Whisper incluido.

El modelo del intérprete se eligió con números (`docs/voz/precision-2026-10-28.md`): `gpt-oss-120b` le ganó a `gpt-oss-20b` en
intención y datos, con la misma latencia. Se cambia con `GROQ_MODELO_LLM`, y solo después de correr `/voz-precision`.
