# 2026-11-16 · La IA estima cuánto aguanta cada fruta (actividad 5, ADR-0021)

- **Qué cambió, en tres pasos con su commit:**
  1. Junto al aviso de la noche, el servidor le pregunta a Claude Sonnet 5.5 por las frutas sin estimación. Stock cuenta con eso y la hoja «¿por qué?» dice de dónde sale. Si el modelo falla, sigue la tabla.
  2. «Sigue buena» en la hoja de una llegada que ya pasó su día: queda anotado, sale de «para hoy» y pasa a «sale mañana».
  3. Se corrige sola: las mermas y los «Sigue buena» entran al pedido de la noche siguiente; el ajuste va acotado (un paso por noche, dentro del margen de la tabla) y con su motivo.
- **Cómo se verificó:** Vitest 789 en verde; pgTAP con cuatro archivos nuevos o ampliados (21 a 23); e2e con un modelo de mentira (`tests/e2e/sonnet-simulado.mjs`); y con el modelo de verdad contra la base local: 58 frutas en 15 s, todas dentro del margen; después, dos mermas de tuna el día que llegó → «le quito un día», y un solo «Sigue buena» de caqui → «no alcanza para cambiarla».
- **`/chaos`** (`docs/chaos/frescura-ia-2026-11-16.md`): 10 ataques; un hallazgo de gravedad 2 arreglado en la base, con su prueba primero. **`/formidable`** (`docs/formidable/frescura-ia-2026-11-16.md`): 7.8; el toque se entiende (8), el pie con el origen no (5). Sus 3 cambios esperan OK.
- **Migraciones aplicadas al proyecto el 16-11, con OK:** `20261116181418_temperaturas_solo_agregar`, `20261116181431_vida_util_estimada`, `20261116181445_revisiones_frescura` y `20261116181456_mermas_con_stock`, ya con su versión real. No tocaron ninguna fila (las tablas nuevas nacen vacías y `temperaturas` no tenía lecturas). `get_advisors` de seguridad no trae avisos nuevos: siguen los tres de siempre (`series_comprobante` y `suscripciones_push` sin políticas, `rol_actual()` y la protección de claves filtradas).
- **Pendiente:**
  - Poner `ANTHROPIC_API_KEY` en las variables de Vercel. Sin ella, producción contesta `sin-configurar` y sigue con la tabla.
  - Los rótulos de los días se pisan en una fruta de vida larga (`components/inventario/HojaPorQue.tsx:83`); venía de antes.
  - «Sigue buena» no tiene «Deshacer».
  - El CI de GitHub sigue sin correr: todo lo de arriba se corrió a mano.
