"""La referencia del detector del navegador (actividad 5b): openWakeWord en Python, cuadro por cuadro, sobre audios fijos.

El detector de la app (lib/voz/detector-palabra.ts) es una traducción a TypeScript de la cadena de openWakeWord. Para saber que
calcula lo mismo, la prueba lib/voz/detector-palabra.paridad.test.ts compara sus puntajes con los que deja este script en
tests/palabra/referencia.json. La diferencia permitida es de 0.01 por cuadro.

Dos pasos:

    # 1. Los audios de prueba, con una voz que el modelo nunca oyó al entrenar (es_MX-ald-medium, datos de dominio público)
    python referencia.py audios --voz .local/voces/es_MX-ald-medium.onnx --salida ../../../tests/palabra --espeak .local/espeak-ng-data

    # 2. Los puntajes de openWakeWord para esos audios
    python referencia.py puntajes --modelo ../../../public/voz/hola-fructus.onnx --audios ../../../tests/palabra/*.wav \
        --salida ../../../tests/palabra/referencia.json

Un cambio frente a openWakeWord: al empezar, el historial de rasgos se llena con los de 4 s de silencio, no con los de 4 s de ruido
al azar. Así los dos lados empiezan igual y se comparan desde el primer cuadro. La app hace lo mismo.
"""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

FRECUENCIA = 16_000
CUADRO = 1280  # 80 ms: lo que openWakeWord procesa por llamada, y lo que la app le pasa al detector

# Lo que dice cada audio de prueba. Un poco de silencio antes y después, como cuando se habla en el puesto.
AUDIOS = {
    "hola-fructus": "Hola Fructus.",
    "puesto": "Vendí diez cajas de mango a don Lucho.",
    # Lo que más engaña al modelo provisional (docs/voz/palabra-activacion-2026-11-14-provisional.md): da puntajes intermedios, que
    # son los que mejor muestran si los dos lados calculan lo mismo.
    "hola-frutas": "Hola, ¿hay frutas?",
}
# De este audio se guardan también los rasgos de cada cuadro (lo que entra al modelo de la frase), no solo el puntaje: si los
# rasgos coinciden, el espectrograma y el modelo de rasgos de la app calculan lo mismo que los de openWakeWord.
CON_RASGOS = "hola-fructus.wav"
SILENCIO_ANTES_S = 0.6
SILENCIO_DESPUES_S = 1.2


def a_16k(audio: np.ndarray, frecuencia: int) -> np.ndarray:
    mcd = np.gcd(frecuencia, FRECUENCIA)
    return resample_poly(audio, FRECUENCIA // mcd, frecuencia // mcd) if frecuencia != FRECUENCIA else audio


def fabricar_audios(voz_ruta: Path, salida: Path, semilla: int, espeak: Path | None) -> None:
    from piper import PiperVoice, SynthesisConfig

    # espeak no acepta rutas largas (unos 160 caracteres): si la del paquete lo es, se copia a una corta (generar_clips.py).
    voz = PiperVoice.load(str(voz_ruta), **({"espeak_data_dir": espeak} if espeak else {}))
    azar = np.random.default_rng(semilla)
    salida.mkdir(parents=True, exist_ok=True)
    for nombre, texto in AUDIOS.items():
        trozos = list(voz.synthesize(texto, syn_config=SynthesisConfig(length_scale=1.0, noise_scale=0.667, noise_w_scale=0.8)))
        habla = np.concatenate([t.audio_int16_array for t in trozos]).astype(np.float32) / 32768
        habla = a_16k(habla, trozos[0].sample_rate)
        habla = habla / (float(np.max(np.abs(habla))) or 1.0) * 0.7
        antes = np.zeros(int(SILENCIO_ANTES_S * FRECUENCIA), dtype=np.float32)
        despues = np.zeros(int(SILENCIO_DESPUES_S * FRECUENCIA), dtype=np.float32)
        audio = np.concatenate([antes, habla, despues])
        # Un micrófono nunca da ceros exactos: un soplo de ruido a unos -60 dB, fijo por la semilla.
        audio = audio + azar.normal(0, 0.001, len(audio)).astype(np.float32)
        audio = np.clip(audio * 32767, -32768, 32767).astype(np.int16)
        # Un largo exacto en cuadros: el detector solo procesa cuadros completos.
        audio = audio[: len(audio) // CUADRO * CUADRO]
        sf.write(salida / f"{nombre}.wav", audio, FRECUENCIA, subtype="PCM_16")
        print(f"{nombre}.wav: {len(audio) / FRECUENCIA:.2f} s, «{texto}»")


def sha256(ruta: Path) -> str:
    return hashlib.sha256(ruta.read_bytes()).hexdigest()


def calcular_puntajes(modelo_ruta: Path, audios: list[Path], salida: Path) -> None:
    import openwakeword
    import openwakeword.utils
    from openwakeword.model import Model

    openwakeword.utils.download_models(model_names=["__solo_las_de_caracteristicas__"])
    modelo = Model(wakeword_models=[str(modelo_ruta)], inference_framework="onnx")
    nombre = next(iter(modelo.models))
    puntajes, rasgos = {}, []
    for ruta in sorted(audios):
        audio, frecuencia = sf.read(str(ruta), dtype="int16")
        if frecuencia != FRECUENCIA or audio.ndim != 1:
            raise SystemExit(f"{ruta.name}: tiene que ser mono a 16 kHz")
        modelo.reset()
        # Lo mismo que hace la app al empezar: el historial de rasgos, con los de 4 s de silencio (ver arriba).
        modelo.preprocessor.feature_buffer = modelo.preprocessor._get_embeddings(np.zeros(FRECUENCIA * 4, dtype=np.int16))
        puntajes[ruta.name] = []
        for i in range(len(audio) // CUADRO):
            puntajes[ruta.name].append(round(float(modelo.predict(audio[i * CUADRO:(i + 1) * CUADRO])[nombre]), 6))
            if ruta.name == CON_RASGOS:
                rasgos.append([round(float(x), 5) for x in modelo.preprocessor.feature_buffer[-1]])
        print(f"{ruta.name}: {len(puntajes[ruta.name])} cuadros, máximo {max(puntajes[ruta.name]):.3f}")

    caracteristicas = Path(openwakeword.__file__).parent / "resources" / "models"
    referencia = {
        "openwakeword": openwakeword.__version__ if hasattr(openwakeword, "__version__") else "0.6.0",
        "modelos": {
            "hola-fructus.onnx": sha256(modelo_ruta),
            "melspectrogram.onnx": sha256(caracteristicas / "melspectrogram.onnx"),
            "embedding_model.onnx": sha256(caracteristicas / "embedding_model.onnx"),
        },
        "puntajes": puntajes,
        # Los rasgos más nuevos después de cada cuadro de CON_RASGOS (96 números por cuadro).
        "rasgos": {CON_RASGOS: rasgos},
    }
    salida.write_text(json.dumps(referencia, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"referencia: {salida}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="paso", required=True)
    a = sub.add_parser("audios", help="los audios de prueba, con una voz de Piper que el modelo no oyó")
    a.add_argument("--voz", type=Path, required=True)
    a.add_argument("--salida", type=Path, required=True)
    a.add_argument("--semilla", type=int, default=2026)
    a.add_argument("--espeak", type=Path, help="carpeta espeak-ng-data, si la del paquete tiene una ruta muy larga")
    r = sub.add_parser("puntajes", help="los puntajes de openWakeWord, cuadro por cuadro")
    r.add_argument("--modelo", type=Path, required=True)
    r.add_argument("--audios", type=Path, nargs="+", required=True)
    r.add_argument("--salida", type=Path, required=True)
    args = p.parse_args()
    if args.paso == "audios":
        fabricar_audios(args.voz, args.salida, args.semilla, args.espeak)
    else:
        calcular_puntajes(args.modelo, args.audios, args.salida)


if __name__ == "__main__":
    main()
