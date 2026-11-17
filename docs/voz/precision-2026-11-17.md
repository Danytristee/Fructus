# /voz-precision · 2026-11-17

**Casos:** 93 (`tests/interprete/casos.json`). **Proveedor:** Groq, sin respaldo (para comparar modelos limpio). **Catálogo en el prompt:** no. **Medido:** solo el intérprete (texto → herramienta); la voz a texto se mide aparte.

| Modelo | Intención (meta ≥ 95 %) | Datos clave (meta ≥ 90 %) | Prudencia con el dinero (meta 100 %) | Latencia p50 | p95 |
|---|---|---|---|---|---|
| `openai/gpt-oss-120b` | 98.9 % (92/93) | 88.2 % (82/93) | 100.0 % (0 invento(s) en 46 campos) | 1086 ms | 1815 ms |

## `openai/gpt-oss-120b`: casos que fallan (11)

- **compra-proveedor** (1086 ms)
  - proveedor_texto: esperaba «el de chao», vino null
  - vino: `registrar_compra {"proveedor_texto":null,"items":[{"producto_texto":"plátano isla del de Chao","cantidad":50,"costo_unitario":25,"estado":null}],"condicion":null,"dudas":[]}`
- **venta-credito-sabado** (1176 ms)
  - cliente_texto: esperaba «flaco carlos», vino "Carlos"
  - vino: `registrar_venta {"cliente_texto":"Carlos","items":[{"producto_texto":"mandarina","cantidad":4,"precio_unitario":null}],"descuento_total":null,"condicion":"credito","pago_parcial":null,"medio_pago":null,"comprobante":"nin`
- **venta-anotalo** (972 ms)
  - items[0].producto_texto: esperaba «mango edward», vino "mango"
  - condicion: esperaba «credito», vino null
  - vino: `registrar_venta {"cliente_texto":"Santa Ana","items":[{"producto_texto":"mango","cantidad":12,"precio_unitario":38}],"descuento_total":null,"condicion":null,"pago_parcial":null,"medio_pago":null,"comprobante":"ninguno","`
- **gasto-cargador** (2014 ms)
  - herramienta: esperaba registrar_gasto, vino no_entendido
  - vino: `no_entendido {"motivo":"Frase no relacionada con ventas, compras, merma o gastos del negocio."}`
- **catalogo-real-venta-seleccion-hablada** (965 ms)
  - cliente_texto: esperaba «el flaco carlos», vino "Carlos"
  - vino: `registrar_venta {"cliente_texto":"Carlos","items":[{"producto_texto":"membrillo de cuarta","cantidad":2,"precio_unitario":150}],"descuento_total":null,"condicion":"contado","pago_parcial":null,"medio_pago":"efectivo","co`
- **catalogo-real-venta-dos-selecciones** (1649 ms)
  - cliente_texto: esperaba «paraiso», vino null
  - vino: `registrar_venta {"cliente_texto":null,"items":[{"producto_texto":"caqui super","cantidad":4,"precio_unitario":140},{"producto_texto":"caqui de segunda","cantidad":2,"precio_unitario":90}],"descuento_total":null,"condicio`
- **catalogo-real-merma** (952 ms)
  - producto_texto: esperaba «albaricoque de segunda», vino "albaricoque"
  - vino: `registrar_merma {"producto_texto":"albaricoque","cantidad":2,"motivo":"segunda"}`
- **compra-como-llego-verde** (884 ms)
  - items[0].estado: esperaba «verde», vino null
  - vino: `registrar_compra {"proveedor_texto":null,"items":[{"producto_texto":"mango kent verde","cantidad":30,"costo_unitario":32,"estado":null}],"condicion":"contado","dudas":[]}`
- **compra-manzana-verde-es-el-nombre** (1168 ms)
  - items[0].producto_texto: esperaba «manzana verde», vino "manzana"
  - items[0].estado: esperaba null, vino "verde"
  - vino: `registrar_compra {"proveedor_texto":null,"items":[{"producto_texto":"manzana","cantidad":20,"costo_unitario":90,"estado":"verde"}],"condicion":null,"dudas":[]}`
- **venta-pago-parcial-sin-precio** (1333 ms)
  - medio_pago: esperaba «efectivo», vino null
  - vino: `registrar_venta {"cliente_texto":"don Lucho","items":[{"producto_texto":"mango","cantidad":10,"precio_unitario":null}],"descuento_total":null,"condicion":"credito","pago_parcial":1000,"medio_pago":null,"comprobante":"nin`
- **venta-dejo-a-cuenta-resto-debe** (1051 ms)
  - cliente_texto: esperaba «flaco carlos», vino "Carlos"
  - vino: `registrar_venta {"cliente_texto":"Carlos","items":[{"producto_texto":"papaya","cantidad":10,"precio_unitario":40}],"descuento_total":null,"condicion":"credito","pago_parcial":200,"medio_pago":"efectivo","comprobante":"ni`

### Dudas que salieron (3 de 93 casos)

- **venta-pago-parcial-sin-precio:** «No se indicó el precio unitario» · «No se especificó el medio de pago»
- **venta-yapeo-parte-paga-sabado:** «Pago parcial de 100 vía yape, resto pendiente para sábado»
- **venta-pago-la-mitad-sin-precio:** «No se indicó el precio unitario ni el monto exacto del pago parcial.»
