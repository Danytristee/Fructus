# Voz de Fructus: elegir con qué voz lee la venta

- **Qué cambió:** Fructus sigue hablando con la voz del celular (`speechSynthesis`), pero ahora la elige mejor y suena menos plana. `lib/voz/voces-reglas.ts` decide: la que se eligió en este celular; si no, la mejor en español. Ordena por país (Perú y Latinoamérica antes que España), luego la que funciona sin internet y luego la de más calidad. Las voces de personaje de Apple (Eddy, Grandma…) van al final. Habla un 5 % más rápido y más agudo. En el menú, «Voz de Fructus» lista las voces: tocar una la elige y dice una venta de ejemplo. Se recuerda en el celular (`fructus:voz`), como «Manos libres».
- **Por qué no una voz de internet:** se evaluó Gemini TTS, que se puede usar con la misma clave. Se descartó porque la lectura tiene que sonar casi al instante y sin señal, y cada lectura iría y volvería por la red.
- **Cómo se verificó:** 12 pruebas en `voces-reglas.test.ts` y 981 de Vitest en verde, más tipos, ESLint y Knip. En el navegador, a 412 y 360 px: tocar «Reed» la guarda, dice la frase con esa voz (velocidad y tono 1.05), y «Manos libres» habla luego con la misma voz. No hay scroll horizontal y las filas miden 56 px.
- **Pendiente:**
  - Probarlo en el S25 Ultra: en Android, Chrome suele traer pocas voces por país, y las demás se instalan en los ajustes del celular («Texto a voz»).
  - Pasar `/formidable` por el menú.
