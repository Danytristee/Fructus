# ADR-0007 — Identidad visual «Aurora»

**Fecha:** 2026-10-28 · **Estado:** aceptado

## Contexto

`/identidad-visual` pide elegir la identidad una vez, mirando maquetas tocables a 412 px. Hubo cuatro rondas:

- **v1 y v2:** direcciones «del negocio» (mercado, cuaderno, alto contraste). Quien dirige el proyecto las descartó: se veían feas.
- **v3:** estilos de apps conocidas (claro tipo iPhone, Material de Android, billetera). Las vio correctas, pero planas.
- **v4:** más visuales, con iconos, fruta ilustrada y animación en cada acción: **A · Aurora**, **B · Bento** y **C · Horizonte**.

Las maquetas viven en `docs/maquetas/identidad/`, con sus capturas a 412 y 360 px y sus tokens en `tokens.json`. Las v1 a v3 quedan
en el historial de git.

## Decisión

Se elige **A · Aurora**.

- **Paleta:** fondo `#EEF3F8` con cuatro luces suaves (menta, cielo, durazno, lila), superficies de vidrio esmerilado, texto `#0B1526`
  y acento azul petróleo `#114B5F`. Éxito `#0D5A33` y deuda `#95111F`, cada una con su fondo.
- **Contraste medido** (`tokens.json`): 7:1 o más en texto, cifras, Confirmar, «te deben» e insignias; 4.5:1 o más en lo secundario.
  Cumple en claro y en oscuro.
- **Tipografía:** Manrope (500 a 800) con `next/font`; cifras tabulares con la utilidad `cifra`. Texto base de 17 px, cifras clave de
  30 px y total de 46 px.
- **Forma:**
  - radios de 20 px en controles, 24 px en tarjetas y 28 px en la protagonista y la hoja;
  - botones en píldora;
  - orbe de voz de 104 px con degradado cónico que gira.
- **Movimiento** (cambia la regla de `CLAUDE.md` que decía «sutil, sin rebotes»):
  - **cada acción responde:** el orbe escucha y entiende, la hoja sube con un resorte corto (2–3 % de sobrepaso), sus piezas entran
    en cascada y Confirmar termina en un sello con vibración y sonido;
  - **una sola coreografía de entrada** por pantalla;
  - **las cifras cuentan solo en los resúmenes.** La tarjeta de confirmación muestra el monto exacto desde el primer cuadro: una
    cifra intermedia («S/ 449.07») sería dinero inventado (principio 2);
  - **el fondo de luces está quieto.** El vidrio desenfoca lo que hay detrás, y un fondo en movimiento obliga a recalcular ese
    desenfoque en cada cuadro en un Android de gama media. En las maquetas se movía; en la app, no;
  - se respeta `prefers-reduced-motion`.
- **Fruta ilustrada propia** en `public/frutas/*.svg`: mango, plátano, piña y naranja. Las demás frutas del catálogo se dibujan cuando
  entre su pantalla (A8). Siempre es decorativa: el nombre de la fruta va escrito al lado.
- **Iconos:** lucide-react, con trazo de 2.2.

## Cómo queda en el código

- `app/globals.css` es la única fuente:
  - tokens claros en `:root`, oscuros en `[data-theme="oscuro"]`;
  - las variables de shadcn apuntan a los tokens (ADR-0005);
  - en `@theme` viven los radios, los tamaños de cifra y las curvas y animaciones;
  - las utilidades propias son `vidrio`, `cifra`, `orbe` y `sombra-fruta`.
- **Modo claro por defecto.** El oscuro existe y cumple el contraste, pero solo se activa con `data-theme="oscuro"` en `<html>`; no
  sigue al sistema. Activarlo para todos queda en la fase 2.
- **Piezas en `components/ui/`:** `Boton`, `Monto`, `Tarjeta`, `Insignia`, `Hoja`, `Fruta` y `FondoAurora`. La pieza visual del orbe es
  `components/voz/BotonVoz.tsx`; grabar y enviar el audio llega en A4.
- `/piezas` (solo en desarrollo) muestra todas las piezas en claro y en oscuro, y simula la voz hasta la hoja.

## Alternativas descartadas

- **B · Bento:** la más legible al sol y la más liviana, gracias a sus bloques sólidos de color. Era la recomendación. Se eligió A por
  su aspecto más elegante.
- **C · Horizonte:** la cabecera oscura con degradado es la más «de banco», y competía con el vidrio de A sin aportar algo propio.

## Consecuencias

- **El vidrio cuesta GPU.** Se mide INP en un Android de gama media en A11. Si no llega a 200 ms, el vidrio se vuelve una superficie
  sólida casi blanca: el token `--vidrio` ya existe para eso.
- Cualquier cambio de color, radio, fuente o movimiento pasa por este ADR, no por una pantalla suelta.
