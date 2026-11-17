#!/usr/bin/env bash
# El CI de Fructus (.github/workflows/ci.yml), corrido en esta máquina tal como lo corre GitHub. Sirve mientras Actions no arranque
# (la cuenta dueña está bloqueada por facturación, 2026-11-17) y antes de abrir un PR.
#
#   pnpm ci:local            prueba el último commit (HEAD)
#   pnpm ci:local <rama>     prueba otro commit o rama
#
# Para que valga lo mismo que el de GitHub, no se prueba la carpeta de trabajo, sino:
#   - una copia limpia del commit (git worktree), sin .env locales: lo que no está commiteado no cuenta;
#   - con la versión de Node de .nvmrc (se baja con npx si no es la de la máquina), y con las mismas claves de mentira del CI;
#   - sobre una base NUEVA (proyecto «fructus-ci», puertos 5692x), con las migraciones y la semilla del commit. No toca la base local
#     de nadie: si fructus-ci ya está prendida (otra sesión corriendo esto), se niega.
# Corre los dos trabajos enteros aunque un paso falle (como el CI), y sale con error si alguno falló. Al final borra la copia y apaga
# la base. Tarda unos 5 minutos.
set -uo pipefail

PROYECTO="fructus-ci"
YO="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
EXCLUIR="storage-api,imgproxy,studio,edge-runtime,logflare,vector,supavisor,realtime,postgres-meta,mailpit"

# --- Trabajo 1, «Tipos, lint y pruebas». Corre dentro de la copia, con el Node de .nvmrc (el script se llama a sí mismo).
if [ "${1:-}" = "--trabajo-1" ]; then
  cd "$2" || exit 1
  export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:56321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=clave-de-prueba CI=true
  echo "  node $(node -v), pnpm $(pnpm -v)"
  fallo=0
  for paso in "install --frozen-lockfile" typecheck lint test knip build; do
    registro="$3/pnpm-${paso%% *}.log"
    if pnpm $paso >"$registro" 2>&1; then echo "  ✓ pnpm $paso"; else echo "  ✗ pnpm $paso  (registro: $registro)"; tail -15 "$registro" | sed 's/^/      /'; fallo=1; fi
    # Sin dependencias no hay nada más que correr.
    [ "$paso" = "install --frozen-lockfile" ] && [ $fallo -ne 0 ] && exit 1
  done
  exit $fallo
fi

raiz="$(git rev-parse --show-toplevel)" || exit 1
cd "$raiz" || exit 1
ref="${1:-HEAD}"
commit="$(git rev-parse --short "$ref^{commit}")" || { echo "No existe «$ref»."; exit 1; }
[ "$ref" = "HEAD" ] && [ -n "$(git status --porcelain)" ] && echo "Aviso: hay cambios sin commitear. No cuentan: se prueba $commit tal como está commiteado."

if docker ps --format '{{.Names}}' | grep -q "^supabase_db_${PROYECTO}$"; then
  echo "La base $PROYECTO ya está prendida: otra sesión está corriendo esto. Espera a que termine (o apágala: npx supabase stop --project-id $PROYECTO)."
  exit 1
fi

temporal="${TMPDIR:-/tmp}"
tmp="$(mktemp -d "${temporal%/}/fructus-ci.XXXXXX")"
copia="$tmp/copia"
base="$tmp/base"
registros="$tmp/registros"
mkdir -p "$base" "$registros"
limpiar() {
  pnpm exec supabase stop --no-backup --workdir "$base" >/dev/null 2>&1
  git worktree remove --force "$copia" >/dev/null 2>&1
  # Los registros quedan si algo falló, para leerlos.
  [ "${resultado:-1}" -eq 0 ] && rm -rf "$tmp"
}
trap limpiar EXIT

echo "CI local de Fructus sobre $commit"
git worktree add --detach --quiet "$copia" "$commit" || exit 1

# --- Trabajo 1
echo
echo "Tipos, lint y pruebas"
nodo="$(tr -d '[:space:]v' < "$copia/.nvmrc")"
if [ "$(node -v | cut -d. -f1 | tr -d v)" = "${nodo%%.*}" ]; then
  bash "$YO" --trabajo-1 "$copia" "$registros"
else
  # pnpm pasa su configuración a npm como variables, y npm se queja de cada una: ruido, no errores.
  npx -y -p "node@$nodo" bash "$YO" --trabajo-1 "$copia" "$registros" 2> >(grep -v "Unknown env config" >&2)
fi
trabajo1=$?

# --- Trabajo 2, «Pruebas de la base». La carpeta supabase/ del commit, con otro proyecto y otros puertos (563xx → 569xx).
echo
echo "Pruebas de la base"
git archive "$commit" supabase scripts/invariantes.sql | tar -x -C "$base"
sed -i.orig -e "s/^project_id = .*/project_id = \"$PROYECTO\"/" -e 's/= 563\([0-9]\)/= 569\1/' "$base/supabase/config.toml"
trabajo2=0
if pnpm exec supabase start --workdir "$base" -x "$EXCLUIR" >"$registros/supabase-start.log" 2>&1; then
  echo "  ✓ supabase start (migraciones y semilla)"
  if pnpm exec supabase test db --workdir "$base" >"$registros/pgtap.log" 2>&1; then
    echo "  ✓ pgTAP: $(grep -m1 '^Files=' "$registros/pgtap.log" | cut -d, -f1-2)"
  else
    echo "  ✗ pgTAP  (registro: $registros/pgtap.log)"; grep -E "not ok|Failed|^Result" "$registros/pgtap.log" | head -15 | sed 's/^/      /'; trabajo2=1
  fi
  if docker exec -i "supabase_db_$PROYECTO" psql -U postgres -v ON_ERROR_STOP=1 -f - <"$base/scripts/invariantes.sql" >"$registros/invariantes.log" 2>&1; then
    echo "  ✓ invariantes: $(grep -o 'las [0-9]* en orden' "$registros/invariantes.log")"
  else
    echo "  ✗ invariantes  (registro: $registros/invariantes.log)"; tail -10 "$registros/invariantes.log" | sed 's/^/      /'; trabajo2=1
  fi
else
  echo "  ✗ supabase start  (registro: $registros/supabase-start.log)"; tail -15 "$registros/supabase-start.log" | sed 's/^/      /'; trabajo2=1
fi

resultado=$((trabajo1 || trabajo2))
echo
if [ $resultado -eq 0 ]; then
  echo "✓ CI local en verde sobre $commit: los dos trabajos pasaron."
else
  echo "✗ CI local en ROJO sobre $commit. Los registros quedan en $registros"
fi
exit $resultado
