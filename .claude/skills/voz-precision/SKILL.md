---
name: voz-precision
description: Mide qué tan bien entiende Fructus lo que dice el dueño — corre los casos de tests/interprete/casos.json contra el intérprete real (Groq, con Gemini de respaldo), compara intención y datos clave con lo esperado, mide la latencia y entrega la tasa de acierto, los fallos agrupados por causa y una propuesta concreta para el prompt o el vocabulario. Úsala al tocar el prompt, las herramientas, el modelo o el vocabulario, antes de cada entrega, y cuando digan «la voz no entiende», «precisión» o «/voz-precision». Es la métrica principal del informe universitario.
---

Mide la precisión del intérprete: $ARGUMENTS   (sin argumentos = todos los casos; `--caso N` uno solo; `--audio` también prueba con audios reales)

## Qué mide

| Métrica | Cómo | Meta de la demo |
|---|---|---|
| **Acierto de intención** | la herramienta llamada es la esperada | 95 % o más |
| **Acierto de datos clave** | cliente, producto, cantidad, precio, condición y medio de pago coinciden (los textos se comparan normalizados: minúsculas, sin tildes, números en cifras) | 90 % o más |
| **Prudencia con el dinero** | si la frase no trae precio o condición, el intérprete devuelve `null` y **no inventa** | 100 %: un invento es un fallo grave |
| **Latencia** | de enviar la transcripción a recibir la interpretación (y, con `--audio`, desde enviar el audio) | p50 de 1.2 s o menos y p95 de 2.5 s o menos para el ciclo completo |

## Método

1. **Casos.**
   - Lee `tests/interprete/casos.json`. Cada caso tiene `{ id, transcripcion, esperado: { herramienta, datos } }`, con los datos según `docs/interprete-voz.md`.
   - Si el archivo no existe, créalo a partir de la tabla de la sección 4 de `docs/interprete-voz.md`.
   - Nunca quites un caso que falla para mejorar el número.
2. **Correr contra el modelo real** con el mismo código que usa `/api/voz` (`lib/voz/interprete.ts`), no con una copia. Las claves están en `.env.local`. Respeta los límites del nivel gratuito: una llamada a la vez, y si llega un 429, espera según `retry-after`.
3. **Con `--audio`:**
   - usa los audios de `tests/interprete/audios/` (`<id>.webm`, grabados en el puesto o en un lugar con ruido parecido);
   - pásalos por `lib/voz/stt.ts`;
   - compara además la transcripción con la esperada, midiendo la distancia en palabras;
   - los audios no van al repo si tienen voces reales sin permiso: si es así, agrégalos a `.gitignore`.
4. **Comparar.** Por caso: ✅ o ❌, con qué campo falló y qué devolvió el modelo.
5. **Agrupar los fallos por causa:**
   - apodo que no reconoce (falta en el vocabulario de Whisper o en los alias);
   - número mal interpretado;
   - crédito tomado como contado;
   - intención confundida.

   Una causa con varios casos cuenta como **un** problema.
6. **Proponer** como máximo 3 cambios concretos, con el texto exacto que se agrega o se quita:
   - una línea del prompt de sistema;
   - un alias en `seed.sql`;
   - una palabra del vocabulario de Whisper;
   - un caso nuevo.

   **Con el OK**, aplícalos y vuelve a correr todo: se reportan el antes y el después.

## Salida

- **Resumen en el chat:** modelo usado, fecha, número de casos, los tres porcentajes, la latencia p50 y p95, y los fallos agrupados.
- **Historial** en `docs/voz/precision-AAAA-MM-DD.md`, para el informe universitario. Se agrega uno nuevo cada vez; no se sobrescribe.
- **Si un cambio baja cualquiera de los porcentajes, no se aplica.** Se explica por qué.
