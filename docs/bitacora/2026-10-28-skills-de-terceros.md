# 2026-10-28 · Skills de terceros en el repo

**Qué cambió:**
- 21 skills de afuera copiadas a `.claude/skills/` con `npx skills add --copy`, fijadas en `skills-lock.json` (ADR-0004): diseño, movimiento, React y Next.js, Supabase y oficio.
- `docs/terceros/README.md` con el para qué, el commit de origen y la licencia de cada una; textos de licencia en `docs/terceros/licencias/`.
- `CLAUDE.md`: la sección «De afuera» ahora dice que vienen en el repo y cómo se actualizan.

**Cómo se verificó:**
- Solo `ui-ux-pro-max` trae scripts (Python): buscan en sus CSV locales, sin red. Ninguna trae hooks ni servidores MCP.
- `web-design-guidelines` lee su guía desde `raw.githubusercontent.com/vercel-labs/web-interface-guidelines` al usarse.
- Licencias: MIT salvo `frontend-design` (Apache-2.0). `vercel-labs/agent-skills` no trae archivo LICENSE; su README declara MIT.

**Pendiente:**
- Desinstalar las copias a nivel de usuario (plugins `frontend-design`, `ui-ux-pro-max`, `agent-skills` y `~/.claude/skills` de Vercel y Supabase) para que no salgan repetidas.
- Los ADR de las mejoras 1 y 2 (bitácora 2026-10-28-andamiaje) toman el siguiente número libre: 0004 ya lo usa esta decisión.

## Segunda tanda (mismo día)

**Qué cambió:**
- shadcn/ui permitido como materia prima de las piezas (ADR-0005): genera en `components/shadcn/` y solo lo importa `components/ui/`. `CLAUDE.md` y `docs/PROMPT-INICIAL.md` al día.
- 10 skills más (31 en total): `shadcn`, `ui-styling`, `pwa-expert` y 7 de Addy Osmani que trabajan dentro de `/construir` y `/abrir-pr` (planificar, cortes finos, git, CI, contratos de API, observabilidad y revisión adversarial).
- Se evaluó reemplazar `/construir`, `/decide` y `/abrir-pr` por las equivalentes de afuera y se decidió **no** hacerlo: las de afuera son genéricas (200 a 350 líneas, en inglés) y no conocen las compuertas de Fructus.

**Cómo se verificó:**
- `ui-styling` y `shadcn` traen scripts que corren `npx shadcn` solo cuando se usan; ninguno hace otra cosa por red. `ui-styling` pesa 5.8 MB, casi todo fuentes para lienzos que Fructus no usa.

**Pendiente:**
- Ninguna skill de PWA es buena para Next 16: manda la guía oficial que trae Next. Si hace falta, A11 escribe una skill propia corta.
