#!/usr/bin/env bash
# Rehace los audios de tests/bulla/ con las voces del Mac (`say`) y ffmpeg. Son voces sintéticas: ninguna es de una persona.
# Los dictados son lo que dice quien tiene el celular; los vecinos, la bulla del mercado que se mezcla encima en las pruebas
# (tests/bulla/mezcla.ts). Uso: bash scripts/voz/bulla/generar.sh
set -euo pipefail
cd "$(dirname "$0")/../../../tests/bulla"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

decir() { # nombre, voz, frase
  say -v "$2" -o "$tmp/$1.aiff" "$3"
  ffmpeg -loglevel error -y -i "$tmp/$1.aiff" -ar 16000 -ac 1 -sample_fmt s16 -map_metadata -1 -fflags +bitexact "$1.wav"
}

# Quien dicta. «pensando» tiene una pausa de 0.8 s a mitad de frase, como quien piensa el precio: no tiene que cortar ahí.
decir dictado-venta "Paulina" "Véndele diez cajas de mango kent a don Lucho, a cuarenta y cinco, lo debe"
decir dictado-pensando "Eddy (Español (México))" "Dos cajas de piña golden [[slnc 800]] a treinta soles, pagó con yape"
decir dictado-abono "Mónica" "Doña Rosa abonó cien soles"

# Los vecinos: lo que se oye en un puesto de La Hermelinda mientras se dicta.
decir vecino-1 "Eddy (Español (México))" "Oiga casera, a cómo está la papaya, déme dos kilos de limón y una caja de plátano, ya ya, al toque"
decir vecino-2 "Flo (Español (México))" "Pase pase, mandarina dulce, piña golden a tres soles, lleve lleve caserita, fresa fresquita"
decir vecino-3 "Mónica" "Señora venga, le hago precio, uva red globe, manzana israel, cuánto le debo, ya le yapeo"
decir vecino-4 "Reed (Español (México))" "Jefe, la carretilla, permiso permiso, cuidado que pasa, baja esas jabas al fondo"
decir vecino-5 "Rocko (Español (España))" "Ya llegó el camión de la sierra, oiga maestro cuántas cajas van a bajar hoy, rápido"
decir vecino-6 "Sandy (Español (México))" "Hay palta fuerte, palta hass, a cinco soles el kilo, caserito qué va a llevar hoy"
