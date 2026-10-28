# ADR-0005 — shadcn/ui como materia prima de las piezas

**Fecha:** 2026-10-28 · **Estado:** aceptado

## Contexto

`CLAUDE.md` prohibía «shadcn copiado en bloque» y pedía Radix solo como primitiva, con todas las piezas escritas a mano. Para una demo de
2 semanas eso obliga a escribir desde cero la hoja, el diálogo, el menú, los campos y sus estados accesibles. shadcn/ui ya resuelve eso
sobre Radix y Tailwind 4, y su código se copia al repo: no es una dependencia que imponga una estética ni que se actualice sola.

El riesgo que la regla vieja evitaba sigue: que cada pantalla use la pieza de shadcn tal cual, con su estética por defecto, y que
aparezcan dos «Confirmar» distintos.

## Decisión

- **Se usa shadcn/ui.** `shadcn add` genera en `components/shadcn/` (alias `ui` de `components.json`).
- **Una pantalla nunca importa de `components/shadcn/`.** Solo lo importan las piezas de Fructus en `components/ui/` (`Boton`, `Hoja`,
  `Campo`…), que fijan tamaño, texto y variantes. Así se mantiene «una función, una pieza».
- **Los tokens mandan.** Las variables de shadcn (`--background`, `--primary`, `--destructive`, `--radius`…) se definen en
  `app/globals.css` apuntando a los tokens de Fructus. Nada de los colores por defecto de shadcn llega a la pantalla.
- **Celular primero se mantiene:** controles de 48 px, hoja que sube desde abajo, contraste 7:1. Si una pieza de shadcn no lo cumple, se
  ajusta en su envoltorio de `components/ui/`.
- Las skills `shadcn` y `ui-styling` vienen en el repo (ADR-0004).

## Alternativas descartadas

- **Seguir solo con Radix y piezas a mano:** más control, pero cuesta días que la demo no tiene.
- **Un kit instalado como dependencia (MUI, Chakra, Mantine):** trae su estética y su peso en JavaScript; choca con el presupuesto de
  120 KB en «Hoy».

## Consecuencias

- Entran dependencias chicas que pide shadcn (`class-variance-authority`, `clsx`, `tailwind-merge` y las de Radix que use cada pieza).
  Se vigila el presupuesto de 120 KB.
- `components/shadcn/` se actualiza con `shadcn add --overwrite` y el diff se revisa: es código nuestro desde que se copia.
