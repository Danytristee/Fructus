# /formidable · Proveedores, ficha del proveedor, hoja de pago y hoja de proveedor · 2026-11-12

**Para quién:** el dueño, en el celular, cuando va a negociar o a pagar a un proveedor. El administrador y el contador la leen en escritorio.
**Para qué:** contestar «¿de quién dependo y qué le puedo pedir?» y anotar lo que le pagas (ADR-0017).

## 1. Medido (412 × 915, 360 × 800, 1280 × 800, base local con `catalogo-real` + `proveedores-demo`)

| Qué | Lista | Ficha | Hoja de pago | Hoja de proveedor |
|---|---|---|---|---|
| Controles menores de 48 px | 0 | 0 | 0 | 0 |
| Desborde horizontal (412 / 360 / 1280) | 0 / 0 / 0 | 0 / 0 / — | 0 / — / — | — / 0 / — |
| Acción principal en el tercio de abajo | — (lectura) | «Registrar pago», y = 763 de 915 | «Confirmar pago», y = 783 de 915 | «Guardar proveedor», y = 668 de 800 |
| Contraste bajo 7:1 | Insignias «Ocasional» y «Se enfrió» a 15 px: 6.4:1 | Etiquetas de las cifras («De tus compras», «Le debes»): 6.4:1 | «Hoy le debes»: 6.4:1 | ninguno |
| Fuentes | Manrope | Manrope | Manrope | Manrope |
| Servidor (dev, segunda carga) | 118 ms | 247 ms | — | — |

- El 6.4:1 es el mismo de las etiquetas de la ficha del cliente: pasa el 4.5:1 que se pide para textos secundarios. Las cifras están por
  encima de 7:1.
- **Observado:** «Registrar pago» flota encima de la fila de cifras de la ficha y tapa «De tus compras» y «Le compras». Hay que
  deslizar para leerlas.

## 2. Prueba ciega (1 agente, solo las capturas a 412 px)

- **A. De quién dependes y cuánto debes:** lo contestó sin dudar con el 63 % y «Les debes S/ 35,972.00».
- **B. A quién pedir mejor precio:** lo encontró **dentro de la ficha**, no en la lista. Tocó «Para negociar (5)» sin saber qué
  significaba.
- **C. Pagar S/ 500 por Yape:** lo resolvió en 5 toques.
  - Dudó porque la captura venía con el monto completo y «Transf.» ya elegidos. Eso lo puso el guion de la captura, no la app, que
    abre vacía; no cuenta como hallazgo.
  - Dijo que el botón flotante «tapa cifras».
- **D. Qué hacer con el proveedor:** leyó bien el veredicto, «Dependes de él (único que trae kiwi)», y el ahorro.
- **E. Lo que confunde:**
  - el filtro «Para negociar» y el número que lo acompaña;
  - «Dependes» como filtro y también como insignia;
  - la barra de colores sin leyenda para el gris;
  - nombres cortados en la leyenda («Importadora Frutícola d…»);
  - «cal. 113»;
  - «Al crédito», «Compra» y «Pagaste» en el historial.
- **F. Lo que buscó y no encontró:**
  - **cuánto le debe a cada uno** desde la lista (solo vio el total);
  - **cuánto le debe a este proveedor, arriba y en grande** en la ficha;
  - los días de crédito (están escondidos en Notas);
  - el precio de cada fruta lado a lado entre proveedores.

## 3. Notas

| Ley o regla | Nota | Por qué |
|---|---|---|
| 1 Sin manual | 8 | Contestó A, C y D sin dudar. B lo encontró solo dentro de la ficha. |
| 2 Una pregunta | 8 | La lista tiene un protagonista claro. En la ficha, el veredicto y las cinco razones compiten con la deuda. |
| 3 Simplicidad profunda | 8 | El veredicto sale traducido. En la lista falta el porqué de cada fila y la deuda de cada uno. |
| 4 Lenguaje de puesto | 8 | «Para negociar», «cal.» y «Pagaste» frente a «Al crédito». |
| 5 Contenido primero | 8 | |
| 6 Lo difícil a un toque | 7 | Las cinco razones están todas a la vista: el «¿por qué?» no está detrás de un toque. |
| 7 Perdonar | 9 | Pago y alta piden confirmar, que es lo correcto en dinero. Descartar no deja nada guardado. |
| 8 Quitar | 7 | La tarjeta de la ficha mide unos 400 px. |
| 9 De punta a punta | 9 | Tienen vacío, error, primer uso (proveedor sin compras) y 360 px. |
| C1 a C8 | 9 | Pasa todo, menos el botón flotante que tapa las cifras de la ficha (C1 y oficio). |
| Oficio visual | 8 | |
| **Total** | **8.2** | |

## 4. Los 3 cambios de mayor impacto (esperan el OK)

1. **Ficha: la deuda y las cifras arriba, y como máximo 3 razones**
   - Antes: el veredicto, cinco razones y, debajo y tapadas por el botón flotante, las cifras con «Le debes».
   - Después:
     - en la tarjeta, el veredicto y debajo «Le debes S/ 28,823» en grande;
     - luego la fila «63 % de tus compras · cada 3 días»;
     - luego las 2 o 3 razones más fuertes;
     - el resto, detrás de «Ver 2 razones más».
   - Arregla las leyes 2, 6 y 8 y la regla C1.
   - Se verifica a 412 px con la fila de cifras visible sin deslizar y sin nada debajo del botón.
2. **Lista: cada fila dice su porqué y los filtros hablan como la insignia**
   - Antes: solo la insignia («Pide mejor precio»), y los filtros «Para negociar» y «Dependes».
   - Después:
     - debajo de la insignia, una línea con la razón más fuerte de esa fila («Andina te deja la manzana S/ 26 menos», «Solo él te trae
       kiwi», «Le compras cada 4 días»);
     - los filtros se llaman «Pide rebaja», «Dependes de él» y «Les debes».
   - Arregla las leyes 1 y 3.
   - Se verifica repitiendo la tarea B a ciegas: debe resolverse desde la lista.
3. **«Les debes» con veredicto y leyenda completa en la barra**
   - Antes: «S/ 35,972 a 3 proveedores», y la barra con su gris sin nombre y los nombres cortados.
   - Después:
     - «Les debes S/ 35,972: más que a nadie, al Pacífico (S/ 28,823)»;
     - la leyenda suma «Otros» con su gris;
     - los nombres van en dos líneas en vez de cortarse.
   - Arregla las leyes 3 y 1.
   - Se verifica a 360 px sin «…» en la leyenda.

**Lo que sobra (ley 8):** «De quién dependes · últimos 90 días» repite la pregunta que el 63 % ya contesta. Basta con «Últimos 90 días».

**Lo que nadie pidió y más importa:** los días de crédito de cada proveedor («Da crédito a 15 días») están escondidos en Notas. Con un
campo propio, la ficha podría decir «el pago vence el jueves». Eso cambia una regla de dinero: va aparte y con OK.

**Aparte, sin ejecutar:**
- precios de una fruta lado a lado entre todos los proveedores (una vista por fruta);
- botón de pago desde la lista;
- «Compra fiada» en vez de «Al crédito» en el historial;
- el contraste de 6.4:1 de las insignias grises (es la misma pieza de «Anulada»: se cambia en `Insignia` para toda la app).
