"""Arma entrenar_hola_fructus.ipynb (para Google Colab) con los scripts de esta carpeta adentro.

El repo es privado y Colab no lo ve: el cuaderno lleva cada script en una celda %%writefile. Así el código vive en un solo lugar
(los .py, que se prueban en local) y el cuaderno se regenera:

    python armar_cuaderno.py
"""

import json
from pathlib import Path

AQUI = Path(__file__).parent
SCRIPTS = ["compat_torchaudio.py", "preparar_datos.py", "generar_clips.py", "caracteristicas_negativas.py", "entrenar.py"]

# Versiones probadas de punta a punta en Python 3.12 (el de Colab) el 2026-11-12. scipy < 1.16: `acoustics` usa sph_harm.
DEPENDENCIAS = (
    '"openwakeword==0.6.0" "piper-tts==1.8.0" torchinfo torchmetrics pronouncing audiomentations torch-audiomentations '
    '"speechbrain<1" acoustics mutagen "scipy>=1.14,<1.16" pyyaml soundfile onnx onnxscript pyarrow huggingface_hub'
)


def md(texto: str) -> dict:
    return {"cell_type": "markdown", "metadata": {}, "source": texto.strip().splitlines(keepends=True)}


def code(texto: str) -> dict:
    return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": texto.strip().splitlines(keepends=True)}


def main() -> None:
    celdas = [
        md("""
# Entrenar «Hola Fructus» (openWakeWord, en español)

Entrena el modelo que despierta a Fructus al oír «Hola Fructus». Es la **prueba de viabilidad** (actividad 4): el modelo que sale de
aquí se mide después **en la computadora del proyecto** con el ruido real del puesto (`medir.py`). Ese ruido no se sube nunca aquí.

**Qué subir:** solo un `grabaciones.zip` con «Hola Fructus» dichos por el equipo, con su permiso. Una carpeta por persona
(`grabaciones/dueno/…`, `grabaciones/ayudante1/…`).

**Licencia:** las características de entrenamiento (ACAV100M) son CC BY-NC-SA 4.0 (no comercial). El modelo sirve para la demo
universitaria, no para vender.

**Tiempo:** entre 1 y 2 horas en total. No hace falta GPU. Baja unos 19 GB al disco de Colab, no al tuyo.

Ejecuta las celdas en orden (Entorno de ejecución → Ejecutar todas). Generado por `scripts/voz/palabra-activacion/armar_cuaderno.py`:
no lo edites a mano.
"""),
        md("## 1. Instalar"),
        code(f"!pip install -q {DEPENDENCIAS}"),
        md("## 2. Los scripts del proyecto"),
    ]
    for nombre in SCRIPTS:
        celdas.append(code(f"%%writefile {nombre}\n" + (AQUI / nombre).read_text()))
    celdas += [
        md("""
## 3. Ajustes

- `RESERVAR`: las personas cuyas grabaciones **no** se usan al entrenar. Quedan para medir, así el número final sale de voces que el
  modelo nunca oyó. Pon al menos una (idealmente el dueño).
- `PASOS`: 20,000 es un buen comienzo.
"""),
        code('RESERVAR = ["dueno"]\nPASOS = 20000\nCLIPS_ENTRENAR = 5000\nCLIPS_VALIDAR = 500'),
        md("## 4. Bajar voces, salas, ruido de fondo y características (~19 GB, unos 20 min)"),
        code("!python preparar_datos.py --destino . --fragmentos-fondo 2"),
        md("## 5. Subir las grabaciones de «Hola Fructus» (`grabaciones.zip`)\n\nSi todavía no hay grabaciones, salta esta celda: se entrena solo con voces sintéticas."),
        code("""
from google.colab import files
subido = files.upload()
for nombre in subido:
    !unzip -q -o "{nombre}" -d .
!ls grabaciones
"""),
        md("## 6. Generar los clips en español"),
        code("""
import os
reales = "--grabaciones grabaciones --reservar " + " ".join(RESERVAR) if os.path.isdir("grabaciones") else ""
!python generar_clips.py --voces voces --salida salida/hola_fructus --n-train {CLIPS_ENTRENAR} --n-test {CLIPS_VALIDAR} {reales}
"""),
        md("""
## 6b. (Opcional) Negativos propios, sin la licencia no comercial

Si tienes horas de audio propio del puesto **con permiso para subirlas**, en `ruido_propio/` (WAV a 16 kHz), esta celda arma los
negativos con ellas y con habla sintética del puesto. Después, en la celda 7, cambia `NEGATIVOS` por `negativos_propios.npy`.
"""),
        code("""
!python generar_clips.py --voces voces --salida _tmp/hola_fructus --n-train 0 --n-test 0 --habla 1500 --habla-salida habla
!python caracteristicas_negativas.py --audio ruido_propio fondo habla --mezclar fondo --ventanas negativos_propios.npy
"""),
        md("## 7. Entrenar (30 a 60 min)"),
        code('NEGATIVOS = "openwakeword_features_ACAV100M_2000_hrs_16bit.npy"\n!python entrenar.py --salida salida --rir mit_rirs --fondo fondo --negativos {NEGATIVOS} --validacion validation_set_features.npy --pasos {PASOS}'),
        md("## 8. Bajar el modelo\n\nGuarda `hola_fructus.onnx` y pásalo al proyecto: se mide con `medir.py`."),
        code('from google.colab import files\nfiles.download("salida/hola_fructus.onnx")'),
    ]
    cuaderno = {
        "cells": celdas,
        "metadata": {"colab": {"provenance": []}, "kernelspec": {"display_name": "Python 3", "name": "python3"}, "language_info": {"name": "python"}},
        "nbformat": 4,
        "nbformat_minor": 0,
    }
    destino = AQUI / "entrenar_hola_fructus.ipynb"
    destino.write_text(json.dumps(cuaderno, ensure_ascii=False, indent=1) + "\n")
    print(f"{destino.name}: {len(celdas)} celdas")


if __name__ == "__main__":
    main()
