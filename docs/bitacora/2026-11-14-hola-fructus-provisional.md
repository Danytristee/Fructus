# 2026-11-14 · «Hola Fructus»: modelo provisional (actividad 5a)

- **Qué cambió:**
  - Modelo provisional en `public/voz/hola-fructus.onnx` (212 KB), entrenado aquí sin los datos no comerciales: 6 voces de Piper,
    frases del puesto y AudioSet.
  - `caracteristicas_negativas.py`: los negativos salen de audio propio. Así se entrena el modelo de producción.
  - `generar_clips.py --habla`: frases del puesto.
  - `medir.py`: paciencia y frases parecidas.
  - `entrenar.py` junta los pesos en un solo `.onnx`.
- **Cómo se verificó:** `medir.py` con una voz que nunca oyó. Con umbral 0.9 y 3 cuadros seguidos: 90 % de detección limpia, 1.04
  falsas por hora con ruido, 10.8 % de frases con «fruta». Tres rondas en `docs/voz/palabra-activacion-2026-11-14-provisional.md`.
- **Pendiente:**
  - «Fruta» es la trampa: enseñarle a rechazarla le quitó detección (rondas 2 y 3). Las frases con «fruta» quedaron como opción
    (`--con-fruta`) para probarlas con grabaciones reales.
  - La prueba de viabilidad sigue esperando grabaciones con el audífono que se comprará.
  - Las licencias de las voces de Piper: revisarlas una por una antes de producción.
  - Decisión del día: ADR-0020 (confirmar la venta hablando).
