# /voz-precision · 2026-10-31

**Casos:** los 16 de consulta de `tests/interprete/casos.json` (8 nuevos de A7; solo ese subconjunto, porque el cupo del día de Groq no alcanzaba para los 56). **Proveedor:** Groq, sin respaldo (para comparar modelos limpio). **Catálogo en el prompt:** no. **Medido:** solo el intérprete (texto → herramienta); la voz a texto se mide aparte.

| Modelo | Intención (meta ≥ 95 %) | Datos clave (meta ≥ 90 %) | Prudencia con el dinero (meta 100 %) | Latencia p50 | p95 |
|---|---|---|---|---|---|
| `openai/gpt-oss-120b` | 100.0 % (16/16) | 100.0 % (16/16) | — (0 invento(s) en 0 campos) | 760 ms | 2014 ms |

## `openai/gpt-oss-120b`: casos que fallan (0)

Ninguno.

