# ADR-0004 — Las skills de afuera viajan con el repo

**Fecha:** 2026-10-28 · **Estado:** aceptado

## Contexto

`CLAUDE.md` pedía que cada persona instalara por su cuenta las skills de afuera (frontend-design, ui-ux-pro-max, las de Vercel, Supabase y
Addy Osmani). En la práctica no estaban: al empezar A1 la sesión no tenía ni `frontend-design` ni `ui-ux-pro-max`, y `/identidad-visual`
las necesita. Además, cada máquina terminaba con versiones distintas, y nadie sabía cuál se había usado para decidir algo.

## Decisión

- **21 skills de terceros se copian a `.claude/skills/`** con `npx skills add … --copy`, y su origen queda fijado en `skills-lock.json`.
  La lista, el para qué y el commit de origen están en `docs/terceros/README.md`; las licencias, en `docs/terceros/licencias/`.
- **Solo entran skills con licencia permisiva (MIT o Apache-2.0)** y que sirvan a este stack. Las que se pisan con las skills del proyecto
  o empujan algo que `CLAUDE.md` prohíbe (kits visuales completos) se quedan afuera.
- **No se editan a mano.** Se actualizan con `npx skills update -p` y el diff se revisa como cualquier otro.
- **Siguen consultándose, no mandando.** El orden de autoridad no cambia: `CLAUDE.md` → ADR → `app/globals.css` → skills del proyecto →
  skills de terceros. `ui-ux-pro-max` nunca se corre con `--persist`.

## Alternativas descartadas

- **Seguir con instalación por persona:** es lo que falló.
- **Plugins declarados en `.claude/settings.json` del proyecto:** cargan solo en Claude Code y dependen de que cada máquina pueda clonar
  cada marketplace (`addyosmani/agent-skills` falló por SSH). Copiadas, funcionan sin red.

## Consecuencias

- El repo pesa unos 4.6 MB más; casi todo es la base de datos de `ui-ux-pro-max`.
- Cada sesión carga la descripción de 28 skills. Si alguna no se usa en un mes, se saca.
- Quien instaló las mismas skills a nivel de usuario las ve repetidas: conviene desinstalar las de usuario.
