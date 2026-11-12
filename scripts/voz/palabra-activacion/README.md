# «Hola Fructus»: prueba de viabilidad con openWakeWord

Actividad 4 de la voz sin manos. **Pregunta que responde:** ¿un modelo de openWakeWord reconoce «Hola Fructus» en un puesto de
La Hermelinda sin despertarse solo? **Meta:** detectar el 90 % o más de los «Hola Fructus» de personas que el modelo nunca oyó,
también con ruido, y despertar solo 1 vez por hora o menos con el ruido real del puesto. Si no se cumple, no se construye la
actividad 5 (escuchar dentro de la app) y se decide qué hacer.

## Qué hay aquí

| Archivo | Qué hace | Dónde corre |
|---|---|---|
| `entrenar_hola_fructus.ipynb` | El cuaderno de Google Colab: instala, baja datos, genera clips, entrena y entrega `hola_fructus.onnx`. **Se genera** con `armar_cuaderno.py`. | Colab |
| `preparar_datos.py` | Baja voces en español de Piper, salas del MIT, ruido de fondo de AudioSet y las características de openWakeWord. | Colab |
| `generar_clips.py` | Clips de «Hola Fructus» y de frases parecidas en español, más las grabaciones reales del equipo. | Colab |
| `entrenar.py` | Corre el entrenador de openWakeWord 0.6.0 con tres arreglos para un Python de hoy (ver el archivo). | Colab |
| `compat_torchaudio.py` | Devuelve `torchaudio.load`/`info`, que las versiones nuevas de torchaudio quitaron. | Colab |
| `medir.py` | Mide el modelo con los audios reales del puesto y escribe el informe en `docs/voz/`. | **Esta computadora** |

## Paso 1 · Grabar (lo hace el equipo, en el puesto)

**«Hola Fructus»:**
- Entre 3 y 5 personas, unas 30 veces cada una, con la grabadora del celular, de pie en el puesto y en horario normal.
- Que varíe: cerca y a un brazo del celular, normal y apurado, con una caja en la mano, de frente y de costado.
- Un archivo por frase, o un archivo largo por persona con una pausa de 2 s entre frases (se corta después).
- Una carpeta por persona, con un nombre genérico: `grabaciones/dueno/`, `grabaciones/ayudante1/`, … Nada de nombres reales.
- Cada persona da su permiso para que su voz se use en el entrenamiento.

**El ruido del puesto:**
- Entre 1 y 2 horas en un día normal, con el celular donde estaría el dueño, **sin decir «Hola Fructus»**.
- En `ruido/`.
- **No se sube a ningún lado**: lleva conversaciones de clientes y vecinos. Solo se usa en esta computadora, con `medir.py`.

Todo esto queda fuera de git (`.gitignore` de esta carpeta) y se borra al terminar la prueba.

## Paso 2 · Entrenar en Colab

1. Abre `entrenar_hola_fructus.ipynb` en [Google Colab](https://colab.research.google.com) (Archivo → Subir cuaderno).
2. En la celda 3, deja en `RESERVAR` al menos a una persona (idealmente el dueño): sus grabaciones no se suben al entrenamiento,
   se guardan para medir.
3. Comprime las carpetas de las **otras** personas como `grabaciones.zip` y súbelo cuando la celda 5 lo pida.
4. Ejecuta todo. Al final se baja `hola_fructus.onnx`: guárdalo en esta carpeta.

## Paso 3 · Medir aquí

```bash
python3.12 -m venv .local/venv && .local/venv/bin/pip install "openwakeword==0.6.0" soundfile "scipy>=1.14,<1.16"
.local/venv/bin/python medir.py --modelo hola_fructus.onnx --positivos grabaciones/dueno --ruido ruido \
    --informe ../../../docs/voz/palabra-activacion-AAAA-MM-DD.md
```

El informe dice, por umbral, cuánto detecta (limpio y con el ruido del puesto a 10 y 5 dB) y cuántas veces despierta solo por
hora, con el veredicto. Lee M4A y MP3 del celular con `ffmpeg` (`brew install ffmpeg`).

## Cómo se probó (2026-11-12, Python 3.12, el mismo de Colab)

- Generación de clips con 2 voces de Piper; las grabaciones en M4A entran y la persona reservada no.
- `entrenar.py` de punta a punta con datos mínimos sintéticos: aprende (88 % de positivos y 0 % de negativos sobre 0.5).
- `medir.py` sobre ese modelo, con ruido en WAV y en M4A.
- `preparar_datos.py` baja voces, salas y fondo. **Sin probar aquí:** la descarga de 17.3 GB de ACAV100M, que solo se hace en Colab.

Arreglos frente al cuaderno oficial, que hoy no corre:
- AudioSet ya no publica los `.tar`: se lee el parquet.
- `datasets` y `torchaudio` nuevos piden torchcodec: se lee con soundfile.
- `acoustics` necesita `scipy < 1.16`.
- Exportar a ONNX pide `onnx` y `onnxscript`. El modelo sale en opset 18, que onnxruntime-web soporta.
- La conversión a TFLite (TensorFlow 2.8) ya no se instala, y no hace falta.

**Licencia:** el código de openWakeWord es Apache 2.0. Las características ACAV100M son CC BY-NC-SA 4.0: el modelo sirve para la
demo universitaria. Antes de producción se reentrena con audio propio (ver «Antes de producción» en CLAUDE.md).
