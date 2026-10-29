# 2026-10-28 · El intérprete de voz en el servidor (A4)

**Qué cambió:**
- `POST /api/voz`: audio → Whisper con el vocabulario del puesto → intérprete (Groq `gpt-oss-120b`, Gemini de respaldo) → Zod →
  `comandos_voz` → nombres y precios de la base → tarjeta. El contador recibe 403, y sin sesión responde 401.
- **La tarjeta** es lógica pura (`lib/voz/tarjeta-reglas.ts`):
  - con una similitud de 0.45 o más el nombre se elige solo; si no, se ofrecen 3 opciones;
  - el precio no dicho sale «sugerido»;
  - sin precio no hay total;
  - sin condición, se pregunta.
- **Casos del intérprete:** de 12 a 48.
- **El prompt** suma «medio de pago ⇒ contado» y «crédito sin dudas».
- **El catálogo en el prompt** se midió y no se aplicó.
- **Guion de 30 frases** para grabar audios reales (`tests/interprete/audios/LEEME.md`).

**Cómo se verificó:**
- **Intérprete** (`pnpm voz:precision`, 48 casos): 97.9 % intención, 89.6 % datos clave, 100 % prudencia (0 inventos), p50 1.2 s.
- **Voz a texto** (`pnpm voz:stt`, 10 frases con la voz del Mac): 4.3 % de error por palabras con vocabulario y 5.7 % sin él,
  p50 0.6 s.
- **De punta a punta:** `tests/e2e/voz-api.spec.ts` dicta una venta y vuelve completa, con 1.6–2.1 s de servidor en caliente.
- `pnpm test` (70), e2e (65) y Knip en verde.

**Pendiente:**
- **Datos clave** quedaron en 89.6 %, contra la meta de 90 %. Lo que falla: apodos («al flaco Carlos» → «Carlos»), «plátano isla
  del de Chao» y «a cuenta» sin cliente. Se vuelve a medir con el catálogo real del puesto en el prompt y otra redacción.
- **Gemini sin clave:** el respaldo está escrito, pero no se probó en vivo (`GEMINI_API_KEY`).
- **Los 48 casos** usan frutas del catálogo ficticio. Pasarlos a manzana, pera y kiwi va con el catálogo real (A12).
- **Faltan los audios reales del puesto** (guion listo).
- **«Bizcocho»:** Whisper escribe «bizcocho» y el catálogo dice «biscocho»; agregar el apodo.
- **La latencia de punta a punta en el celular** (de soltar el botón a ver la tarjeta) se mide en A5.
