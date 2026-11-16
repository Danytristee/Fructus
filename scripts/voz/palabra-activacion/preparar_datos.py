"""Baja lo que necesita el entrenamiento, sin librerías que hoy piden torchcodec (`datasets` y `torchaudio` nuevos).

    voces/       voces en español de Piper (España, México y Argentina)                     ~ 450 MB
    mit_rirs/    270 respuestas de sala del MIT, a 16 kHz                                    ~ 8 MB
    fondo/       ruido de fondo: clips de 10 s de AudioSet (bal_train), a 16 kHz mono       ~ 650 MB por fragmento
    openwakeword_features_ACAV100M_2000_hrs_16bit.npy  audio que no es la palabra           ~ 17.3 GB
    validation_set_features.npy                        para estimar falsas activaciones     ~ 185 MB

El cuaderno oficial de openWakeWord bajaba AudioSet en .tar, que ya no existe (ahora es parquet), y decodificaba con `datasets`.

Licencias: el código de openWakeWord es Apache 2.0. Las características ACAV100M son CC BY-NC-SA 4.0 (no comercial): un modelo
entrenado con ellas sirve para la demo universitaria, no para vender. Antes de producción se reentrena con audio propio.

Uso:
    python preparar_datos.py --destino . --fragmentos-fondo 2
    python preparar_datos.py --destino prueba --sin-caracteristicas --max-clips-fondo 20   # prueba chica
"""

import argparse
import io
import shutil
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

FRECUENCIA = 16_000
VOCES = [
    "es/es_AR/daniela/high/es_AR-daniela-high",
    "es/es_ES/davefx/medium/es_ES-davefx-medium",
    "es/es_ES/sharvard/medium/es_ES-sharvard-medium",
    "es/es_ES/mls_10246/low/es_ES-mls_10246-low",
    "es/es_ES/mls_9972/low/es_ES-mls_9972-low",
    "es/es_MX/ald/medium/es_MX-ald-medium",
    "es/es_MX/claude/high/es_MX-claude-high",
]


def a_16k_mono(audio: np.ndarray, frecuencia: int) -> np.ndarray:
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if frecuencia != FRECUENCIA:
        mcd = np.gcd(frecuencia, FRECUENCIA)
        audio = resample_poly(audio, FRECUENCIA // mcd, frecuencia // mcd)
    return np.clip(audio * 32767, -32768, 32767).astype(np.int16)


def bajar_voces(destino: Path) -> None:
    from huggingface_hub import hf_hub_download

    destino.mkdir(parents=True, exist_ok=True)
    for v in VOCES:
        for ext in (".onnx", ".onnx.json"):
            ruta = hf_hub_download("rhasspy/piper-voices", v + ext, local_dir=destino / "_hf")
            Path(ruta).replace(destino / Path(v + ext).name)  # se mueve, no se copia: son ~70 MB cada una
    shutil.rmtree(destino / "_hf", ignore_errors=True)
    print(f"voces: {len(VOCES)} en {destino}")


def bajar_salas(destino: Path) -> None:
    from huggingface_hub import HfFileSystem

    fs = HfFileSystem()
    destino.mkdir(parents=True, exist_ok=True)
    archivos = fs.glob("datasets/davidscripka/MIT_environmental_impulse_responses/16khz/*.wav")
    for a in archivos:
        salida = destino / Path(a).name
        if not salida.exists():
            audio, frecuencia = sf.read(io.BytesIO(fs.cat_file(a)), dtype="float32")
            sf.write(salida, a_16k_mono(audio, frecuencia), FRECUENCIA, subtype="PCM_16")
    print(f"salas: {len(archivos)} en {destino}")


def bajar_fondo(destino: Path, fragmentos: int, max_clips: int | None, primero: int = 0) -> None:
    import pyarrow.parquet as pq
    from huggingface_hub import HfFileSystem

    fs = HfFileSystem()
    destino.mkdir(parents=True, exist_ok=True)
    hechos = 0
    for n in range(primero, primero + fragmentos):
        with fs.open(f"datasets/agkphysics/AudioSet/data/bal_train/{n:02d}.parquet", "rb") as f:
            pf = pq.ParquetFile(f)
            for g in range(pf.num_row_groups):  # por grupos: no carga 650 MB de una vez
                tabla = pf.read_row_group(g, columns=["video_id", "audio"])
                for vid, audio in zip(tabla.column("video_id").to_pylist(), tabla.column("audio").to_pylist()):
                    salida = destino / f"audioset_{vid}.wav"
                    if not salida.exists():
                        try:
                            datos, frecuencia = sf.read(io.BytesIO(audio["bytes"]), dtype="float32")
                        except RuntimeError:
                            continue  # algún clip viene dañado: se salta
                        sf.write(salida, a_16k_mono(datos, frecuencia), FRECUENCIA, subtype="PCM_16")
                    hechos += 1
                    if max_clips and hechos >= max_clips:
                        print(f"fondo: {hechos} clips en {destino}")
                        return
    print(f"fondo: {hechos} clips en {destino}")


def bajar_caracteristicas(destino: Path) -> None:
    from huggingface_hub import hf_hub_download

    for nombre in ("validation_set_features.npy", "openwakeword_features_ACAV100M_2000_hrs_16bit.npy"):
        ruta = hf_hub_download("davidscripka/openwakeword_features", nombre, repo_type="dataset", local_dir=destino)
        print(f"{nombre}: {Path(ruta).stat().st_size / 2**30:.1f} GB")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--destino", type=Path, default=Path("."))
    p.add_argument("--fragmentos-fondo", type=int, default=2, help="cada fragmento de AudioSet son ~500 clips de 10 s")
    p.add_argument("--primer-fragmento", type=int, default=0, help="desde qué fragmento de AudioSet (para separar entrenar de validar)")
    p.add_argument("--max-clips-fondo", type=int, help="corta antes (para probar)")
    p.add_argument("--solo-fondo", action="store_true", help="solo el ruido de fondo (las voces y salas ya están)")
    p.add_argument("--sin-caracteristicas", action="store_true", help="no baja los 17.5 GB (para probar)")
    a = p.parse_args()

    if not a.solo_fondo:
        bajar_voces(a.destino / "voces")
        bajar_salas(a.destino / "mit_rirs")
    bajar_fondo(a.destino / "fondo", a.fragmentos_fondo, a.max_clips_fondo, a.primer_fragmento)
    if not (a.sin_caracteristicas or a.solo_fondo):
        bajar_caracteristicas(a.destino)


if __name__ == "__main__":
    main()
