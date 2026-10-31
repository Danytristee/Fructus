# /voz-precision · 2026-10-31

**Casos:** 48 (`tests/interprete/casos.json`). **Proveedor:** Groq, sin respaldo (para comparar modelos limpio). **Catálogo en el prompt:** no. **Medido:** solo el intérprete (texto → herramienta); la voz a texto se mide aparte.

| Modelo | Intención (meta ≥ 95 %) | Datos clave (meta ≥ 90 %) | Prudencia con el dinero (meta 100 %) | Latencia p50 | p95 |
|---|---|---|---|---|---|
| `openai/gpt-oss-120b` | 100.0 % (48/48) | 93.8 % (45/48) | 100.0 % (0 invento(s) en 24 campos) | 823 ms | 1196 ms |

## `openai/gpt-oss-120b`: casos que fallan (3)

- **compra-proveedor** (851 ms)
  - items[0].producto_texto: esperaba «platano isla», vino "plátano"
  - vino: `registrar_compra {"proveedor_texto":"isla del de Chao","items":[{"producto_texto":"plátano","cantidad":50,"costo_unitario":25}],"condicion":null,"dudas":[]}`
- **venta-credito-sabado** (1013 ms)
  - cliente_texto: esperaba «flaco carlos», vino "Carlos"
  - vino: `registrar_venta {"cliente_texto":"Carlos","items":[{"producto_texto":"mandarina","cantidad":4,"precio_unitario":null}],"descuento_total":null,"condicion":"credito","medio_pago":null,"comprobante":"ninguno","dudas":[]}`
- **venta-anotalo** (682 ms)
  - items[0].producto_texto: esperaba «mango edward», vino "mango"
  - vino: `registrar_venta {"cliente_texto":"Santa Ana","items":[{"producto_texto":"mango","cantidad":12,"precio_unitario":38}],"descuento_total":null,"condicion":"credito","medio_pago":null,"comprobante":"ninguno","dudas":[]}`
