---
name: identidad-visual
description: Define la identidad visual de Fructus una sola vez y bien — usa frontend-design y ui-ux-pro-max para proponer 3 direcciones visuales distintas (paleta, tipografía, forma, tono), las construye como maquetas tocables de la pantalla «Hoy» y de la tarjeta de confirmación a 412 px, las verifica contra las reglas del celular (contraste 7:1 al sol, controles de 48 px), espera la elección y escribe lo elegido como tokens en app/globals.css con su ADR. Úsala antes de construir la primera pantalla, o cuando se decida rediseñar la identidad. Después de usarla, las skills de diseño de afuera solo se consultan.
---

Define la identidad visual: $ARGUMENTS

**Por qué existe.** CAYLA Retail aprendió que, si nadie fija la identidad al principio, las skills de diseño eligen una estética distinta
en cada pantalla, y después hay que «unificar» a mano (ADR-0358 allá). Aquí se decide **una vez, mirando**, y desde entonces los tokens mandan.

## Candados

1. **Celular y sol primero.** Toda propuesta se ve y se mide a 412 × 915.
   - Cifras y textos clave con contraste de 7:1 o más.
   - Texto base de 17 px o más.
   - Controles de 48 px o más.
   - El botón de voz de 96 px o más, abajo al centro.

   Una dirección que no cumple no se presenta.
2. **Nada entra al código de la app hasta la elección.** Las maquetas viven en `docs/maquetas/identidad/`.
3. **Nunca se usa `ui-ux-pro-max` con `--persist`** ni se crea `design-system/`. La única fuente final es `app/globals.css`.
4. **Sin marcas ajenas.** La identidad es original: nada que imite la apariencia de otra app ni un logo existente.

## Método

1. **Brief en 6 líneas** a partir de `CLAUDE.md`:
   - quién la usa (el dueño, de pie, al sol, con las manos ocupadas);
   - qué tiene que transmitir (confianza con el dinero, rapidez, cercanía de mercado, orgullo de un negocio propio);
   - qué no puede ser (un formulario gris, una app «bancaria» fría, un carnaval de colores que cansa);
   - el contexto (La Hermelinda, fruta, jabas, Trujillo).
2. **Consultar.**
   - `frontend-design` para la dirección estética.
   - `ui-ux-pro-max` para paletas, pares tipográficos y patrones de UX. Su búsqueda funciona en inglés; nunca lleva datos del cliente.
   - Saca de ahí **3 direcciones claramente distintas**, no tres tonos de lo mismo. Por ejemplo:
     - **A · Mercado fresco:** cálida, con un color fruta de acento.
     - **B · Cuaderno moderno:** sobria, papel y tinta, con cifras protagonistas.
     - **C · Alto contraste al sol:** oscura, con acentos vivos y pensada para leerse a pleno sol.
3. **Por cada dirección:**
   - **paleta** con sus tokens (fondo, superficie, texto, texto suave, acento, éxito, deuda/alerta, borde), con el contraste de cada par **medido**;
   - **tipografía** (una familia de Google Fonts cargable con `next/font`, como mucho dos) y su escala;
   - **radios, sombras, espacio base** y el estilo del botón de voz;
   - **dos pantallas** como HTML autocontenido a 412 px: «Hoy» (resumen del día, botón de voz, última venta) y la **tarjeta de confirmación** de una venta a crédito con precio sugerido;
   - **su versión oscura** de los tokens. No se muestra como pantalla, pero tiene que existir y cumplir el contraste.
4. **Verificar cada maqueta** en el navegador a 412 × 915 y 360 × 800: mide el contraste, el tamaño de los controles y el desborde. Toma capturas.
5. **Presentar** las 3 lado a lado, con capturas, una línea de «qué transmite» y un **Ganas / Pagas** por cada una. Recomienda una con su razón. **Espera la elección**, que puede ser una mezcla.
6. **Fijar lo elegido.**
   - Escribe los tokens en `app/globals.css` (`@theme` de Tailwind 4), con su variante oscura bajo `prefers-color-scheme` y `[data-theme="oscuro"]`.
   - Carga la fuente con `next/font`.
   - Crea las piezas base de `components/ui/` que la identidad define: `Boton`, `Monto`, `Tarjeta`, `Hoja`, `Insignia` y el estilo de `BotonVoz`.
   - Escribe el ADR `docs/adr/NNNN-identidad-visual.md`: qué se eligió, por qué, las capturas de las 3 direcciones y lo que se descartó.
   - Agrega la entrada de bitácora.

Desde aquí, cualquier cambio de color o de pieza pasa por una actualización de ese ADR, no por una pantalla suelta.
