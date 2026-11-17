"""Convierte audio que NO es «Hola Fructus» en las características que el entrenador de openWakeWord usa como negativos.

Reemplaza a openwakeword_features_ACAV100M_2000_hrs_16bit.npy, que es CC BY-NC-SA (no comercial). Con audio propio, el modelo no
arrastra esa licencia:
  - para el modelo provisional: AudioSet y habla del puesto sintética (generar_clips.py --habla);
  - para producción: horas grabadas en el puesto, con permiso.

Dos salidas, como las del entrenador:
  --ventanas   (N, 16, 96): ventanas de 1.28 s para entrenar (`--negativos` de entrenar.py)
  --continuo   (cuadros, 96): todo seguido, para estimar falsas activaciones por hora (`--validacion` de entrenar.py)

Con --mezclar, cada archivo de habla se suma además sobre un trozo de ruido de fondo a 0–15 dB, como en el puesto.

Uso:
    python caracteristicas_negativas.py --audio fondo habla --mezclar fondo --ventanas negativos.npy
    python caracteristicas_negativas.py --audio val/fondo --continuo validacion.npy
"""

import argparse
import random
from pathlib import Path

import numpy as np
import soundfile as sf

FRECUENCIA = 16_000
VENTANA = 16  # embeddings por ejemplo: 16 × 80 ms = 1.28 s, lo que mira el modelo
PASO = 8  # entre ventanas: medio solapamiento


def leer(ruta: Path) -> np.ndarray:
    audio, frecuencia = sf.read(str(ruta), dtype="int16", always_2d=True)
    if frecuencia != FRECUENCIA:
        raise SystemExit(f"{ruta.name} está a {frecuencia} Hz: pásalo antes a 16 kHz (preparar_datos.py o generar_clips.py lo hacen)")
    return audio.mean(axis=1).astype(np.int16)


def mezclar(voz: np.ndarray, ruido: np.ndarray, snr_db: float, azar: random.Random) -> np.ndarray:
    if len(ruido) < len(voz):
        ruido = np.tile(ruido, len(voz) // max(1, len(ruido)) + 1)
    inicio = azar.randrange(0, len(ruido) - len(voz) + 1)
    r = ruido[inicio:inicio + len(voz)].astype(np.float32)
    v = voz.astype(np.float32)
    r *= np.sqrt((np.mean(v ** 2) + 1e-9) / ((np.mean(r ** 2) + 1e-9) * 10 ** (snr_db / 10)))
    m = v + r
    return np.clip(m / max(1.0, np.abs(m).max() / 32767), -32768, 32767).astype(np.int16)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--audio", type=Path, nargs="+", required=True, help="carpetas o archivos .wav a 16 kHz")
    p.add_argument("--mezclar", type=Path, help="carpeta de ruido de fondo: la habla se suma también sobre él")
    p.add_argument("--ventanas", type=Path, help="salida (N, 16, 96) para entrenar")
    p.add_argument("--continuo", type=Path, help="salida (cuadros, 96) para validar")
    p.add_argument("--semilla", type=int, default=2026)
    a = p.parse_args()
    if not (a.ventanas or a.continuo):
        raise SystemExit("Indica --ventanas, --continuo o las dos.")

    import openwakeword.utils

    openwakeword.utils.download_models(model_names=["__solo_las_de_caracteristicas__"])
    extractor = openwakeword.utils.AudioFeatures(device="cpu", inference_framework="onnx")
    azar = random.Random(a.semilla)

    archivos = sorted(f for r in a.audio for f in ([r] if r.is_file() else r.rglob("*.wav")))
    ruidos = sorted(a.mezclar.rglob("*.wav")) if a.mezclar else []
    if not archivos:
        raise SystemExit("No hay audio .wav en " + ", ".join(map(str, a.audio)))

    ventanas, continuo, segundos = [], [], 0.0
    for i, ruta in enumerate(archivos):
        versiones = [leer(ruta)]
        if ruidos and ruta.parent.resolve() != a.mezclar.resolve():
            versiones.append(mezclar(versiones[0], leer(azar.choice(ruidos)), azar.uniform(0, 15), azar))
        for audio in versiones:
            if len(audio) < FRECUENCIA * 2:  # el extractor necesita ~1 s de historia: se rellena con silencio
                audio = np.concatenate([np.zeros(FRECUENCIA * 2 - len(audio), dtype=np.int16), audio])
            emb = extractor._get_embeddings(audio)  # (cuadros, 96): un embedding cada 80 ms
            segundos += len(audio) / FRECUENCIA
            continuo.append(emb)
            ventanas += [emb[j:j + VENTANA] for j in range(0, emb.shape[0] - VENTANA + 1, PASO)]
        if (i + 1) % 200 == 0:
            print(f"  {i + 1}/{len(archivos)} archivos")

    print(f"audio: {len(archivos)} archivos, {segundos / 3600:.2f} h (con mezclas)")
    if a.ventanas:
        x = np.stack(ventanas).astype(np.float32)
        np.save(a.ventanas, x)
        print(f"ventanas: {x.shape} → {a.ventanas}")
    if a.continuo:
        x = np.concatenate(continuo).astype(np.float32)
        np.save(a.continuo, x)
        print(f"continuo: {x.shape} ({x.shape[0] * 0.08 / 3600:.2f} h) → {a.continuo}")


if __name__ == "__main__":
    main()
