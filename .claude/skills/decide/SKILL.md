---
name: decide
description: Aplica el protocolo de pregunta de Fructus (CLAUDE.md «Protocolo de pregunta») a una decisión abierta puntual — o la decide y la explica en 3 líneas, o la pregunta con hasta 3 opciones comparadas (Ganas/Pagas) y una recomendación.
---

Decisión: $ARGUMENTS

Antes de preguntar, pasa este test y di en una línea si lo pasó o no:
1. ¿La respuesta **no** vive en el repo, el esquema, los ADR (`docs/adr/`), la bitácora (`docs/bitacora/`) ni `docs/interprete-voz.md`?
2. ¿Elegir mal cuesta más que deshacerlo en menos de 30 minutos?
3. ¿Depende de cómo opera el negocio del mayorista, y no de cómo funciona Postgres, Next.js o el LLM?

**Si NO lo pasó:** no preguntes. Decide, ejecuta y explica en 3 líneas (QUÉ HICE / POR QUÉ ASÍ / QUÉ SE ROMPERÍA SIN ESTO) por qué no era
una pregunta para quien dirige el proyecto.

**Si SÍ lo pasó:** máximo 3 opciones. Cada una lleva:
- **Ganas** / **Pagas**;
- un ejemplo real del puesto («don Lucho paga la mitad con Yape y el resto lo debe»), nunca `foo`/`bar`.

Termina con tu recomendación y con «si no respondes, ejecuto [X]».

**Siempre pasan el test, sin excepción:** dinero, precios, stock, permisos y roles, y comprobantes o SUNAT.
