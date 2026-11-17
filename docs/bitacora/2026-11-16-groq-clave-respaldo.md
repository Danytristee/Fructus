# 2026-11-16 · Una segunda cuenta de Groq de respaldo

- **Qué cambió:** la voz a texto y el intérprete prueban Groq con `GROQ_API_KEY`, después con `GROQ_API_KEY_RESPALDO` (otra cuenta, con su propio cupo gratuito) y al final con Gemini. La de respaldo solo entra si la principal respondió 429, 401 o 403; si Groq no respondió en 8 s o se cayó, se pasa directo a Gemini para no esperar dos veces. El orden vive en `lib/voz/respaldo-reglas.ts` y `stt.ts` e `interprete.ts` ya no repiten el bucle. `/voz-precision` usa las dos cuentas: mismo modelo, el doble de cupo.
- **Cómo se verificó:** Vitest, 15 pruebas nuevas y 321 de `lib/voz` en verde; `tsc` y ESLint limpios. Contra Groq real, con una clave principal falsa (401): el intérprete y Whisper respondieron con la de respaldo (1.2 s el intérprete). El caso 429 usa la misma rama y lo cubren las pruebas; forzarlo de verdad gastaba el cupo del día.
- **`/voz-precision` con las dos cuentas** (`docs/voz/precision-2026-11-16-3.md`): los 82 casos corrieron enteros, sin que el cupo los cortara. Intención 98.8 %, datos clave 87.8 % (meta 90 %) y prudencia con el dinero 100 %; ninguno bajó respecto de la corrida anterior (97.1 %, 87.1 % y 100 %). La latencia p50 subió de 860 a 979 ms y la p95 bajó de 2459 a 1433 ms.
- **Pendiente:**
  - La clave nueva está en `.env.local` de esta copia (las dos cuentas responden) y, según quien dirige el proyecto, en Vercel; allí rige desde el siguiente despliegue. Desde esta sesión no se ve el proyecto de Vercel: no se pudo comprobar.
  - `GEMINI_API_KEY` sigue vacía en todas las copias locales: si las dos cuentas de Groq se quedan sin cupo, no hay tercer respaldo.
  - El CI sigue en `startup_failure` (la última corrida, del 16-11 a las 22:55 UTC).
