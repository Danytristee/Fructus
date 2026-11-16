# /voz-precision · 2026-11-16

**Casos:** 70 (`tests/interprete/casos.json`). **Proveedor:** Groq, sin respaldo (para comparar modelos limpio). **Catálogo en el prompt:** no. **Medido:** solo el intérprete (texto → herramienta); la voz a texto se mide aparte.

| Modelo | Intención (meta ≥ 95 %) | Datos clave (meta ≥ 90 %) | Prudencia con el dinero (meta 100 %) | Latencia p50 | p95 |
|---|---|---|---|---|---|
| `openai/gpt-oss-120b` | 97.1 % (68/70) | 82.9 % (58/70) | 100.0 % (0 invento(s) en 26 campos) | 837 ms | 1425 ms |

## `openai/gpt-oss-120b`: casos que fallan (12)

- **compra-proveedor** (1186 ms)
  - items[0].producto_texto: esperaba «platano isla», vino "plátano"
  - vino: `registrar_compra {"proveedor_texto":"isla del de Chao","items":[{"producto_texto":"plátano","cantidad":50,"costo_unitario":25,"estado":null}],"condicion":null,"dudas":[]}`
- **consulta-stock-producto** (1099 ms)
  - consulta: esperaba «stock_producto», vino "stock"
  - vino: `consultar {"consulta":"stock","cliente_texto":null,"producto_texto":"mango"}`
- **venta-mochica-efectivo** (920 ms)
  - cliente_texto: esperaba «mochica», vino null
  - vino: `registrar_venta {"cliente_texto":null,"items":[{"producto_texto":"piña golden","cantidad":6,"precio_unitario":40}],"descuento_total":null,"condicion":"contado","medio_pago":"efectivo","comprobante":"ninguno","dudas":[]}`
- **venta-credito-sabado** (2026 ms)
  - cliente_texto: esperaba «flaco carlos», vino "Carlos"
  - vino: `registrar_venta {"cliente_texto":"Carlos","items":[{"producto_texto":"mandarina","cantidad":4,"precio_unitario":null}],"descuento_total":null,"condicion":"credito","medio_pago":null,"comprobante":"ninguno","dudas":[]}`
- **venta-anotalo** (716 ms)
  - condicion: esperaba «credito», vino null
  - vino: `registrar_venta {"cliente_texto":"Santa Ana","items":[{"producto_texto":"mango edward","cantidad":12,"precio_unitario":38}],"descuento_total":null,"condicion":null,"medio_pago":null,"comprobante":"ninguno","dudas":[]}`
- **venta-me-apuntas** (1164 ms)
  - condicion: esperaba «credito», vino null
  - vino: `registrar_venta {"cliente_texto":"Carlos","items":[{"producto_texto":"plátano seda","cantidad":6,"precio_unitario":null}],"descuento_total":null,"condicion":null,"medio_pago":null,"comprobante":"ninguno","dudas":["No se `
- **gasto-cargador** (828 ms)
  - herramienta: esperaba registrar_gasto, vino no_entendido
  - vino: `no_entendido {"motivo":"Frase ambigua, no se reconoce como comando de venta, compra, merma, gasto o temperatura."}`
- **consulta-como-voy** (710 ms)
  - herramienta: esperaba consultar, vino no_entendido
  - vino: `no_entendido {"motivo":"Frase no reconocida como comando del negocio"}`
- **catalogo-real-venta-seleccion-hablada** (875 ms)
  - cliente_texto: esperaba «el flaco carlos», vino "Carlos"
  - vino: `registrar_venta {"cliente_texto":"Carlos","items":[{"producto_texto":"membrillo de cuarta","cantidad":2,"precio_unitario":150}],"descuento_total":null,"condicion":"contado","medio_pago":"efectivo","comprobante":"ninguno"`
- **catalogo-real-venta-dos-selecciones** (922 ms)
  - cliente_texto: esperaba «paraiso», vino null
  - vino: `registrar_venta {"cliente_texto":null,"items":[{"producto_texto":"caqui super","cantidad":4,"precio_unitario":140},{"producto_texto":"caqui segunda","cantidad":2,"precio_unitario":90}],"descuento_total":null,"condicion":`
- **catalogo-real-merma** (558 ms)
  - producto_texto: esperaba «albaricoque de segunda», vino "albaricoque"
  - vino: `registrar_merma {"producto_texto":"albaricoque","cantidad":2,"motivo":"segunda"}`
- **temperatura-con-medio-grado** (1132 ms)
  - grados: esperaba 28.5, vino 28
  - vino: `registrar_temperatura {"grados":28}`

### Dudas que salieron (4 de 70 casos)

- **venta-sin-nada:** «No se indicó cliente, precio, condición de pago ni medio de pago.»
- **venta-boleta-sin-condicion:** «no se indicó precio ni forma de pago»
- **venta-me-apuntas:** «No se indicó precio unitario ni forma de pago.»
- **compra-sin-precio:** «precio no especificado»

## Lectura (agregada a mano el mismo día)

Es la primera corrida completa desde el 31-10. Entre medio cambiaron el prompt dos obras sin medir: la del catálogo (10-11) y la del aviso
de frescura (14-11). **Datos clave quedó en 82.9 %, bajo la meta de 90 %.** La intención (97.1 %) y la prudencia con el dinero (100 %)
cumplen.

**Los 12 fallos, por causa:**

| Causa | Casos | ¿Desde cuándo? |
|---|---|---|
| Apodo o negocio del cliente recortado o perdido («flaco Carlos» → «Carlos»; «al Mochica» y «al Paraíso» → sin cliente) | 4 | Uno ya fallaba el 31-10; dos son casos del 10-11 |
| Selección o variedad de la fruta recortada («plátano isla» → «plátano»; «albaricoque de segunda» → «albaricoque») | 2 | Uno ya fallaba el 31-10; el otro es del 10-11 |
| Crédito que queda sin decir («anótalo», «me apuntas») | 2 | Va y viene desde el 30-10. No inventa plata: la tarjeta pregunta |
| La frase no se entiende («Le di 50 al cargador», «¿Cómo voy?») | 2 | **Nuevo: lo causó el aviso de frescura** |
| Pregunta por una fruta tomada como pregunta por todo el stock | 1 | **Nuevo: lo causó el aviso de frescura** |
| «28 grados y medio» → 28 | 1 | Caso nuevo del aviso de frescura |

**Cómo se supo qué lo causó:** los tres casos que antes pasaban se corrieron solos con el prompt de antes de la obra (`66959ce`) y con
el de ahora. Con el de antes, intención 3 de 3. Con el de ahora, 1 de 3, dos veces seguidas.

**Qué se corrigió** (rama `claude/frescura-seguimiento`): las tres reglas que la obra había puesto en el prompt general pasaron a la
descripción de cada herramienta y de su campo; el prompt volvió a ser el del 10-11. Y que «manzana verde» no es «llegó verde» ya no se
le pide al modelo: se decide contando (`lib/voz/como-llego-reglas.ts`).

**Medido con la corrección,** solo en los 3 casos rotos y los 8 que agregó la obra (el cupo del día de Groq no daba para los 70):
intención 11 de 11; datos 10 de 11. El que falla en datos es «Le di 50 al cargador», que ahora vuelve a entenderse como gasto pero con
la categoría «otros» en vez de «personal», igual que antes de la obra.

**Falta:** la corrida completa de los 70 con la corrección, antes de fusionarla. Lo esperado es intención 70 de 70 y datos 61 de 70
(87.1 %). Para llegar a 90 % hay que atacar los apodos de clientes y la selección de la fruta, que no son de esta obra.
