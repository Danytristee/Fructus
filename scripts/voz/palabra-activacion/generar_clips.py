"""Genera los clips de entrenamiento de «Hola Fructus» en español, donde los espera el entrenador de openWakeWord.

openWakeWord genera sus clips con una voz sintética en inglés. Aquí se generan con las voces en español de Piper (España, México
y Argentina), variando velocidad y entonación, y se suman las grabaciones reales del equipo. Deja:

    <salida>/positive_train  «Hola Fructus» para entrenar
    <salida>/positive_test   «Hola Fructus» para validar durante el entrenamiento
    <salida>/negative_train  frases parecidas o del puesto que NO deben despertarlo
    <salida>/negative_test

Todo a 16 kHz, mono, 16 bits. Las grabaciones reales de las personas en --reservar NO se usan aquí: quedan para medir
(medir.py), así el número final sale de voces que el modelo nunca oyó.

Uso:
    python generar_clips.py --voces voces/ --salida salida/hola_fructus --n-train 5000 --n-test 500 \
        --grabaciones grabaciones/ --reservar dueno
"""

import argparse
import random
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

FRECUENCIA = 16_000

POSITIVAS = ["Hola Fructus", "hola fructus", "Hola, Fructus", "¡Hola Fructus!", "Hola Fructus.", "Ola Fructus"]

# Lo que se dice en el puesto y suena parecido: no debe despertarlo. Incluye «Fructus» solo, para que haga falta el «hola».
NEGATIVAS = [
    "hola", "hola Lucho", "hola casera", "hola amigo", "hola señora", "hola, ¿cuánto está?", "hola, buenos días",
    "Fructus", "fruta", "frutas", "las frutas", "fructosa", "productos", "Fructuoso", "factura", "hazle factura",
    "ola", "hola Rosa", "hola don Lucho", "la fruta está buena", "tus frutas", "con fruta", "producto",
    "vendí diez cajas de mango a don Lucho", "se malograron tres jabas de papaya", "¿quién me debe?",
    "pagué ochenta de flete", "llegaron cincuenta cajas de plátano", "me yapeó", "lo debe", "cuánto vendí hoy",
    "¿cuántas cajas de mango me quedan?", "dos cajas de manzana", "fresa", "frutería", "fructífero", "hoy vendimos",
]

# Frases con «fruta»: lo que más lo engaña (2026-11-14, voz que no oyó: ~11 % lo despiertan). Sumarlas a los negativos bajó esas
# falsas a 2–4 %, pero la detección cayó de 90 % a 46–61 %: «hola, frutas» y «hola Fructus» casi no se distinguen con voces
# sintéticas. Por eso van aparte (--con-fruta), para probarlas con grabaciones reales, no por defecto.
NEGATIVAS_FRUTA = [
    "fruta fresca", "frutas frescas", "la fruta", "esa fruta", "fruta buena", "fruta de temporada", "frutero", "frutita",
    "hola, ¿hay fruta?", "hola casera, fruta fresca", "hola, la fruta está buena", "hola, ¿qué fruta hay?", "hola frutero",
    "hola, ¿a cómo la fruta?", "olas de fruta", "hola, fresas", "hola, frutas", "hola Fructuoso", "hola Fructuosa", "fructuoso",
    "toda la fruta", "fruta de Chao", "la fruta llegó", "fructosa natural", "hola, ¿y la fruta?", "frutas y verduras",
]

# Habla del puesto para los negativos «largos»: lo que el modelo oirá todo el día y nunca debe tomar por «Hola Fructus».
FRUTAS = ["mango", "mango kent", "papaya", "plátano isla", "plátano seda", "piña", "manzana verde", "manzana delicia", "uva",
          "naranja", "mandarina", "fresa", "pera", "palta", "limón", "sandía", "membrillo", "melocotón", "granadilla", "maracuyá"]
CLIENTES = ["don Lucho", "la señora Rosa", "el flaco", "la del puesto doce", "don Carlos", "el Paraíso", "la bodega Santa Ana",
            "el de Chao", "el de Piura", "la casera", "Juanito", "doña Maruja"]
NUMEROS = ["dos", "tres", "cinco", "ocho", "diez", "doce", "quince", "veinte", "treinta", "cuarenta", "cincuenta", "cien"]
PLANTILLAS = [
    "vendí {n} cajas de {f} a {c}", "{n} de {f} para {c}, lo debe", "{c} me pagó {n} soles con Yape",
    "llegaron {n} cajas de {f} de {c}", "se malograron {n} jabas de {f}", "¿cuántas cajas de {f} me quedan?",
    "¿cuánto me debe {c}?", "{c} me abonó {n} soles en efectivo", "pagué {n} soles de flete", "a cuánto está la caja de {f}",
    "ya, te dejo la {f} a {n}", "casera, llévate {n} de {f}", "hola {c}, ¿qué vas a llevar hoy?", "la {f} está buenaza",
    "hazle factura a {c}", "anota {n} cajas de {f}", "mañana llega más {f}", "buenos días, ¿hay {f}?",
    "{c}, ¿me pasas las {n} jabas?", "cierra la caja, ya son las seis", "la fruta de hoy salió bonita",
]


def frases_del_puesto(azar: random.Random, cuantas: int) -> list[str]:
    """Frases de una a tres oraciones, como habla la gente en el puesto."""
    def una() -> str:
        return azar.choice(PLANTILLAS).format(n=azar.choice(NUMEROS), f=azar.choice(FRUTAS), c=azar.choice(CLIENTES))
    return [". ".join(una() for _ in range(azar.randint(1, 3))) for _ in range(cuantas)]


def a_16k(audio: np.ndarray, frecuencia: int) -> np.ndarray:
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if frecuencia != FRECUENCIA:
        mcd = np.gcd(frecuencia, FRECUENCIA)
        audio = resample_poly(audio, FRECUENCIA // mcd, frecuencia // mcd)
    pico = float(np.max(np.abs(audio))) or 1.0
    return (audio / pico * 0.9 * 32767).astype(np.int16)


LEIBLES = {".wav", ".flac", ".ogg"}
CONVERTIBLES = {".m4a", ".mp3", ".aac", ".mp4", ".opus", ".webm", ".caf"}  # lo que graba un celular


def leer(ruta: Path) -> tuple[np.ndarray, int]:
    """Audio como float32. Lo que graba un celular (M4A, MP3…) se convierte con ffmpeg, que Colab ya trae."""
    if ruta.suffix.lower() not in CONVERTIBLES:
        return sf.read(str(ruta), dtype="float32")
    if not shutil.which("ffmpeg"):
        raise SystemExit(f"Para leer {ruta.name} hace falta ffmpeg.")
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "a.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(ruta), "-ac", "1", "-ar", str(FRECUENCIA), str(wav)], check=True)
        return sf.read(str(wav), dtype="float32")


def cargar_voces(carpeta: Path, espeak: Path | None):
    from piper import PiperVoice

    voces = []
    for modelo in sorted(carpeta.glob("*.onnx")):
        # espeak no acepta rutas largas (unos 160 caracteres): si la del paquete lo es, se copia a una corta y se pasa aquí.
        voz = PiperVoice.load(str(modelo), **({"espeak_data_dir": espeak} if espeak else {}))
        voces.append((modelo.stem, voz, max(1, voz.config.num_speakers)))
    if not voces:
        raise SystemExit(f"No hay voces .onnx de Piper en {carpeta}")
    return voces


def sintetizar(voz, hablantes: int, texto: str, azar: random.Random) -> np.ndarray:
    from piper import SynthesisConfig

    config = SynthesisConfig(
        speaker_id=azar.randrange(hablantes) if hablantes > 1 else None,
        length_scale=azar.uniform(0.8, 1.35),  # más rápido o más lento, como se habla apurado o con calma
        noise_scale=azar.uniform(0.45, 0.9),
        noise_w_scale=azar.uniform(0.6, 1.0),
    )
    trozos = list(voz.synthesize(texto, syn_config=config))
    audio = np.concatenate([t.audio_int16_array for t in trozos]).astype(np.float32) / 32768
    return a_16k(audio, trozos[0].sample_rate)


def llenar(carpeta: Path, cuantos: int, textos: list[str], voces, azar: random.Random) -> None:
    carpeta.mkdir(parents=True, exist_ok=True)
    ya = len(list(carpeta.glob("*.wav")))
    with open(carpeta / "textos.tsv", "a", encoding="utf-8") as registro:  # qué dice cada clip: para saber cuáles engañan al modelo
        for n in range(ya, cuantos):
            nombre, voz, hablantes = voces[n % len(voces)]
            texto = azar.choice(textos)
            audio = sintetizar(voz, hablantes, texto, azar)
            archivo = f"tts_{nombre}_{n:05d}.wav"
            sf.write(carpeta / archivo, audio, FRECUENCIA, subtype="PCM_16")
            registro.write(f"{archivo}\t{texto}\n")
    print(f"{carpeta.name}: {cuantos} clips ({cuantos - ya} nuevos)")


def sumar_grabaciones(origen: Path, entrenar: Path, validar: Path, reservar: set[str], repetir: int, azar: random.Random) -> None:
    """Grabaciones reales en <origen>/<persona>/*.wav (o .m4a/.mp3 convertidos antes). Las reservadas no se tocan."""
    personas = [p for p in sorted(origen.iterdir()) if p.is_dir()]
    usadas = 0
    for persona in personas:
        if persona.name in reservar:
            print(f"grabaciones de «{persona.name}»: reservadas para medir, no se usan al entrenar")
            continue
        archivos = sorted(f for f in persona.iterdir() if f.suffix.lower() in LEIBLES | CONVERTIBLES)
        azar.shuffle(archivos)
        corte = max(1, len(archivos) // 10)  # una de cada diez, a validar durante el entrenamiento
        for i, archivo in enumerate(archivos):
            audio, frecuencia = leer(archivo)
            clip = a_16k(audio, frecuencia)
            destino, veces = (validar, 1) if i < corte else (entrenar, repetir)
            for r in range(veces):  # pesan más que los sintéticos: son las voces y el micrófono de verdad
                sf.write(destino / f"real_{persona.name}_{archivo.stem}_{r}.wav", clip, FRECUENCIA, subtype="PCM_16")
            usadas += 1
    print(f"grabaciones reales usadas: {usadas}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--voces", type=Path, required=True, help="carpeta con voces de Piper en español (.onnx y .onnx.json)")
    p.add_argument("--salida", type=Path, required=True, help="<output_dir>/<model_name> del entrenador")
    p.add_argument("--n-train", type=int, default=5000)
    p.add_argument("--n-test", type=int, default=500)
    p.add_argument("--con-fruta", action="store_true", help="suma NEGATIVAS_FRUTA a las frases parecidas (ver la nota de la lista)")
    p.add_argument("--n-negativos", type=int, help="frases parecidas para entrenar (por defecto, tantas como --n-train)")
    p.add_argument("--grabaciones", type=Path, help="carpeta con una subcarpeta por persona")
    p.add_argument("--reservar", nargs="*", default=[], help="personas cuyas grabaciones se guardan para medir")
    p.add_argument("--repetir-reales", type=int, default=10)
    p.add_argument("--semilla", type=int, default=2026)
    p.add_argument("--habla", type=int, default=0, help="cuántas frases del puesto generar para los negativos largos")
    p.add_argument("--habla-salida", type=Path, help="dónde dejar esas frases (para caracteristicas_negativas.py)")
    p.add_argument("--espeak", type=Path, help="carpeta espeak-ng-data, si la del paquete tiene una ruta muy larga")
    p.add_argument("--rehacer", action="store_true", help="borra los clips que ya había")
    a = p.parse_args()

    azar = random.Random(a.semilla)
    if a.rehacer and a.salida.exists():
        for sub in ("positive_train", "positive_test", "negative_train", "negative_test"):
            shutil.rmtree(a.salida / sub, ignore_errors=True)
    voces = cargar_voces(a.voces, a.espeak)
    print("voces:", ", ".join(f"{n} ({h} hablante{'s' if h > 1 else ''})" for n, _, h in voces))
    llenar(a.salida / "positive_train", a.n_train, POSITIVAS, voces, azar)
    llenar(a.salida / "positive_test", a.n_test, POSITIVAS, voces, azar)
    parecidas = NEGATIVAS + (NEGATIVAS_FRUTA if a.con_fruta else [])
    llenar(a.salida / "negative_train", a.n_negativos or a.n_train, parecidas, voces, azar)
    llenar(a.salida / "negative_test", a.n_test, parecidas, voces, azar)
    if a.habla:
        if not a.habla_salida:
            raise SystemExit("--habla necesita --habla-salida")
        llenar(a.habla_salida, a.habla, frases_del_puesto(azar, a.habla * 3), voces, azar)
    if a.grabaciones:
        sumar_grabaciones(a.grabaciones, a.salida / "positive_train", a.salida / "positive_test", set(a.reservar), a.repetir_reales, azar)


if __name__ == "__main__":
    main()
