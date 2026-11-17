---
name: abrir-pr
description: Abre un PR de Fructus sin sorpresas — trae main y resuelve conflictos, revisa que las migraciones nuevas tengan la versión real de Supabase y su prueba, corre las pruebas que toca el cambio, adjunta la captura a 412 px si cambia una pantalla, y recién ahí abre el PR con la descripción completa. Úsala siempre que vayas a abrir un PR, y cuando digan «abre el PR», «sube esto» o «/abrir-pr». No fusiona.
---

Abre el PR de la rama actual: $ARGUMENTS

Viene de `/abrir-pr` de CAYLA Retail, recortada para un proyecto de una persona: no hay reservas de números ni choques entre muchos PR.
Lo que sí se cuida es que nada llegue a `main` sin verificar.

## 1. La rama, limpia y al día

1. `git status --short` debe estar vacío: todo commiteado (un commit por actividad si vino de `/construir`).
2. Haz `git fetch origin && git merge origin/main`. Resuelve los conflictos de verdad, no con «me quedo con lo mío», y commitea el merge.

## 2. Las migraciones

Para cada archivo nuevo en `supabase/migrations/`:
- **Si ya se aplicó al proyecto:** su versión tiene que ser la que muestra `list_migrations` del MCP de Supabase. Si no coincide, renómbralo con `git mv`.
- **Si todavía no se aplicó:** dilo en la descripción («SQL por aplicar»). Aplicarlo necesita el OK de quien dirige el proyecto.
- **Tiene su prueba en `supabase/tests/`:** el caso feliz, el rechazo por rol y un caso borde.
- **Nunca se edita una migración ya aplicada.** La corrección va en un archivo nuevo.

## 3. Las pruebas que toca el cambio

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm knip`.
2. Si toca `supabase/`: `npx supabase db reset && npx supabase test db && psql "$DB_URL" -f scripts/invariantes.sql`.
3. Si toca una pantalla: la prueba e2e de esa ruta (`pnpm exec playwright test tests/e2e/<ruta>`) y una **captura a 412 px**.
4. Si toca la voz (`lib/voz/`, `docs/interprete-voz.md`, `tests/interprete/`): `/voz-precision` y su resultado.
5. Con todo commiteado, `pnpm ci:local`: el CI entero sobre una copia limpia del commit y una base nueva, como en GitHub. Mientras
   Actions no arranque, su resultado es el CI del PR y va en la descripción.

Si algo falla y no es tuyo, dilo en la descripción. No lo arregles en este PR.

## 4. Abrir el PR

`gh pr create --base main` con el título en Conventional Commits (scope = dominio) y el cuerpo de `.github/pull_request_template.md`
completo:
- qué cambia, en lenguaje de negocio;
- cómo se verificó, con comandos y resultados;
- la captura;
- las casillas que aplican, marcadas con verdad.

Termina con la línea de atribución que pida el sistema.

## 5. Después

- No actives la fusión automática ni fusiones: eso lo decide quien dirige el proyecto.
- Si el CI sale en rojo, se arregla en la misma rama antes de pedir revisión.
