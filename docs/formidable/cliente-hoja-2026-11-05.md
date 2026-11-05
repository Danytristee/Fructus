# /formidable rápido · Hoja «Nuevo cliente» / «Editar cliente» (A8) · 2026-11-05

**Para quién:** el dueño y el administrador, en el celular o en el escritorio. **Finalidad:** dar de alta a un cliente nuevo con su apodo
(como lo dicta) en menos de un minuto, y corregir sus datos. **Rama:** `claude/cuaderno-stock-ventas`.

Pasada **rápida** (solo mide, como pide `/formidable rapido`): sin prueba ciega ni nota. Las capturas están en
`docs/formidable/capturas/cliente-hoja-{vacia,llena}-{412,360,1280}.png`.

## 1. Medido (412 × 915, 360 × 800 y 1280 × 800)

La hoja vacía, y llena con un parecido, un apodo, un teléfono y un RUC mal escrito (la peor altura).

| | 412 | 360 | 1280 |
|---|---|---|---|
| Controles menores de 48 px | 0 | 0 | 0 |
| Separación menor de 8 px entre controles | 0 | 0 | 0 |
| Desborde horizontal | 0 | 0 | 0 |
| Textos bajo 17 px | 0 | 0 | 0 |
| Fuentes | solo Manrope | solo Manrope | solo Manrope |
| «Guardar cliente» desde arriba (vacía / llena) | 89 % / 89 % | 88 % / 88 % | 81 % / **111 %** |

- A 412 y 360 px, «Guardar cliente» queda a la vista siempre: el pie está pegado abajo y el formulario se desliza detrás.
- **A 1280 px, con el formulario largo, «Guardar» queda fuera de la vista** (111 %): a partir de 768 px el pie de la hoja deja de estar
  pegado (`md:static` en `PieConfirmar`) y se desliza con el contenido. Es la misma causa que el hallazgo de la pantalla girada de
  `/chaos` (915 × 412 también pasa de 768 px).
- Teclado: sin medir (la emulación no abre teclado).

## 2. Observado en las capturas (sin agente)

- **«Sin documento» se parte en dos líneas** a 412 px y a 360 px casi toca los bordes del botón; los otros dos («DNI», «RUC») caben de sobra.
- El aviso de parecidos («Ya tienes a Luis Paredes («don lucho»). ¿Es el mismo?») se lee de una vez y «Ver ficha» queda al alcance del pulgar.
- El error de un campo sale rojo junto al campo, y lo que falta para guardar sale abajo en texto normal.

## 3. Cambios propuestos (esperan OK)

1. **«Sin documento» → «Ninguno»** en el selector de documento: cabe en una línea a 360 px. Arregla la ley 4 (frases cortas) y el apretón.
2. **El pie de la hoja pegado también desde 768 px:** quitar `md:static` de `PieConfirmar`. Con eso «Guardar» y «Confirmar» quedan
   a la vista en el escritorio y con el celular de lado. Resuelve también el hallazgo 3 de `chaos/abono-a-mano-2026-11-05.md`. Es visual y
   alcanza a las siete hojas; en las cortas no cambia nada (pegado solo se nota si el contenido no cabe).

Sin nota hasta una pasada completa de la pantalla Clientes (alta, ficha y abono juntos) al cerrar A8.

## 4. Aplicado con OK (5-11)

| Cambio | Antes → después | Verificado |
|---|---|---|
| «Sin documento» → «Ninguno» | La opción se partía en dos líneas a 412 px y casi tocaba los bordes a 360 px → una línea | e2e (la prueba de documento usa «Ninguno») |
| El pie de la hoja pegado desde 768 px | A 1280 px, con el formulario largo, «Guardar cliente» quedaba al 111 % desde arriba (fuera de la vista); con el celular de lado (915 × 412) también → «Guardar» y «Confirmar» a la vista, sin deslizar | e2e a 1280 × 800 y a 915 × 412, en esta hoja y en la de abono (fallaron antes del cambio). Afecta a las siete hojas: en las cortas no cambia nada |

Sin nota: esta fue una pasada rápida. La pantalla Clientes completa (ficha, alta y abono) pasó `/formidable` con la ficha y el abono (8.5 → 8.9).
