# /formidable · Ficha del cliente y hoja «Registrar abono» a mano (A8) · 2026-11-05

**Para quién:** el dueño y el ayudante, de pie en el puesto, con una mano libre. **Finalidad:** saber en 5 segundos cuánto te debe un
cliente y registrar que te pagó sin escribir más que el monto (CLAUDE.md, «Alcance de la demo»). **Rama:** `claude/cuaderno-stock-ventas`.

## 1. Medido (412 × 915, 360 × 800 y 1280 × 800)

Cuatro escenas: la ficha, el cuaderno con su botón, la hoja desde la ficha y la hoja desde el cuaderno (con y sin elegir al cliente).

| | Ficha | Cuaderno | Hoja (ficha) | Hoja (cuaderno) | Elegir cliente |
|---|---|---|---|---|---|
| Controles menores de 48 px | 0 | 0 | 0 | 0 | 0 |
| Desborde horizontal (412 / 360 / 1280) | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Textos bajo 4.5:1 | 0 | 0 | 0 | 0 | 0 |
| Textos importantes bajo 7:1 | 0 | 1 (el «19» del filtro, 14 px, 5.5:1: pieza existente) | 0 | 0 | 0 |
| Textos bajo 17 px | 5 (ver abajo) | 26 (los «debe» de 15 px, el filtro, la barra) | 0 | 0 | 0 |
| Cifras sin `tabular-nums` | 0 | 0 | 0 | 0 | 0 |
| Fuentes | solo Manrope | solo Manrope | solo Manrope | solo Manrope | solo Manrope |

- **Acción principal:** el botón «Registrar abono» mide 68 px y está al 84–86 % desde arriba (tercio de abajo). «Confirmar abono» está al
  90 % (412) y 88 % (360), a la vista sin deslizar. A 1280, la hoja queda centrada y «Confirmar» al 68 %.
- **Separación:** «Confirmar abono» y «Descartar» están a **4 px** (la regla pide 8). Es la pieza compartida `PieConfirmar`: afecta a las
  seis tarjetas de voz. Las cuatro entradas de la barra de abajo se tocan (0 px): pieza existente.
- **Textos bajo 17 px en la ficha:** tres son míos («Última venta al crédito», «Último abono» y «Documento», a 15 px); dos son piezas
  existentes (la insignia «Lo debe», 15 px, ya anotada como decisión de identidad, y las etiquetas de la barra, 13 px).
- A 360 px, «Última venta al crédito» se parte en dos líneas y desiguala las dos fichas de arriba.
- El contraste se compuso sobre el color de fondo de cada tarjeta, sin el degradado de atrás: es una medida aproximada.
- Teclado: sin medir (la emulación no abre teclado). JavaScript de «Hoy»: se mide al cerrar A8; esta pasada no cambia lo que «Hoy» carga.
- Capturas «antes» en `docs/formidable/capturas/ficha-cliente-<escena>-antes-{412,360,1280}.png`.

## 2. Prueba ciega (Observado)

Un agente sin contexto vio solo las capturas a 412 px, con una tarea por pantalla.

| Pantalla | Resolvió | Tiempo | Dónde dudó |
|---|---|---|---|
| Cuaderno | sí: tocó «Registrar abono» | menos de 5 s | «Abono» no es su palabra («me pagó», «cobré»); ¿sirve para un cliente o para cualquiera?; el botón tapa las filas 4 y 5 |
| Ficha | sí | menos de 5 s el monto; 5 a 15 s «desde cuándo» | Solo ve «hoy» y «nunca», no desde cuándo debe; la barra del 26 % «no sirve para cobrar»; «Sus datos» ocupa mucho para un DNI; el botón tapa el grupo «Ayer» |
| Hoja desde la ficha | sí | 5 a 15 s | «Toca para cambiar el monto» cuando no hay monto; el lápiz de la fila del cliente; «Confirmar» se ve apagado y no dice qué pasa al tocarlo; «Descartar» chico y pegado a «Confirmar»; el mensaje rojo repite lo que ya dicen los cuadros |
| Hoja desde el cuaderno | sí | 5 a 15 s | «Sin cliente» suena a una decisión ya tomada; dos cuadros en rojo «me regañan antes de empezar»; no sabe si «Efectivo» ya quedó elegido |
| Elegir cliente | sí | menos de 5 s | La lista no dice cuánto debe cada uno ni el apodo; «¿Quién te pagó?» parece pregunta y no buscador; «Volver al abono» es chico para el pulgar |

Verificado por mí contra el código y la captura (el escéptico): el botón redondo «N» de abajo a la izquierda que el agente vio es el
indicador de desarrollo de Next, no la app (se descarta). La pestaña «Todos» cortada es del filtro existente, no de A8.

## 3. Calificación

| Ley o regla | Nota | Por qué |
|---|---|---|
| 1 · Sin manual | 8.0 | Las cinco tareas se resolvieron; las dos hojas tardaron de 5 a 15 s. |
| 2 · Una pregunta, una respuesta | 8.5 | Ficha: la deuda y un botón. Hoja: tres cosas en rojo a la vez. |
| 3 · Simplicidad profunda | 8.5 | «Te debe S/ 680.00» es un veredicto; falta «desde cuándo». |
| 4 · Lenguaje de puesto | 7.5 | «Sin cliente», «Toca para cambiar el monto» sin monto, «Última venta al crédito». |
| 5 · Contenido primero | 7.5 | El botón flotante (68 px a todo el ancho) tapa filas del cuaderno y de la ficha. |
| 6 · Lo difícil, a un toque | 9 | El historial y los datos, un deslizamiento; abonar, un toque. |
| 7 · Perdonar | 8.5 | Descartar cierra sin deshacer; lo escrito se pierde, pero es un monto. |
| 8 · Quitar antes de agregar | 8 | La barra del 26 %, el mensaje rojo que repite los cuadros. |
| 9 · De punta a punta | 8.5 | Sin movimientos, 404, sin señal al abrir y respuesta perdida: diseñados. Falta ver el error de la ficha y la hoja de lado. |
| C1 · Pulgar | 9.5 | Botón al 85 %, «Confirmar» al 88–90 %. |
| C2 · Tamaño | 8 | Todo mide 48 px o más; «Confirmar» y «Descartar» a 4 px. |
| C3 · Sol | 8.5 | Contraste sin fallas; tres etiquetas mías a 15 px. |
| C4 · Bordes | 9 | Sin desborde a 3 anchos; de lado, «Confirmar» queda fuera de la vista. |
| C5 · Hojas | 10 | Una sola `<Hoja>`. |
| C6 · Navegación | 10 | Cuatro destinos. |
| C7 · Señal | 10 | Insignias con texto; vibra y suena al guardar (misma pieza que la voz). |
| C8 · Velocidad | sin medir | Se mide al cerrar A8. |
| Oficio visual | 9 | Una familia, cifras tabulares, las mismas piezas que «Lo último». |
| **Total** | **8.5** (8.9 después de aplicar los 3 cambios, ver sección 5) | |

## 4. Los 3 cambios de mayor impacto (esperan OK)

1. **La hoja a mano deja de regañar antes de empezar.** Con la hoja vacía, los cuadros pasan de dos recuadros rojos («Sin cliente»,
   «¿Cuánto te dio? · Toca para cambiar el monto») a un borde neutro con «¿Quién te pagó?» y «¿Cuánto te dio? · Toca para poner el
   monto»; el aviso de abajo pasa de rojo a texto normal. El rojo vuelve solo si la persona intenta confirmar sin completar. Arregla las
   leyes 4 y 1. Se verifica con e2e, con la captura a 412 y 360 px y repitiendo la prueba ciega.
2. **El botón flotante tapa menos.** De 68 px a todo el ancho a una píldora de 56 px centrada con su texto; el espacio del final ya
   está. Arregla la ley 5. Se verifica con el e2e de «no tapa el último movimiento», con la captura y midiendo el área que cubre.
3. **Etiquetas a 17 px y sin partirse, y «Confirmar» / «Descartar» a 8 px.** «Última venta al crédito» pasa a «Último fiado» (la palabra del
   puesto), las tres etiquetas suben de 15 a 17 px, y el espacio del pie de la hoja pasa de 4 a 8 px (afecta a las seis tarjetas de voz,
   solo en lo visual). Arregla C2, C3 y la ley 4. Se verifica con la medición a 3 anchos y la captura a 360 px.

- **Lo que sobra (ley 8):** la barra del 26 % en la ficha: el agente ciego dijo que no le sirve para cobrar.
- **Lo que nadie pidió y más importa:** la ficha no responde «¿desde cuándo debe?», la pregunta que más tardó (5 a 15 s). Se puede
  decir «Debe desde el 28 de octubre» (la venta al crédito más vieja que sus abonos no alcanzan a cubrir). Es una regla de dinero:
  espera OK y va como actividad aparte.

**Lista aparte, sin ejecutar:**
- Mostrar «te debe S/ 680.00» y el apodo en la lista de «¿Quién te pagó?» (ley 3), y que «Volver al abono» sea un botón de 48 px.
- «Transf.» abreviado y apretado en el selector de medio de pago.
- El enlace de «¿cuánto me debe don Lucho?» (voz) hoy lleva a Clientes; con la ficha puede llevar a su ficha (toca otro módulo).
- Pestaña «Todos» cortada y las etiquetas de 13 px de la barra: piezas existentes (identidad).
- Ver el estado de error de la ficha: hoy lo tapa el hallazgo de `lib/sesion.ts:28`.

## 5. Aplicado con OK (5-11)

| Cambio | Antes → después | Verificado |
|---|---|---|
| La hoja a mano deja de regañar | «Sin cliente» y «¿Cuánto te dio? · Toca para cambiar el monto» en recuadros rojos → «¿Quién te pagó? · Toca para elegir» y «¿Cuánto te dio? · Toca para poner el monto» con borde del acento, y el aviso en texto normal. El rojo no vuelve: «Confirmar» no se puede tocar incompleto. Con un monto puesto, «cambiar» vuelve. | e2e (ninguna clase `ring-deuda` ni `text-deuda` en la hoja vacía) y segunda prueba ciega |
| El botón flotante tapa menos | Franja de 68 px de lado a lado → píldora de 56 px centrada (variante `flotante` de `Boton`); sigue al 85–86 % desde arriba | e2e (alto ≤ 56 px, menos del 75 % del ancho, centrada, último movimiento por encima) y medición a 3 anchos |
| Etiquetas a 17 px y a 8 px | «Última venta al crédito» → «Último fiado»; «Último abono» y «Documento», de 15 a 17 px, sin partirse a 360 px; «Confirmar» y «Descartar» de 4 a 8 px (las seis tarjetas de voz) | e2e (etiquetas ≥ 17 px y de una línea; separación ≥ 8 px) y 62 e2e de las tarjetas de voz |

**Medido después (412 / 360 / 1280):** controles menores de 48 px: 0; desborde: 0; contraste: sin fallas; textos bajo 17 px en la ficha: 9 → 8, y
ya no queda ninguno mío (quedan la insignia «Lo debe» de 15 px y la barra de abajo de 13 px, piezas existentes); en las hojas, ninguno. «Confirmar abono»
al 89 % (412) y 88 % (360); el botón flotante, al 85–86 %. En el cuaderno los textos bajo 17 px suben de 12 a 53 solo porque la base de pruebas
tiene más clientes (cada fila trae su «debe» de 15 px); no es un cambio de la pantalla.

**Segunda prueba ciega (capturas «después»):**

| Pantalla | Tiempo antes → después | Qué cambió |
|---|---|---|
| Cuaderno | menos de 5 s → menos de 5 s | Sigue notando que el botón tapa a medias dos filas |
| Ficha | 5 a 15 s → 5 a 15 s | «Último fiado» lo lee dos veces; «nunca» en «Último abono» lo alarma; sigue sin ver «desde cuándo» debe |
| Hoja desde la ficha | 5 a 15 s → menos de 5 s | Ya no duda del «cambiar el monto» |
| Hoja desde el cuaderno | 5 a 15 s → menos de 5 s | Ya no dice que «regaña»; entiende que va primero «¿Quién te pagó?» |
| Elegir cliente | menos de 5 s → menos de 5 s | Igual: no ve cuánto debe cada uno |

**Notas nuevas:** ley 1 · 8.0 → 8.8, ley 2 · 8.5 → 8.7, ley 4 · 7.5 → 8.3, ley 5 · 7.5 → 8.0, C2 · 8 → 9.5, C3 · 8.5 → 9. El resto sin cambio.
**Total 8.5 → 8.9.** Capturas `ficha-cliente-<escena>-despues-{412,360,1280}.png`, junto a las «antes».

### Lo que apareció en la segunda pasada (sin ejecutar)

- **«Falta elegir cuánto te dio»:** hay que escribir un número, no elegir. El texto es compartido con el abono por voz (`frasesFaltaAbono`, y su e2e lo
  lee tal cual): arreglarlo toca las dos tarjetas.
- **«Confirmar abono» se ve apagado** y no dice qué falta. Es la variante secundaria a propósito (legible al sol), pero el sol de afuera la vuelve
  casi igual al fondo. `PieConfirmar` ya admite `etiquetaPendiente` («Primero: …»), como en la venta.
- **«Efectivo» ya viene marcado**: si la persona se olvida, el abono queda en efectivo sin avisar. Es el pendiente del 31-10 sobre el medio por
  defecto; a mano pesa más porque nadie lo dictó.
- **«Descartar»** es chico y pálido al sol (variante `texto`).
- **La pestaña «Todos» del filtro del cuaderno se corta** a 412 px (la vio en las dos pasadas). Es del filtro existente, y la pantalla es de A8.
- **El botón flotante todavía tapa a medias una o dos filas**, ahora menos. Una solución sin tapar nada es poner el botón en la barra de abajo; es otra decisión de navegación.
- **«Abono» y «fiado» no son las palabras del agente** («me pagó», «cobré»). «Abono» es el vocabulario oficial del `CLAUDE.md`; «fiado» ya está en «Fiaste hoy».
- **Pestañas sin ver y flechas «>»** de las filas: no dicen qué abren. Con la ficha ya funciona, pero la flecha sola no lo cuenta.
