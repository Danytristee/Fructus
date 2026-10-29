# /voz-precision · 2026-10-28

**Casos:** 48 (`tests/interprete/casos.json`). **Proveedor:** Groq, sin respaldo (para comparar modelos limpio). **Medido:** solo el intérprete (texto → herramienta); la voz a texto se mide aparte.

| Modelo | Intención (meta ≥ 95 %) | Datos clave (meta ≥ 90 %) | Prudencia con el dinero (meta 100 %) | Latencia p50 | p95 |
|---|---|---|---|---|---|
| `openai/gpt-oss-120b` | 97.9 % (47/48) | 83.3 % (40/48) | 100.0 % (0 invento(s) en 24 campos) | 947 ms | 1673 ms |
| `openai/gpt-oss-20b` | 93.8 % (45/48) | 62.5 % (30/48) | 100.0 % (0 invento(s) en 24 campos) | 1024 ms | 1631 ms |

## `openai/gpt-oss-120b`: casos que fallan (8)

- **compra-proveedor** (1380 ms)
  - items[0].producto_texto: esperaba «platano isla», vino "plátano"
  - vino: `registrar_compra {"proveedor_texto":"isla del de Chao","items":[{"producto_texto":"plátano","cantidad":50,"costo_unitario":25}],"condicion":null,"dudas":[]}`
- **venta-credito-sabado** (1140 ms)
  - cliente_texto: esperaba «flaco carlos», vino "Carlos"
  - vino: `registrar_venta {"cliente_texto":"Carlos","items":[{"producto_texto":"mandarina","cantidad":4,"precio_unitario":null}],"descuento_total":null,"condicion":"credito","medio_pago":null,"comprobante":"ninguno","dudas":[]}`
- **venta-plin** (934 ms)
  - condicion: esperaba «contado», vino null
  - vino: `registrar_venta {"cliente_texto":"señora Rosa","items":[{"producto_texto":"uva","cantidad":3,"precio_unitario":60}],"descuento_total":null,"condicion":null,"medio_pago":"plin","comprobante":"ninguno","dudas":[]}`
- **venta-anotalo** (1517 ms)
  - items[0].producto_texto: esperaba «mango edward», vino "mango"
  - condicion: esperaba «credito», vino null
  - vino: `registrar_venta {"cliente_texto":"Santa Ana","items":[{"producto_texto":"mango","cantidad":12,"precio_unitario":38}],"descuento_total":null,"condicion":null,"medio_pago":null,"comprobante":"ninguno","dudas":[]}`
- **venta-transferencia** (1022 ms)
  - condicion: esperaba «contado», vino null
  - vino: `registrar_venta {"cliente_texto":"la juguería","items":[{"producto_texto":"limón","cantidad":8,"precio_unitario":50}],"descuento_total":null,"condicion":null,"medio_pago":"transferencia","comprobante":"ninguno","dudas":[`
- **venta-me-apuntas** (1529 ms)
  - condicion: esperaba «credito», vino null
  - vino: `registrar_venta {"cliente_texto":"Carlos","items":[{"producto_texto":"plátano seda","cantidad":6,"precio_unitario":null}],"descuento_total":null,"condicion":null,"medio_pago":null,"comprobante":"ninguno","dudas":["No se `
- **venta-yapeo-sin-precio** (1045 ms)
  - condicion: esperaba «contado», vino null
  - vino: `registrar_venta {"cliente_texto":"Don Lucho","items":[{"producto_texto":"piña","cantidad":5,"precio_unitario":null}],"descuento_total":null,"condicion":null,"medio_pago":"yape","comprobante":"ninguno","dudas":[]}`
- **compra-credito** (1331 ms)
  - herramienta: esperaba registrar_compra, vino registrar_venta
  - vino: `registrar_venta {"cliente_texto":"el de Chao","items":[{"producto_texto":"piña","cantidad":40,"precio_unitario":26}],"descuento_total":null,"condicion":"credito","medio_pago":null,"comprobante":"ninguno","dudas":[]}`

## `openai/gpt-oss-20b`: casos que fallan (18)

- **venta-contado-yape** (1147 ms)
  - condicion: esperaba «contado», vino null
  - vino: `registrar_venta {"cliente_texto":"don Lucho","items":[{"producto_texto":"mango kent","cantidad":10,"precio_unitario":45}],"descuento_total":null,"condicion":null,"medio_pago":"yape","comprobante":"ninguno","dudas":[]}`
- **venta-credito-sin-precio** (811 ms)
  - condicion: esperaba «credito», vino null
  - vino: `registrar_venta {"cliente_texto":"puesto 12","items":[{"producto_texto":"papaya","cantidad":10,"precio_unitario":null}],"descuento_total":null,"condicion":null,"medio_pago":null,"comprobante":"ninguno","dudas":[]}`
- **venta-dos-items-factura-sin-condicion** (763 ms)
  - cliente_texto: esperaba «paraiso», vino null
  - vino: `registrar_venta {"cliente_texto":null,"items":[{"producto_texto":"plátano seda","cantidad":5,"precio_unitario":30},{"producto_texto":"piña al Paraíso","cantidad":3,"precio_unitario":40}],"descuento_total":null,"condicion`
- **compra-proveedor** (1196 ms)
  - proveedor_texto: esperaba «el de chao», vino null
  - vino: `registrar_compra {"proveedor_texto":null,"items":[{"producto_texto":"plátano isla del de Chao","cantidad":50,"costo_unitario":25}],"condicion":null,"dudas":[]}`
- **venta-mochica-efectivo** (1172 ms)
  - condicion: esperaba «contado», vino null
  - vino: `registrar_venta {"cliente_texto":"Mochica","items":[{"producto_texto":"piña golden","cantidad":6,"precio_unitario":40}],"descuento_total":null,"condicion":null,"medio_pago":"efectivo","comprobante":"ninguno","dudas":[]}`
- **venta-credito-sabado** (1301 ms)
  - condicion: esperaba «credito», vino null
  - vino: `registrar_venta {"cliente_texto":"Al flaco Carlos","items":[{"producto_texto":"mandarina","cantidad":4,"precio_unitario":null}],"descuento_total":null,"condicion":null,"medio_pago":null,"comprobante":"ninguno","dudas":[]`
- **venta-plin** (615 ms)
  - condicion: esperaba «contado», vino null
  - vino: `registrar_venta {"cliente_texto":"señora Rosa","items":[{"producto_texto":"uva","cantidad":3,"precio_unitario":60}],"descuento_total":null,"condicion":null,"medio_pago":"plin","comprobante":"ninguno","dudas":[]}`
- **venta-anotalo** (1019 ms)
  - items[0].producto_texto: esperaba «mango edward», vino "mango"
  - condicion: esperaba «credito», vino null
  - vino: `registrar_venta {"cliente_texto":"Santa Ana","items":[{"producto_texto":"mango","cantidad":12,"precio_unitario":38}],"descuento_total":null,"condicion":null,"medio_pago":null,"comprobante":"ninguno","dudas":[]}`
- **venta-transferencia** (710 ms)
  - condicion: esperaba «contado», vino null
  - vino: `registrar_venta {"cliente_texto":"la juguería","items":[{"producto_texto":"limón","cantidad":8,"precio_unitario":50}],"descuento_total":null,"condicion":null,"medio_pago":"transferencia","comprobante":"ninguno","dudas":[`
- **venta-descuento-total** (1236 ms)
  - condicion: esperaba «contado», vino null
  - vino: `registrar_venta {"cliente_texto":"Paraíso","items":[{"producto_texto":"plátano isla","cantidad":20,"precio_unitario":28}],"descuento_total":20,"condicion":null,"medio_pago":"efectivo","comprobante":"ninguno","dudas":[]}`
- **venta-numeros-en-letras** (834 ms)
  - condicion: esperaba «contado», vino null
  - vino: `registrar_venta {"cliente_texto":"don Lucho","items":[{"producto_texto":"mango","cantidad":10,"precio_unitario":45}],"descuento_total":null,"condicion":null,"medio_pago":"yape","comprobante":"ninguno","dudas":[]}`
- **venta-me-apuntas** (1331 ms)
  - condicion: esperaba «credito», vino null
  - vino: `registrar_venta {"cliente_texto":"Carlos","items":[{"producto_texto":"plátano seda","cantidad":6,"precio_unitario":null}],"descuento_total":null,"condicion":null,"medio_pago":null,"comprobante":"ninguno","dudas":[]}`
- **venta-factura-transferencia** (1228 ms)
  - condicion: esperaba «contado», vino null
  - vino: `registrar_venta {"cliente_texto":"restaurante Mochica","items":[{"producto_texto":"palta fuerte","cantidad":7,"precio_unitario":70}],"descuento_total":null,"condicion":null,"medio_pago":"transferencia","comprobante":"fac`
- **venta-yapeo-sin-precio** (1199 ms)
  - condicion: esperaba «contado», vino null
  - vino: `registrar_venta {"cliente_texto":"Don Lucho","items":[{"producto_texto":"piña","cantidad":5,"precio_unitario":null}],"descuento_total":null,"condicion":null,"medio_pago":"yape","comprobante":"ninguno","dudas":[]}`
- **abono-a-cuenta** (1416 ms)
  - HTTP 400 {"error":{"message":"Tool call validation failed: tool call validation failed: parameters for tool registrar_abono did not match sc
  - vino: `(sin respuesta)`
- **compra-credito** (888 ms)
  - herramienta: esperaba registrar_compra, vino registrar_venta
  - vino: `registrar_venta {"cliente_texto":"Chao","items":[{"producto_texto":"piña","cantidad":40,"precio_unitario":26}],"descuento_total":null,"condicion":"credito","medio_pago":null,"comprobante":"ninguno","dudas":[]}`
- **gasto-luz** (763 ms)
  - categoria: esperaba «servicios», vino "flete"
  - vino: `registrar_gasto {"categoria":"flete","monto":25,"descripcion":"luz","medio_pago":"efectivo"}`
- **gasto-cargador** (1337 ms)
  - herramienta: esperaba registrar_gasto, vino registrar_abono
  - vino: `registrar_abono {"cliente_texto":"cargador","monto":50,"medio_pago":"efectivo","dudas":[]}`
