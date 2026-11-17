# 2026-11-12 · «Hola Fructus»: lo necesario para la prueba de viabilidad

- **Qué cambió:** `scripts/voz/palabra-activacion/`, con:
  - un cuaderno de Colab que entrena «Hola Fructus» con openWakeWord en español (voces de Piper más las grabaciones del equipo);
  - `medir.py`, que mide aquí la detección y las falsas activaciones por hora con el ruido real del puesto, sin subirlo a ningún lado;
  - la guía de grabación.
- **Decisión:** entrenar en Colab (opción B), porque el sistema todavía no está en uso. El ruido del puesto no se sube: solo se usa en
  esta computadora. La meta es 90 % de detección o más y 1 falsa activación por hora o menos.
- **Cómo se verificó**, en Python 3.12, el de Colab:
  - clips en español con 2 voces;
  - grabaciones en M4A, con la persona reservada fuera del entrenamiento;
  - `entrenar.py` de punta a punta con datos mínimos: aprende, con 88 % de positivos y 0 % de negativos;
  - `medir.py` con WAV y M4A;
  - `preparar_datos.py`: voces, salas y fondo.
- **El cuaderno oficial de openWakeWord ya no corre.** Se arreglaron 5 cosas: AudioSet en parquet, torchcodec en `datasets` y
  `torchaudio`, `scipy < 1.16`, `onnx`/`onnxscript` para exportar, y la conversión a TFLite, que se deja fallar.
- **Pendiente:**
  - **Las grabaciones:** «Hola Fructus» de 3 a 5 personas, 30 veces cada una, y de 1 a 2 h del ruido del puesto. Sin ellas no hay número.
  - **Correr el cuaderno en Colab:** sin probar allá, en particular la descarga de 17.3 GB de ACAV100M.
  - **Medir y escribir** `docs/voz/palabra-activacion-AAAA-MM-DD.md` con el veredicto.
  - **Licencia:** ACAV100M es CC BY-NC-SA. Antes de producción hay que reentrenar sin esas características. Agregarlo a «Antes de
    producción» en CLAUDE.md junto con el ADR de la actividad 6.
  - Con entrenamientos chicos, el peso de negativos de 1500 (el de openWakeWord) aplasta el modelo; con miles de clips es el
    esperado. Si el modelo de Colab sale plano, probar `--peso-negativo 100` (`entrenar.py`).
