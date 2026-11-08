# /formidable · Hoja «Detalle de la venta» con comprobantes (A9) · 2026-11-07

**Para quién:** el dueño y el ayudante, en el celular, de pie y al sol. El administrador y el contador la miran en escritorio (el contador solo lee: no emite).
**Finalidad** (`CLAUDE.md` «Comprobantes» y la lista de A9): desde una venta, emitir boleta o factura (a un cliente con RUC; si no lo tiene, se pide ahí
mismo), ver en qué quedó el comprobante y, si no terminó, terminarlo; con el comprobante aceptado, verlo en PDF y mandarlo por WhatsApp.
**Rama:** `claude/comprobantes-sandbox`. El proveedor es un Lucode simulado (`tests/e2e/lucode-simulado.mjs`); el sandbox real llega en A9.6.

Pasada **completa** con 2 agentes: uno a ciegas (solo las capturas a 412 px) y un escéptico que intentó refutar cada hallazgo. La medición la hice yo.
Capturas «antes» en `docs/formidable/capturas/detalle-venta-<estado>-antes-{412,360,1280}.png` (7 estados × 3 anchos).

**Aviso sobre los datos:** los nombres con número («Don Lucho 416») y el «Dueño de prueba» salen de las pruebas automáticas, no de datos reales. La bolita «N» de
abajo a la izquierda es del modo desarrollo de Next. Las medidas se tomaron con nombres cortos y realistas: con los nombres largos de las pruebas la hoja crece 4 líneas y
empuja «Cerrar», un artefacto que se descartó.

## 1. Medido (Medido)

Siete estados: sin comprobante, pidiendo el RUC, venta al paso, en proceso, enviado, rechazado y aceptado.

| | 412 | 360 | 1280 |
|---|---|---|---|
| Controles menores de 48 px | 0 | 0 | 0 |
| Desborde horizontal | 0 | 0 | 0 |
| Fuentes | solo Manrope | solo Manrope | solo Manrope |
| Cifras de dinero sin `tabular-nums` | 0 | 0 | 0 |
| Contraste menor de 4.5:1 | 0 | 0 | 0 |
| Textos clave menores de 7:1 | 0 | 0 | 0 |
| Textos bajo 17 px | 1 por estado: la insignia «Lo debe» / «Pagó» (15 px, pieza existente) | igual | igual |
| Botones de emitir | a la vista, en el tercio de abajo | a la vista | — |

- **Altura de la hoja** (a 360 y 412 px, con el alto de pantalla en 800 y 915): sin comprobante 588 · pidiendo RUC 609–622 · al paso 568 · en proceso 737 · enviado 688 ·
  **rechazado 748** (tope 752 a 360 px: **al límite**) · aceptada 677.
- **Frases grises** («Con comprobante no se anula…»): `--texto-suave` es `#3e4a5c`, unos **9:1** sobre blanco y **8:1** sobre el fondo (`app/globals.css:19`). Cumplen 7:1.
  Si cuestan al sol es por tamaño y lugar, no por contraste.
- **No medido en esta pasada:** el peso de JavaScript de «Ventas» tras A9, el teclado abierto en la vista del RUC, la hoja «rechazada» a 360 px con un motivo largo,
  y la vibración y el sonido al emitir (vienen de `useConfirmar`, sin probar aquí).

## 2. Prueba ciega (Observado)

Un agente sin contexto recibió las 7 capturas a 412 px y ocho tareas. **Nota de comprensión: 7/10.** Completó emitir, reintentar, ver cómo va y mandar por WhatsApp; se
trabó en tres lugares.

- **«Rechazada» no tiene salida clara:** «¿dónde corrijo el RUC? No veo botón». Habría tocado «Emitir boleta» otra vez y la habrían vuelto a rechazar.
- **«Nota de crédito»** es jerga contable y no hay botón: «me quedo sin saber qué hago si me equivoqué». Aparece en «enviado», «aceptada» y en la venta con comprobante.
- **«Proveedor»** («No hubo respuesta del proveedor»): «¿quién es, SUNAT o la app?».
- **«Emitir factura» y «Emitir boleta»** lado a lado, del mismo tamaño y color: «con las manos ocupadas y al sol podría tocar el equivocado».
- **El aviso rojo del RUC** sale con 4 dígitos escritos: «pensé que ya me equivoqué».
- **Dos salidas casi iguales** en la vista del RUC («Ahora no» y «Volver a la venta»).
- **Venta al paso:** deduce solo por qué no hay «Emitir factura»; la pantalla no lo dice.
- Dudó (sin trabarse) con «Reintentar» frente a «Ver cómo va», con cuánto dura «esperando a SUNAT», y con a qué número va el WhatsApp.

## 3. Escéptico (intentó refutar cada hallazgo)

| | Veredicto | Por qué |
|---|---|---|
| H1 Facturar y boletear iguales | **Parcial** | Los gemelos son reales (`ComprobanteDeVenta.tsx:144-152`, los dos `secundario`) y emitir no se deshace. «Anular» cerca: **refutado**, abre una vista con motivo y «No, dejarla». |
| H2 Sin salida al rechazo | **Real** | La tarjeta dice «corregirlo» sin decir dónde (`ComprobanteDeVenta.tsx:133`). Con un RUC malo ya guardado, «Emitir factura» reenvía el mismo RUC y gasta otro número. |
| H3 «Nota de crédito» | **Real** | `HojaVenta.tsx:143` y otra copia en `acciones-ventas.ts:36`. No hay botón porque la función no existe todavía. |
| H4 «Proveedor» | **Real, más amplia** | Sale en `comprobante-reglas.ts:234`, `emitir.ts` y «Lucode rechazó» (`comprobante-reglas.ts:252`), que además es nombre de marca. |
| H5 Sin decir «por SUNAT» | **Parcial** | «aceptada por SUNAT» es seguro. «Rechazada por SUNAT» sería falso: los 400/422 los rechaza el proveedor. No atribuir el rechazo. |
| H6 Error del RUC al primer dígito | **Real** | `PedirRuc.tsx:47`. Arreglo de una línea. |
| H7 Dos salidas | **Parcial** | Duplicado real (`PedirRuc.tsx:34` y `:61` llaman a `volver`); «Ahora no» gris es la variante `texto` de toda la app, por diseño. |
| H8 Venta al paso sin explicación | **Parcial** | Cierto, pero es regla (`ofertaDeFactura`) y una prueba exige 0 botones. Baja prioridad. |
| H9 Frases grises ilegibles | **Refutada** | El contraste cumple 7:1 (ver arriba). |
| H10 WhatsApp sin número | **Refutada** | No envía nada solo: WhatsApp abre con el mensaje escrito y la persona lo manda. Los botones miden 72 px, sin recorte. |

Yo verifiqué en el código tres de sus datos: el tope `max-h-[94dvh]` de `Hoja.tsx:24`, el recorte a 300 letras (`comprobante-reglas.ts:125`) y la regla de la factura (`ofertaDeFactura`).

## 4. Notas

| Ley | Nota | Evidencia |
|---|---|---|
| 1 Sin manual | 7 | Ciego 7/10: se trabó en corregir el RUC y en «nota de crédito» (Observado) |
| 2 Una pregunta, una respuesta | 6 | Dos botones de emitir gemelos, sin protagonista (Observado, Medido) |
| 3 Simplicidad profunda | 8 | «aceptada», «en proceso: reintenta», «enviada, esperando a SUNAT» son veredictos (Observado) |
| 4 Lenguaje de puesto | 6 | «proveedor», «nota de crédito», «Lucode rechazó» (Observado) |
| 5 Contenido primero | 8 | El cliente, el monto y la fruta mandan; el comprobante es una tarjeta aparte (Opinión) |
| 6 Lo difícil, a un toque | 6 | Corregir el RUC de un rechazo no es un toque ni se dice dónde (Observado) |
| 7 Perdonar antes que preguntar | 6 | Emitir no se deshace y no hay un paso entre los dos botones iguales (Observado) |
| 8 Quitar antes de agregar | 7 | Dos «Volver», una frase que repite el estado (Observado) |
| 9 De punta a punta | 7 | 7 estados diseñados, con motivo y ayuda; pero la altura de «rechazada» está al límite (Medido) |

| Regla del celular | Nota | Evidencia |
|---|---|---|
| C1 Pulgar | 8 | Los botones de emitir quedan en el tercio de abajo (Medido) |
| C2 Tamaño | 10 | 0 controles menores de 48 px a 412, 360 y 1280 (Medido) |
| C3 Sol | 8 | Contraste de texto 9:1 y cifras grandes; solo las insignias de 15 px (Medido) |
| C4 Bordes | 7 | Sin desborde; «rechazada» a 360 px al límite y sin medir con un motivo largo (Medido) |
| C5 Hojas | 10 | Todo es `<Hoja>` (Observado) |
| C6 Navegación | n/a | La barra de abajo no es de esta hoja |
| C7 Señal | 9 | Cada estado tiene icono y texto, no solo color (Observado); vibración y sonido sin probar |
| C8 Velocidad | sin medir | El JS de «Ventas» tras A9 no se midió |
| Oficio visual | 8 | Tokens y Manrope; 0 colores fuera de tokens; los gemelos pesan igual (Medido) |

**Nota total: 7.0 / 10.**

## 5. Los 3 cambios de mayor impacto (esperan el OK)

Tocan **comprobantes** (la pantalla de emitir y sus textos): por `CLAUDE.md`, no se implementa nada sin el OK de quien dirige el proyecto.

1. **Un protagonista al emitir** *(leyes 2 y 7; H1)*.
   - **Antes:** «Emitir factura» y «Emitir boleta» iguales, lado a lado.
   - **Después:** según el cliente, uno lleva el color de la acción principal y el otro queda quieto en la misma fila (así la hoja no crece): con RUC, la factura; sin RUC (pide el
     RUC primero) o sin cliente, la boleta. Sin pasos nuevos.
   - **Cómo se verifica:** capturas a 412 y 360 px con los estados «con RUC», «sin RUC» y «al paso»; la prueba de 48 px sigue pasando.
   - **Riesgo (sin probar):** el botón con más peso necesita más ancho que la mitad de la fila; a 360 px puede no caber con el texto en una línea. Si no cabe, la otra pasa a la variante
     `texto` en una fila aparte, y se vuelve a medir la altura de la hoja (hoy 568–748 px).

2. **Una salida desde el rechazo** *(leyes 6 y 1; H2)*.
   - **Antes:** «Puedes corregirlo y emitir otro: saldrá con otro número.»
   - **Después:** «Si el dato es del cliente, corrígelo en su ficha y vuelve a emitir.» y un botón «Corregir datos del cliente» que lleva a su ficha (solo dueño y administrador, como
     ya manda la RLS de `clientes`). La venta al paso no lo lleva: no hay a quién.
   - **Cómo se verifica:** captura de «rechazada» a 412 y 360 px, y una aserción en la prueba de rechazo de `comprobantes.spec.ts`.
   - **Queda fuera, y pide su propio OK:** dejar que «Guardar RUC y emitir factura» **pise** un RUC ya guardado (hoy `emitir.ts` solo guarda si el cliente no tiene documento).
     Toca permisos y datos del cliente.

3. **Palabras de puesto** *(ley 4; H3, H4, H5, H6)*. Solo textos:
   - «Con comprobante no se anula: corresponde una nota de crédito.» → «Ya tiene comprobante: no se puede anular. Si te equivocaste, pídele a tu contador una nota de crédito.»
   - «No hubo respuesta del proveedor» → «No llegó respuesta» (y el mismo cambio en los avisos de `emitir.ts`).
   - «Lucode rechazó la boleta» → «La boleta fue rechazada».
   - «aceptada» → «aceptada por SUNAT» (el rechazo no se atribuye a SUNAT).
   - El aviso rojo del RUC deja de saltar con el primer dígito: antes, una pista neutra («11 números, empieza con 10 o 20»); el rojo, solo con 11 dígitos o más.
   - **Cómo se verifica:** `grep` de los textos viejos, `vitest` de `comprobante-reglas`, y las pruebas e2e que los citan (`comprobantes.spec.ts` líneas 84, 383, 434 y la del RUC en 246–248;
     `ventas-anular.spec.ts:193`).
   - **Ojo:** `ComprobanteDeVenta.tsx:68` detecta el rechazo con `startsWith("El proveedor rechazó")`. Si el texto cambia y eso no, la alerta roja sale duplicada.

**Lo que sobra** (ley 8):
- «Volver a la venta» arriba en la vista del RUC y en la de anular (queda el de abajo).
- «SUNAT todavía no contesta.», que repite «enviada, esperando a SUNAT».
- «saldrá con otro número», un detalle interno.

**Lo que nadie pidió y más importa: la altura de «rechazada» con un motivo real.**
- A 360 px mide 748 de 752 solo porque el motivo de la prueba ocupa una línea. Un rechazo real puede ocupar 3 o 4 líneas (`recortar` deja pasar 300 letras): unos 50 a 70 px más, y
  «Anular» y «Cerrar» quedan debajo del borde, dentro de una hoja que se desliza por dentro.
- **La prueba no lo habría avisado:** `comprobantes.spec.ts:520-522` compara el alto de la hoja con el de la pantalla, pero `Hoja.tsx:24` la topa en `94dvh`, así que nunca puede fallar.
- **Propuesta:** que esa prueba compare `scrollHeight <= clientHeight` con un motivo de unas 200 letras, y mostrar el motivo en 2 líneas con el texto completo detrás de un toque
  (ley 6). Si hace falta recortar en pantalla, el texto crudo ya se guarda entero en `comprobantes.respuesta`.

## 6. Lista aparte (sin ejecutar)

- **Dejar pisar un RUC malo en «Guardar RUC y emitir factura»** (permisos y datos del cliente: OK aparte).
- **`reservar_comprobante` devuelve el comprobante vigente sin mirar el tipo** (`emitir.ts`, base): con una hoja desactualizada, «Emitir factura» muestra una boleta sin avisar. Toca la base y comprobantes.
- **Nota de crédito:** no existe en la app. Hoy una boleta emitida de más no tiene arreglo dentro de Fructus.
- **Venta al paso:** decir por qué no hay factura. Es regla y una prueba exige 0 botones; añadir texto a toda venta que solo admite boleta no compensa.
- **«Lo debe» junto a un comprobante aceptado:** el ciego lo leyó como «¿ya cobró?». Son cosas distintas (deuda y comprobante); queda como opinión.
- **«Reintentar» frente a «Ver cómo va»** y cuánto dura «esperando a SUNAT»: opinión; sin dato real hasta A9.6.
- **«Enviar por WhatsApp» sin decir a qué número:** refutada como falla, pero se podría leer «Enviar a Luis…» (rompe unos 8 localizadores de las pruebas).
- **Insignias «Lo debe» y «Pagó» a 15 px**, pieza ya anotada en informes anteriores.
