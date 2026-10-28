# Skills de terceros en `.claude/skills/`

Estas 31 skills vienen de afuera y viajan con el repo (ADR-0004). **Se consultan, no mandan:** si una choca con `CLAUDE.md`, un ADR o
`app/globals.css`, gana el proyecto. No se editan a mano: se actualizan desde su origen y el cambio se revisa como cualquier otro diff.

- **Actualizar:** `npx skills update -p` (lee `skills-lock.json`). Revisa el diff antes de commitear.
- **Reinstalar en una máquina nueva:** no hace falta, ya están en el repo.
- **Agregar una:** `npx skills add <owner/repo> -a claude-code --copy -y -s <skill>`, su licencia en `licencias/` y una fila aquí.

| Skill | Para qué en Fructus | Origen (commit) | Licencia |
|---|---|---|---|
| `frontend-design` | Dirección estética; base de `/identidad-visual` | anthropics/skills (`dbd4588`) | Apache-2.0 |
| `ui-ux-pro-max` | Paletas, tipografías y criterios de UX. **Nunca con `--persist`** | nextlevelbuilder/ui-ux-pro-max-skill (`28b3b8d`) | MIT |
| `shadcn` | Agregar y adaptar piezas de shadcn/ui (ADR-0005) | shadcn-ui/ui (`96da9cc`) | MIT |
| `ui-styling` | Tailwind + shadcn: tema, modo oscuro, piezas accesibles | nextlevelbuilder/ui-ux-pro-max-skill (`28b3b8d`) | MIT |
| `emil-design-eng` | Pulido de piezas y decisiones de movimiento | emilkowalski/skills (`2d22863`) | MIT |
| `animate` | Elegir curva y duración, o decidir no animar | emilkowalski/skills (`2d22863`) | MIT |
| `review-animations` | Revisión de movimiento (solo a pedido: `/review-animations`) | emilkowalski/skills (`2d22863`) | MIT |
| `animation-performance` | Animaciones sin tirones en Android de gama media | emilkowalski/skills (`2d22863`) | MIT |
| `accessibility` | WCAG: contraste, foco, lector de pantalla | addyosmani/web-quality-skills (`afa8da9`) | MIT |
| `core-web-vitals` | LCP e INP del presupuesto de velocidad | addyosmani/web-quality-skills (`afa8da9`) | MIT |
| `web-design-guidelines` | Auditar una pantalla contra las guías de Vercel (lee la guía en línea al usarse) | vercel-labs/agent-skills (`1a2c79d`) | MIT |
| `vercel-react-best-practices` | Rendimiento de React y Next.js | vercel-labs/agent-skills (`1a2c79d`) | MIT |
| `vercel-composition-patterns` | Piezas de `components/ui/` que no se llenan de props | vercel-labs/agent-skills (`1a2c79d`) | MIT |
| `supabase` | `@supabase/ssr`, Auth, RLS, CLI | supabase/agent-skills (`c9be0e9`) | MIT |
| `supabase-postgres-best-practices` | Migraciones, políticas, índices y funciones | supabase/agent-skills (`c9be0e9`) | MIT |
| `test-driven-development` | Rojo → verde para `lib/*-reglas.ts` | addyosmani/agent-skills (`aeac41d`) | MIT |
| `debugging-and-error-recovery` | Causa raíz (principio 12) | addyosmani/agent-skills (`aeac41d`) | MIT |
| `security-and-hardening` | Claves, entradas y RLS | addyosmani/agent-skills (`aeac41d`) | MIT |
| `frontend-ui-engineering` | Interfaz accesible y con todos sus estados | addyosmani/agent-skills (`aeac41d`) | MIT |
| `source-driven-development` | «No adivines APIs»: Next 16, Groq, Lucode | addyosmani/agent-skills (`aeac41d`) | MIT |
| `code-review-and-quality` | Revisión antes de abrir el PR | addyosmani/agent-skills (`aeac41d`) | MIT |
| `performance-optimization` | Presupuesto de 120 KB y tarjeta en 2.5 s | addyosmani/agent-skills (`aeac41d`) | MIT |
| `pwa-expert` | Caché, actualización del service worker, envío en segundo plano. Para Next.js manda la guía oficial | curiositech/some_claude_skills (`f498252`) | MIT |
| `planning-and-task-breakdown` | Cortar actividades con criterios de aceptación (dentro de `/construir`) | addyosmani/agent-skills (`aeac41d`) | MIT |
| `incremental-implementation` | Cortes finos y verificables (dentro de `/construir`) | addyosmani/agent-skills (`aeac41d`) | MIT |
| `git-workflow-and-versioning` | Commits atómicos, ramas y conflictos (dentro de `/abrir-pr`) | addyosmani/agent-skills (`aeac41d`) | MIT |
| `ci-cd-and-automation` | El CI de dos trabajos | addyosmani/agent-skills (`aeac41d`) | MIT |
| `api-and-interface-design` | Contratos de `/api/voz` y de las RPC | addyosmani/agent-skills (`aeac41d`) | MIT |
| `observability-and-instrumentation` | Logs con ids y `comandos_voz.latencia_ms` | addyosmani/agent-skills (`aeac41d`) | MIT |
| `doubt-driven-development` | Revisión adversarial de reglas de dinero, stock y comprobantes | addyosmani/agent-skills (`aeac41d`) | MIT |
| `verification-before-completion` | Evidencia antes de decir «listo» | obra/superpowers (`2ce8aa1`) | MIT |

Los textos de licencia están en [`licencias/`](licencias/).

## Revisadas y no traídas

- **Playwright CLI (Microsoft), `webapp-testing` (Anthropic):** ya hay Playwright en el proyecto y el navegador de Claude.
- **`vercel-labs/next-skills`:** no tiene skills válidas; Next 16 trae su documentación en `node_modules/next/dist/docs/` (`AGENTS.md`).
- **PWA:** `croakingtoad/pwa-development` mezcla contenido de repos sin licencia; `progressive-web-app` (secondsky) es corta y propone caché primero para todo, peligroso con datos de dinero; `mobile-offline-support` es para React Native; las `nextjs-pwa` de skills.sh no tienen repo público verificable.
- **`brainstorming`, `writing-plans`, `executing-plans`, `finishing-a-development-branch` (superpowers):** se pisan con `/construir` y `/abrir-pr`, y `brainstorming` se impone en toda tarea creativa.
- **`spec-driven-development`, `shipping-and-launch`, `context-engineering`, `interview-me` y el resto de Addy Osmani:** el encargo ya está especificado en `docs/PROMPT-INICIAL.md`, y la salida a producción es de la fase 2.
