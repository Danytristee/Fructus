"""Vuelve a dar `torchaudio.load` y `torchaudio.info` con soundfile.

openWakeWord 0.6.0 (y speechbrain 0.5) leen audio con `torchaudio.info` y `torchaudio.load`. Desde torchaudio 2.9, `info` ya no
existe y `load` exige torchcodec: en un Colab de hoy el entrenamiento se cae al aumentar los clips. Este parche se aplica antes de
importar el entrenador. Solo hace falta para WAV/FLAC, que es lo que usa el entrenamiento.
"""

from types import SimpleNamespace

import soundfile as sf
import torch
import torchaudio


def _load(ruta, *args, **kwargs):
    datos, frecuencia = sf.read(str(ruta), dtype="float32", always_2d=True)
    return torch.from_numpy(datos.T.copy()), frecuencia


def _info(ruta, *args, **kwargs):
    i = sf.info(str(ruta))
    return SimpleNamespace(sample_rate=i.samplerate, num_frames=i.frames, num_channels=i.channels)


def aplicar() -> None:
    torchaudio.load = _load
    torchaudio.info = _info
