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
