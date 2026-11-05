# /formidable · Stock y Ventas (A8) · 2026-11-05

**Para quién:** el dueño y el ayudante, en el celular, de pie y al sol. El administrador y el contador la miran en escritorio.
**Finalidad** (`docs/PROMPT-INICIAL.md`, A8): *Stock:* cajas por fruta, con aviso de «quedan pocas», y mermas y compras a mano. *Ventas:* historial del día
y de la semana, el detalle de cada venta y anular (solo dueño o administrador, con motivo). **Rama:** `claude/cuaderno-stock-ventas`.

Pasada **completa**: medición a 412, 360 y 1280 px, prueba ciega por pantalla, y un escéptico que intentó refutar cada hallazgo (3 agentes).
Capturas «antes» en `docs/formidable/capturas/stock-ventas-*-antes-{412,360,1280}.png`.

**Aviso sobre los datos:** la base local está llena de ventas y frutas inventadas por las pruebas automáticas (175 ventas hoy, «0 de 7 frutas están
bien», «Dueño de prueba»). Eso hace que algunas cifras se vean raras; no se cuentan como hallazgos. La bolita «N» de abajo a la izquierda es del
modo desarrollo de Next.

## 1. Medido (Medido)

Seis escenas por ancho: Stock, una fruta abierta, hoja de merma, hoja de compra, Ventas «Hoy» y «7 días», hoja de la venta y hoja de anular.

| | 412 | 360 | 1280 |
|---|---|---|---|
| Controles menores de 48 px | 0 | 0 | 0 |
| Desborde horizontal | 0 | 0 | 0 |
| Fuentes | solo Manrope | solo Manrope | solo Manrope |
| Cifras de dinero sin `tabular-nums` | 0 | 0 | 0 |
| Contraste menor de 4.5:1 | 0 | 0 | 0 |
| Cifras o textos clave entre 4.5 y 7:1 | 1–2 (el número dentro de un filtro: 14 px, 5.5:1) | igual | igual |
| Textos bajo 17 px, Stock / Ventas | 55 / 214 | 55 / 214 | 55 / 214 |
| Textos bajo 17 px, hojas (merma, compra, anular) | 0 | 0 | 0 |
| Botón flotante «Compra» / «Merma» desde arriba | 86 % (alto 56 px) | 85 % | 85 % |
| «Anular la venta» desde arriba | 89 % (alto 68 px) | 88 % | 84 % |

- **Textos bajo 17 px:** son las insignias «Lo debe» (148), «Anulada» (30) y «Pagó» (27) a 15 px, las etiquetas de la fruta abierta («Alcanza para», «Vendes al día»…) a 15 px, los
  números dentro de los filtros a 14 px y la barra de abajo a 13 px. Son piezas existentes y ya anotadas en los informes de «Hoy» y de la ficha; no son nuevas de A8.
- **Separación menor de 8 px:** las cuatro entradas de la barra de abajo (0 px, pieza existente) y las filas de la lista de ventas (1 px, el divisor): es una lista, no
  controles sueltos. Con una fruta abierta, «Se malogró» queda a 1 px de las píldoras flotantes solo porque la captura la pilla debajo de la barra.
- **Colores fuera de tokens:** las iniciales de clientes y de frutas («BS», «RM», «P», «L») usan un color calculado por nombre. No son colores sueltos de un componente.
- **No medido en esta pasada:** el peso de JavaScript de Stock y Ventas (el de «Hoy» quedó en 177.0 KB al cerrar A8), el teclado, y los estados vacío, de error y de carga.

## 2. Prueba ciega (Observado)

Un agente sin contexto recibió solo las capturas a 412 px y una tarea por pantalla. Nota de comprensión: **Stock 7/10**, **Ventas 7/10**.

**Stock** (lo logró todo, con dudas):
- No supo de qué era el «0%» del anillo («no sé si es bueno o malo; me asusta, pero no sé qué hacer»).
- «Sobrestock» le sonó a jerga («lo deduzco por *te sobra*»); dudó si el «5» eran cajas o frutas.
- Vio **dos botones para lo mismo**: «Merma» abajo y «Se malogró» dentro de la fruta. «Yo diría *se malogró*.»
- Las píldoras flotantes le taparon el texto del aviso de Mango Edward y la fila siguiente: «no logro leer cuántas cajas tiene».
- No vio dónde se ponen las cajas y el precio en las hojas de merma y de compra hasta elegir la fruta (lo dedujo por «Falta elegir…»).

**Ventas** (entendió qué es, cuánto vendió y cómo anular y arrepentirse):
- Para saber **cuánto fió** en 7 días tuvo que leer una frase gris y chica; «casi leí mal el número grande, que es el total».
- «Al crédito» quedó cortado en el borde («Al crédit»): no supo si había más filtros.
- En el detalle de la venta: «no veo cómo cerrar sin anular» (no hay X ni «Cerrar»).
- Al anular, entendió la fruta y la baja del total; no vio qué pasa con la plata que ya le pagaron en efectivo.
- Los motivos son píldoras sin marca: pensó que tocar uno ya anulaba. Lo corrigió con «Elige por qué la anulas.» y el botón apagado.

## 3. Escéptico (intentó refutar cada hallazgo)

Ninguno quedó refutado. **Confirmados:** filtros que se esconden, anillo «0%» sin decir de qué es, «cuánto fiaste» en letra chica, hoja de detalle sin cerrar, y la cabecera de «Hoy» que repite el total.
**Matizados:** la jerga (solo «Sobrestock» es anglicismo; «Reponer» y «Sin movimiento» se entienden), los dos nombres de la merma (ambas palabras están permitidas en CLAUDE.md y la misma hoja
ya mezcla «merma» y «se malogró») y las píldoras flotantes (es el patrón elegido a propósito).

Dos precisiones que cambian la propuesta (las comprobé yo en el código):
- **La hoja no se cierra deslizando.** `components/ui/Hoja.tsx:21` apaga el botón de cerrar (`showCloseButton={false}`), el agarrador de arriba es solo decoración (`aria-hidden`) y no hay ningún gesto de
  deslizar fuera del botón de voz. Se cierra tocando el velo de afuera; en el celular no existe Escape. Los comentarios de `HojaVenta.tsx` y `HojaCliente.tsx` dan por hecho un gesto que no está.
- **Las etiquetas cortas no bastan para los filtros.** «Todas 175 · Contado 27 · Crédito 148» miden unos 430 px y hay 380 a 412 px y 328 a 360 px. `Filtros` se usa en cuatro sitios (`ListaClientes`, `TableroStock` y dos veces en `HistorialVentas`).

## 4. Notas

| Ley | Nota | Por qué |
|---|---|---|
| 1. Sin manual | 7 | Se entiende qué es y cuánto hay; el «0%» no se explica y la hoja de detalle no dice cómo cerrarse. |
| 2. Una pregunta, una respuesta | 8 | Protagonista claro (326 cajas; el total vendido). En Stock hay anillo, tres mosaicos y alertas compitiendo. |
| 3. Simplicidad profunda | 7 | Los avisos de Stock son veredictos («Se acabó Mango Kent… compra unas 215 cajas»). «Cuánto fiaste» sigue siendo una cuenta que hace la persona. |
| 4. Lenguaje de puesto | 7 | «Sobrestock», dos nombres para la merma. |
| 5. Contenido primero | 8 | La fruta, el cliente y el dinero mandan. |
| 6. Lo difícil, a un toque | 8 | «Anular» dice qué va a pasar y pide el motivo en un paso. |
| 7. Perdonar antes que preguntar | 8 | Anular tiene dos salidas claras; no hay «Deshacer» (correcto: es dinero y stock). |
| 8. Quitar antes de agregar | 7 | El total se repite en la cabecera de «Hoy»; dos caminos para la merma; un agarrador que promete un gesto que no existe. |
| 9. De punta a punta | 6 | Filtros cortados a 360 px, hoja sin cierre, píldoras que tapan el primer aviso; estados vacío/error/carga sin recorrer. |

| Regla del celular | Nota | Por qué |
|---|---|---|
| C1 · Pulgar | 9 | Flotante al 85–86 %, «Anular la venta» al 88–89 %. Falta un «Cerrar» en la hoja de detalle. |
| C2 · Tamaño | 9 | Ningún control menor de 48 px; la barra de abajo está pegada (pieza existente). |
| C3 · Sol | 7 | Contraste sin fallas, pero 55 y 214 textos de 15 px o menos, y el filtro a 14 px y 5.5:1. |
| C4 · Bordes | 7 | Sin desborde de página, pero filtros cortados y píldoras tapando contenido. |
| C5 · Hojas | 7 | Todo es `<Hoja>`, pero la de detalle no tiene cómo cerrarse a la vista. |
| C6 · Navegación | 9 | Cuatro destinos. |
| C7 · Señal | 8 | El color no es la única señal (icono y texto en cada insignia). Vibración y sonido: sin probar aquí. |
| C8 · Velocidad | 8 | La hoja de detalle llega en diferido; sin medir de nuevo. |
| Oficio visual | 8 | Una sola familia y cifras tabulares; la cabecera de «Hoy» repite el total. |

**Nota total: 7.4 / 10.** Es una pantalla que funciona y se entiende; lo que la baja es que lo que más le importa a un puesto que fía («cuánto fié») está en letra chica, y que la hoja de detalle no se cierra.

## 5. Los 3 cambios de mayor impacto (esperan OK)

**1. Ventas se lee y se alcanza: los filtros no se esconden y «cuánto fiaste» se ve en grande.** (leyes 3 y 5, C4)
- *Antes:* «Al crédito» queda cortado a 412 y casi invisible a 360; contado y crédito van en una frase gris de 15–17 px bajo el total.
- *Después:* las píldoras de `Filtros` pasan a partirse en otra fila cuando no caben (sin scroll horizontal), con etiquetas cortas en Ventas («Todas», «Contado», «Crédito»); y bajo el total, contado y crédito
  en negrita, como ya los muestra «Hoy» (`ResumenDia`), con `formatearSoles` y `cifra`. El texto de la frase no cambia.
- *Verifica:* e2e a 412, 360 y 1280 px (ninguna píldora cortada; la prueba de `ventas-detalle.spec.ts` sigue pasando) y la captura antes/después. Alcanza a las cuatro pantallas que usan `Filtros`.

**2. La hoja del detalle de una venta tiene un botón «Cerrar».** (ley 1, C1, C5)
- *Antes:* para el ayudante y el contador no hay ningún botón; para el dueño, solo «Anular». Se cierra tocando afuera y nada más.
- *Después:* un botón «Cerrar» de 48 px o más, en el tercio de abajo, solo en la hoja de detalle (para todos los roles). El agarrador de las otras hojas se deja como está y se decide aparte (ver abajo).
- *Verifica:* e2e: la hoja se cierra con «Cerrar» como dueño, ayudante y contador; `ventas-anular.spec.ts:222` (el ayudante no ve «Anular») sigue pasando; medición de controles de 48 px.

**3. Stock habla como el puesto y el anillo dice de qué es.** (leyes 1, 3 y 4)
- *Antes:* el anillo dice «0%» sin decir de qué (la frase está debajo, a 15 px); «Sobrestock» / «con sobrestock».
- *Después:* el anillo dice «0 de 7» con la palabra «bien» (cabe en 96 px); «Sobrestock» pasa a «Te sobra» y «con sobrestock» a «te sobran», en los tres lugares donde sale (`TableroStock`, `ResumenInventario` y el aviso de «Hoy»).
  Las claves internas `reponer` y `sobrestock` no cambian.
- *Verifica:* Vitest de `inventario-reglas`, e2e de Stock y de «Hoy» a 412 y 360 px y captura antes/después. Ningún e2e actual busca esos textos.

**Lo que sobra (ley 8):** el total repetido en la cabecera del día cuando el período es «Hoy» (se queda el conteo y «· 30 anuladas»; el monto se va), y el agarrador de las hojas, que promete un gesto de deslizar que no existe.

**Lo que nadie pidió y más importa: las ventas de 7 días se cortan en silencio.** `app/(app)/ventas/page.tsx:32` pide como máximo 300 ventas de los últimos 7 días. Con 20 a 60 ventas al día son entre 140 y 420; desde unas 43 al día
las más viejas se pierden sin avisar, y «En 7 días vendiste», lo contado, lo fiado y el «7 días 177» salen **bajos** sin decir nada. La base de pruebas (177 en 7 días) lo esconde. Es una cifra de dinero que parece exacta
(principios 2 y 4). Propuesta: las sumas y el conteo salen de una consulta propia, de solo `total` y `condicion`, sin el límite de la lista, y si la lista se corta se dice «Mostrando las últimas 300 ventas». No cambia ninguna regla de dinero,
solo de dónde sale la suma, pero es una cifra de dinero: **va con tu OK aparte**. Se verifica sembrando más de 300 ventas en la base local y comparando con la base.

## 6. Lista aparte (sin ejecutar)

- **Los dos nombres de la merma** («Merma» abajo, «Se malogró» en la fruta): ambas palabras están permitidas; unificar toca unas 12 pruebas e2e. Hay que elegir la palabra: se propone «Se malogró» en los dos botones y «Registrar merma» en el título, que es el término del libro.
- **«Reponer» y «Sin movimiento»** (se entienden en un puesto; hay que decidir si pasan a «Por comprar» y «No se vende»).
- **Las píldoras flotantes tapan el primer aviso a 360 px:** achicar el anillo y los tres mosaicos de arriba lo libera sin tocar la barra (la barra tiene sus propias pruebas de posición y tamaño).
- **El agarrador de las hojas** promete un gesto: o se quita o se implementa el deslizar. Toca las siete hojas.
- **Números de los filtros a 14 px y 5.5:1** (pieza `Filtros`, regla C3).
- **Los motivos de «Anular» sin marca de selección** hasta que se toca uno.
- **Las hojas de merma y de compra** no muestran el campo de cajas y de precio hasta elegir la fruta.
- **Al anular una venta al contado,** el texto dice «se descuentan S/ 450.00 de lo que vendiste»; no dice si la plata ya cobrada se devuelve. Es una decisión del negocio y del contador, no de la pantalla.
- **«Venta al paso» sin etiqueta «A quién»** en el detalle: no es falla cuando la venta es a un cliente (sale su nombre); queda por revisar con una venta con cliente.
- **Pendiente de esta pasada:** el peso de JavaScript, el teclado y los estados vacío, de error y de carga de las dos pantallas.
