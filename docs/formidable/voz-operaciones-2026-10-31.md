# /formidable · Tarjetas de voz de A6 (abono, merma, gasto, compra) · 2026-10-31

**Para quién:** el dueño o un ayudante, de pie en el puesto, con el celular en una mano. **Finalidad:** confirmar lo que se dictó en
menos de 5 segundos y con un toque (CLAUDE.md, «La voz»). **Rama:** `claude/voz-operaciones`.

## 1. Medido (412 × 915, 360 × 800 y 1280 × 800)

| | Abono | Merma | Gasto | Compra |
|---|---|---|---|---|
| Controles menores de 48 px | 0 | 0 | 0 | 0 |
| Textos bajo 7:1 de contraste | 0 | 0 | 0 | 0 |
| Textos bajo 17 px | 0 | 0 | 0 | «sugerido» (15 px) |
| Desborde horizontal | no | no | no | no |
| Confirmar, desde arriba (412 / 360) | 86 % / 84 % | 86 % / 84 % | 86 % / 84 % | 86 % / 84 % |
| Alto de Confirmar | 68 px | 68 px | 68 px | 68 px |

- JavaScript de «Hoy»: 177.4 KB brotli, con tope de 180 (las tarjetas cargan en la hoja diferida).
- Las 4 confirman con la misma pieza (`useConfirmar`, `PieConfirmar`, `Guardado`): un solo «Confirmar» en toda la app.
- Capturas «antes» en `docs/formidable/capturas/voz-<tarjeta>-antes-{412,360}.png`.

## 2. Prueba ciega (Observado)

Un agente sin contexto recibió solo las capturas a 412 px y una tarea por tarjeta.

| Tarjeta | Lo resolvió | Tiempo para entenderla | Dónde dudó |
|---|---|---|---|
| Abono | sí: tocó el monto, después Yape, después Confirmar | menos de 5 s | «Efectivo» ya marcado: ¿lo dije yo? |
| Merma | sí: solo Confirmar; leyó «te quedan 10 cajas» | menos de 5 s | «se pasó» entre comillas, sin «dijiste»: ¿lo dije o es el motivo? |
| Gasto | sí: Flete y Confirmar | 5 a 15 s | «Personal» tiene dos lecturas; «cargador» entre comillas sin «dijiste» |
| Compra | sí: La debo y Confirmar | 5 a 15 s | «Primero: ¿la pagaste?» no parece ni botón ni aviso |

Las 3 cosas que más lo confundieron:
1. Opciones ya marcadas sin saber si las dijo («Efectivo», «Personal»).
2. El botón gris «Primero: ¿la pagaste?».
3. Palabras entre comillas sin «dijiste» («se pasó», «cargador»).

El círculo negro con «N» es el indicador de Next en desarrollo: en producción no está.

## 3. Calificación

| Ley o regla | Nota | Por qué |
|---|---|---|
| 1 · Sin manual | 8 | Las 4 se resolvieron a la primera; gasto y compra tardaron de 5 a 15 s. |
| 2 · Una pregunta, una respuesta | 9 | Un protagonista por tarjeta (el monto, la fruta) y un solo Confirmar. |
| 3 · Simplicidad profunda | 9 | Veredictos: «te debe S/ 1,050», «te quedan 10 cajas», «le quedan S/ 70 a favor». |
| 4 · Lenguaje de puesto | 8 | «Personal» es ambiguo; «Primero: ¿la pagaste?» perdió «o la debes». |
| 5 · Contenido primero | 9 | El dinero y la fruta pesan más que los marcos. |
| 6 · Lo difícil, a un toque | 9 | Todo dato se corrige con un toque. |
| 7 · Perdonar antes que preguntar | 9 | Descartar ofrece Deshacer; solo se confirma lo que guarda. |
| 8 · Quitar antes de agregar | 8.5 | Nada sobra; las comillas sin «dijiste» confunden más de lo que ayudan. |
| 9 · De punta a punta | 8.5 | Falta, error, sin sesión y 360 px cubiertos; a 1280 queda la línea fina bajo «Descartar» (ya anotada el 29). |
| C1 · Pulgar | 10 | Confirmar al 84–86 %. |
| C2 · Tamaño | 10 | Nada bajo 48 px. |
| C3 · Sol | 9 | Todo sobre 7:1; «sugerido» a 15 px (decisión de identidad pendiente). |
| C4 · Bordes | 10 | Sin desborde; el pie respeta `safe-area`. |
| C5 · Hojas | 10 | Todo en `<Hoja>`. |
| C7 · Señal | 10 | Avisos con icono y texto, no solo color; vibración y sonido al confirmar. |
| C8 · Velocidad | 9 | 177.4 de 180 KB: queda poco margen. |
| Oficio visual | 8.5 | Grilla de 4, una familia, cifras tabulares; la «P» morada de Papaya se lee como una persona. |
| **Total** | **8.8** | |

## 4. Los 3 cambios de mayor impacto (esperan OK)

1. **«dijiste …» delante de las palabras de la persona** en merma y gasto: «se pasó» → «dijiste «se pasó»», como ya hace el cliente.
   Arregla la ley 1 y la 8. Se verifica con el e2e y con la misma prueba ciega.
2. **El botón de la compra vuelve a nombrar las dos opciones**: «Primero: ¿la pagaste?» → «Primero: ¿pagaste o debes?», aunque a
   360 px ocupe dos líneas. Arregla la ley 1 y la 4. Se verifica con la captura a 412 y 360 px y con la prueba ciega.
3. **«Personal» → «Ayudantes»** en las categorías del gasto (solo la etiqueta; la base sigue guardando `personal`). Arregla la ley 4.
   Se verifica con el e2e del gasto.

- **Lo que sobra (ley 8):** nada que quitar; las comillas sin «dijiste» son el único ruido.
- **Lo que nadie pidió y más importa:** el medio de pago viene marcado aunque no se haya dicho («Efectivo»). Es la regla 4 del prompt
  («si dijo que pagó pero no cómo, efectivo»). Cambiarla (preguntar con qué pagó, como «¿Pagó o lo debe?») toca el intérprete y pide
  `/voz-precision`: es una decisión de quien dirige el proyecto, no un ajuste visual.

## Lista aparte (sin ejecutar)

- La «P» morada de Papaya (letra de respaldo de `IconoFruta`) se lee como el avatar de una persona: faltan íconos de fruta.
- «sugerido» a 15 px (identidad).
- La línea fina bajo «Descartar» a 1280 px (`PieConfirmar`, ya anotada en `voz-venta-2026-10-29.md`).

## 5. Aplicado con OK (31-10)

| Cambio | Antes → después | Verificado |
|---|---|---|
| «dijiste …» en merma y gasto | «se pasó» → dijiste «se pasó»; «cargador» → dijiste «cargador» | e2e de merma y gasto; capturas `voz-{merma,gasto}-despues-{412,360}.png` |
| Botón pendiente de la compra | «Primero: ¿la pagaste?» → «Primero: ¿pagaste o debes?» | e2e de compra; 68 px de alto a 412 (una línea) y 82 px a 360 (dos líneas, como se acordó) |
| Categoría del gasto | «Personal» → «Ayudantes» (la base sigue guardando `personal`) | e2e de gasto; cabe a 360 px |

Notas nuevas: ley 1 · 8 → 8.5, ley 4 · 8 → 9, ley 8 · 8.5 → 9. **Total 8.8 → 9.0.** Queda sin tocar, por decisión: el medio de pago
marcado por defecto (regla 4 del prompt).
