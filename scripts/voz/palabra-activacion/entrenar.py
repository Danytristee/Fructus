"""Entrena «Hola Fructus» con el entrenador de openWakeWord 0.6.0, a partir de los clips que dejó generar_clips.py.

Usa solo los pasos «aumentar» y «entrenar» de openwakeword/train.py: los clips en español ya existen, así que no se genera nada
con su voz en inglés. Tres arreglos para que corra en un Python de hoy (el de Colab):
  1. compat_torchaudio: torchaudio ya no tiene `info` y `load` pide torchcodec.
  2. Un `generate_samples` de mentira: train.py lo importa siempre, aunque no se use, y el de verdad arrastra dependencias de inglés.
  3. Al final train.py convierte a TFLite con TensorFlow 2.8, que ya no se instala. El .onnx, que es lo que usa el navegador, ya
     quedó guardado antes; ese último paso se deja fallar y se avisa.

Uso:
    python entrenar.py --salida salida --rir mit_rirs --fondo audioset_16k fma_16k \
        --negativos openwakeword_features_ACAV100M_2000_hrs_16bit.npy --validacion validation_set_features.npy --pasos 10000
"""

import argparse
import logging
import multiprocessing
import runpy
import sys
from pathlib import Path

import yaml

MODELO = "hola_fructus"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--salida", type=Path, required=True, help="carpeta donde generar_clips.py dejó <salida>/hola_fructus")
    p.add_argument("--rir", type=Path, nargs="+", required=True, help="respuestas de sala (.wav)")
    p.add_argument("--fondo", type=Path, nargs="+", required=True, help="ruido de fondo (.wav a 16 kHz)")
    p.add_argument("--negativos", type=Path, required=True, help="características de audio que no es la palabra (.npy)")
    p.add_argument("--validacion", type=Path, required=True, help="características para medir falsas activaciones (.npy)")
    p.add_argument("--pasos", type=int, default=10000)
    p.add_argument("--capa", type=int, default=32)
    p.add_argument("--peso-negativo", type=float, default=1500, help="peso máximo de los negativos (el de openWakeWord es 1500)")
    p.add_argument("--falsas-por-hora", type=float, default=0.2, help="meta del entrenador al elegir el mejor modelo")
    p.add_argument("--rehacer-caracteristicas", action="store_true", help="vuelve a aumentar los clips aunque ya estén")
    a = p.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")  # el avance del entrenador va por logging

    clips = a.salida / MODELO
    cuantos = {d: len(list((clips / d).glob("*.wav"))) for d in ("positive_train", "positive_test", "negative_train", "negative_test")}
    if min(cuantos.values()) == 0:
        raise SystemExit(f"Faltan clips en {clips}: {cuantos}. Corre primero generar_clips.py.")

    # El entrenador importa generate_samples siempre; con los clips ya hechos no se llama nunca.
    falso = a.salida / "_sin_piper_ingles"
    falso.mkdir(parents=True, exist_ok=True)
    (falso / "generate_samples.py").write_text(
        "def generate_samples(*args, **kwargs):\n    raise RuntimeError('Los clips se generan con generar_clips.py')\n"
    )

    config = {
        "model_name": MODELO,
        "target_phrase": ["hola fructus"],
        "custom_negative_phrases": [],
        # El entrenador solo genera si hay menos del 95 % de estos: se le dicen los que ya hay.
        "n_samples": cuantos["positive_train"],
        "n_samples_val": cuantos["positive_test"],
        "tts_batch_size": 50,
        "augmentation_batch_size": 16,
        "piper_sample_generator_path": str(falso),
        "output_dir": str(a.salida),
        "rir_paths": [str(r) for r in a.rir],
        "background_paths": [str(f) for f in a.fondo],
        "background_paths_duplication_rate": [1] * len(a.fondo),
        "false_positive_validation_data_path": str(a.validacion),
        "augmentation_rounds": 1,
        "feature_data_files": {"ACAV100M_sample": str(a.negativos)},
        "batch_n_per_class": {"ACAV100M_sample": 1024, "adversarial_negative": 50, "positive": 50},
        "model_type": "dnn",
        "layer_size": a.capa,
        "steps": a.pasos,
        "max_negative_weight": a.peso_negativo,
        "target_false_positives_per_hour": a.falsas_por_hora,
    }
    ruta_config = a.salida / f"{MODELO}.yml"
    ruta_config.write_text(yaml.safe_dump(config, allow_unicode=True, sort_keys=False))
    print(f"config: {ruta_config}")

    sys.path.insert(0, str(Path(__file__).parent))
    import compat_torchaudio

    compat_torchaudio.aplicar()

    import openwakeword.utils

    openwakeword.utils.download_models(model_names=["__solo_las_de_caracteristicas__"])  # melspectrogram y embedding

    # Los cargadores de datos del entrenador usan generadores: con «spawn» (macOS) no se pueden pasar a otro proceso.
    if sys.platform == "darwin":
        multiprocessing.set_start_method("fork", force=True)

    argumentos = ["--training_config", str(ruta_config), "--augment_clips", "--train_model"]
    if a.rehacer_caracteristicas:
        argumentos.append("--overwrite")
    sys.argv = ["train.py", *argumentos]
    onnx = a.salida / f"{MODELO}.onnx"
    try:
        runpy.run_module("openwakeword.train", run_name="__main__")
    except ImportError as e:
        if not onnx.exists():
            raise
        print(f"Aviso: no se pudo convertir a TFLite ({e.name}). No hace falta: el navegador usa el .onnx.")
    if not onnx.exists():
        raise SystemExit("El entrenamiento terminó sin dejar el .onnx.")
    print(f"Listo: {onnx} ({onnx.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
