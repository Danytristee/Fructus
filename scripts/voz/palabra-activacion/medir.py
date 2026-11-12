"""Mide un modelo de «Hola Fructus» con audios reales del puesto: cuántas veces lo detecta y cuántas veces despierta solo.

La prueba de viabilidad (actividad 4) pasa si, en algún umbral:
  - detecta 90 % o más de los «Hola Fructus» de personas que el modelo nunca oyó (reservadas al entrenar), también con ruido, y
  - despierta solo 1 vez por hora o menos con el ruido real del puesto.

Corre en esta máquina: ningún audio sale de aquí. Lee WAV/FLAC directo; M4A, MP3 u OGG del celular los convierte con ffmpeg
(o afconvert en macOS) a una carpeta temporal.

Uso:
    python medir.py --modelo hola_fructus.onnx --positivos grabaciones/dueno grabaciones/ayudante2 --ruido ruido/ \
        --informe ../../../docs/voz/palabra-activacion-2026-11-20.md
"""

import argparse
import datetime as dt
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

FRECUENCIA = 16_000
CUADRO = 1280  # 80 ms: lo que openWakeWord procesa por llamada
UMBRALES = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
REFRACTARIO_S = 2.0  # tras despertar, no cuenta otra activación en 2 s (la app tampoco volvería a abrir la escucha)
META_DETECCION = 0.90
META_FALSAS_HORA = 1.0
LEIBLES = {".wav", ".flac"}
CONVERTIBLES = {".m4a", ".mp3", ".ogg", ".aac", ".mp4", ".opus", ".webm", ".caf"}


def leer(ruta: Path, temporal: Path) -> np.ndarray:
    """Audio a 16 kHz mono int16. Lo que no es WAV/FLAC se convierte primero."""
    if ruta.suffix.lower() in CONVERTIBLES:
        destino = temporal / (ruta.stem + f"_{abs(hash(str(ruta)))}.wav")
        if shutil.which("ffmpeg"):
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(ruta), "-ac", "1", "-ar", str(FRECUENCIA), str(destino)], check=True)
        elif shutil.which("afconvert"):
            subprocess.run(["afconvert", "-f", "WAVE", "-d", f"LEI16@{FRECUENCIA}", "-c", "1", str(ruta), str(destino)], check=True)
        else:
            raise SystemExit(f"Para leer {ruta.suffix} hace falta ffmpeg (brew install ffmpeg).")
        ruta = destino
    audio, frecuencia = sf.read(str(ruta), dtype="float32", always_2d=True)
    audio = audio.mean(axis=1)
    if frecuencia != FRECUENCIA:
        mcd = np.gcd(frecuencia, FRECUENCIA)
        audio = resample_poly(audio, FRECUENCIA // mcd, frecuencia // mcd)
    return np.clip(audio * 32767, -32768, 32767).astype(np.int16)


def archivos(rutas: list[Path]) -> list[Path]:
    salida = []
    for r in rutas:
        candidatos = [r] if r.is_file() else sorted(r.rglob("*"))
        salida += [f for f in candidatos if f.is_file() and f.suffix.lower() in LEIBLES | CONVERTIBLES]
    return salida


def puntajes(modelo, audio: np.ndarray) -> np.ndarray:
    """El puntaje de cada cuadro de 80 ms, desde un modelo limpio (sin lo que oyó antes)."""
    modelo.reset()
    nombre = next(iter(modelo.models))
    n = len(audio) // CUADRO
    return np.array([modelo.predict(audio[i * CUADRO:(i + 1) * CUADRO])[nombre] for i in range(n)], dtype=np.float32)


def mezclar(voz: np.ndarray, ruido: np.ndarray, snr_db: float, azar: np.random.Generator) -> np.ndarray:
    """La frase sobre un trozo al azar del ruido del puesto, con la relación señal/ruido dada."""
    if len(ruido) <= len(voz):
        return voz
    inicio = azar.integers(0, len(ruido) - len(voz))
    trozo = ruido[inicio:inicio + len(voz)].astype(np.float32)
    v = voz.astype(np.float32)
    pv, pr = np.mean(v ** 2) + 1e-9, np.mean(trozo ** 2) + 1e-9
    trozo *= np.sqrt(pv / (pr * 10 ** (snr_db / 10)))
    mezcla = v + trozo
    return np.clip(mezcla / max(1.0, np.abs(mezcla).max() / 32767), -32768, 32767).astype(np.int16)


def activaciones(p: np.ndarray, umbral: float) -> int:
    cuenta, espera = 0, 0
    refractario = int(REFRACTARIO_S * FRECUENCIA / CUADRO)
    for valor in p:
        if espera > 0:
            espera -= 1
        elif valor >= umbral:
            cuenta += 1
            espera = refractario
    return cuenta


def main() -> None:
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--modelo", type=Path, required=True)
    a.add_argument("--positivos", type=Path, nargs="+", required=True, help="«Hola Fructus» reales de personas reservadas")
    a.add_argument("--ruido", type=Path, nargs="+", required=True, help="horas del puesto sin la palabra")
    a.add_argument("--snr", type=float, nargs="*", default=[10.0, 5.0], help="dB de la frase sobre el ruido del puesto")
    a.add_argument("--informe", type=Path, help="markdown con los resultados (docs/voz/palabra-activacion-AAAA-MM-DD.md)")
    a.add_argument("--semilla", type=int, default=2026)
    args = a.parse_args()

    import openwakeword.utils
    from openwakeword.model import Model

    openwakeword.utils.download_models(model_names=["__solo_las_de_caracteristicas__"])  # melspectrogram y embedding, una vez
    modelo = Model(wakeword_models=[str(args.modelo)], inference_framework="onnx")
    azar = np.random.default_rng(args.semilla)
    silencio = np.zeros(FRECUENCIA, dtype=np.int16)

    with tempfile.TemporaryDirectory() as tmp:
        temporal = Path(tmp)
        ruidos = [leer(f, temporal) for f in archivos(args.ruido)]
        ruido_total = np.concatenate(ruidos) if ruidos else np.zeros(0, dtype=np.int16)
        horas = len(ruido_total) / FRECUENCIA / 3600
        frases = [(f, leer(f, temporal)) for f in archivos(args.positivos)]
    if not frases or horas == 0:
        raise SystemExit(f"Faltan audios: {len(frases)} frases y {horas:.2f} h de ruido.")

    # Cada frase con 1 s de silencio a cada lado (limpia) y sobre el ruido del puesto a cada SNR.
    condiciones = {"limpia": [np.concatenate([silencio, v, silencio]) for _, v in frases]}
    for snr in args.snr:
        condiciones[f"ruido {snr:g} dB"] = [mezclar(np.concatenate([silencio, v, silencio]), ruido_total, snr, azar) for _, v in frases]
    maximos = {c: np.array([puntajes(modelo, x).max() for x in clips]) for c, clips in condiciones.items()}

    t0 = time.perf_counter()
    p_ruido = puntajes(modelo, ruido_total)
    costo = (time.perf_counter() - t0) / (len(ruido_total) / FRECUENCIA)

    filas = []
    for u in UMBRALES:
        deteccion = {c: float((m >= u).mean()) for c, m in maximos.items()}
        falsas = activaciones(p_ruido, u) / horas
        cumple = min(deteccion.values()) >= META_DETECCION and falsas <= META_FALSAS_HORA
        filas.append((u, deteccion, falsas, cumple))

    personas = sorted({f.parent.name for f, _ in frases})
    cabecera = ["Umbral", *[f"Detección {c}" for c in condiciones], "Falsas por hora", "¿Cumple?"]
    lineas = [
        f"# «Hola Fructus»: prueba de viabilidad ({dt.date.today().isoformat()})",
        "",
        f"- **Modelo:** `{args.modelo.name}` ({args.modelo.stat().st_size // 1024} KB).",
        f"- **Frases:** {len(frases)} «Hola Fructus» de {len(personas)} persona(s) que el modelo no oyó al entrenar ({', '.join(personas)}).",
        f"- **Ruido del puesto:** {horas:.2f} h en {len(ruidos)} archivo(s). Tras despertar no cuenta otra activación en {REFRACTARIO_S:g} s.",
        f"- **Meta:** detección ≥ {META_DETECCION:.0%} en todas las condiciones y ≤ {META_FALSAS_HORA:g} falsa por hora.",
        f"- **Costo en esta máquina:** {costo * 1000:.1f} ms de cálculo por segundo de audio (un celular de gama media será varias veces más lento).",
        "",
        "| " + " | ".join(cabecera) + " |",
        "|" + "---|" * len(cabecera),
    ]
    for u, deteccion, falsas, cumple in filas:
        lineas.append("| " + " | ".join([f"{u:.1f}", *[f"{d:.1%}" for d in deteccion.values()], f"{falsas:.2f}", "sí" if cumple else "no"]) + " |")
    buenos = [f for f in filas if f[3]]
    lineas += [
        "",
        f"**Veredicto:** {'pasa con umbral ' + f'{buenos[0][0]:.1f}' if buenos else 'no pasa en ningún umbral'}.",
    ]
    texto = "\n".join(lineas) + "\n"
    print(texto)
    if args.informe:
        args.informe.parent.mkdir(parents=True, exist_ok=True)
        args.informe.write_text(texto)
        print(f"Informe: {args.informe}")


if __name__ == "__main__":
    main()
