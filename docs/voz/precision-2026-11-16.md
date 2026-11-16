# /voz-precision · 2026-11-16

**Casos:** 70 (`tests/interprete/casos.json`). **Proveedor:** Groq, sin respaldo (para comparar modelos limpio). **Catálogo en el prompt:** no. **Medido:** solo el intérprete (texto → herramienta); la voz a texto se mide aparte.

| Modelo | Intención (meta ≥ 95 %) | Datos clave (meta ≥ 90 %) | Prudencia con el dinero (meta 100 %) | Latencia p50 | p95 |
|---|---|---|---|---|---|
| `openai/gpt-oss-120b` | 97.1 % (68/70) | 87.1 % (61/70) | 100.0 % (0 invento(s) en 29 campos) | 860 ms | 2459 ms |

## `openai/gpt-oss-120b`: casos que fallan (9)

- **compra-proveedor** (727 ms)
  - items[0].producto_texto: esperaba «platano isla», vino "plátano"
  - vino: `registrar_compra {"proveedor_texto":"isla del de Chao","items":[{"producto_texto":"plátano","cantidad":50,"costo_unitario":25}],"condicion":null,"dudas":[]}`
- **venta-credito-sabado** (1187 ms)
  - cliente_texto: esperaba «flaco carlos», vino "Carlos"
  - vino: `registrar_venta {"cliente_texto":"Carlos","items":[{"producto_texto":"mandarina","cantidad":4,"precio_unitario":null}],"descuento_total":null,"condicion":"credito","medio_pago":null,"comprobante":"ninguno","dudas":[]}`
- **venta-anotalo** (3467 ms)
  - items[0].producto_texto: esperaba «mango edward», vino "mango"
  - vino: `registrar_venta {"cliente_texto":"Santa Ana","items":[{"producto_texto":"mango","cantidad":12,"precio_unitario":38}],"descuento_total":null,"condicion":"credito","medio_pago":null,"comprobante":"ninguno","dudas":[]}`
- **abono-a-cuenta** (667 ms)
  - herramienta: esperaba registrar_abono, vino no_entendido
  - vino: `no_entendido {"motivo":"No se especificó el nombre del cliente"}`
- **gasto-cargador** (1221 ms)
  - categoria: esperaba «personal», vino "otros"
  - vino: `registrar_gasto {"categoria":"otros","monto":50,"descripcion":"al cargador","medio_pago":"efectivo"}`
- **catalogo-real-venta-seleccion-hablada** (1272 ms)
  - cliente_texto: esperaba «el flaco carlos», vino "Carlos"
  - vino: `registrar_venta {"cliente_texto":"Carlos","items":[{"producto_texto":"membrillo de cuarta","cantidad":2,"precio_unitario":150}],"descuento_total":null,"condicion":"contado","medio_pago":"efectivo","comprobante":"ninguno"`
- **catalogo-real-venta-dos-selecciones** (2560 ms)
  - cliente_texto: esperaba «paraiso», vino null
  - vino: `registrar_venta {"cliente_texto":null,"items":[{"producto_texto":"caqui super","cantidad":4,"precio_unitario":140},{"producto_texto":"caqui de segunda","cantidad":2,"precio_unitario":90}],"descuento_total":null,"condicio`
- **catalogo-real-merma** (853 ms)
  - producto_texto: esperaba «albaricoque de segunda», vino "albaricoque"
  - vino: `registrar_merma {"producto_texto":"albaricoque","cantidad":2,"motivo":"segunda"}`
- **catalogo-real-compra** (1043 ms)
  - herramienta: esperaba registrar_compra, vino registrar_venta
  - vino: `registrar_venta {"cliente_texto":"el de Chao","items":[{"producto_texto":"pera gaucho premium","cantidad":20,"precio_unitario":140}],"descuento_total":null,"condicion":null,"medio_pago":null,"comprobante":"ninguno","duda`

### Dudas que salieron (2 de 70 casos)

- **venta-sin-nada:** «No se indicó cliente, precio, forma de pago o condición.»
- **compra-sin-precio:** «Falta precio unitario y proveedor»
