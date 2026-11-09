# /formidable · Escritorio (panel lateral, ADR-0015) · 2026-11-09

- **Qué se revisa:** las 7 pantallas con sesión a 1280 × 800: «Hoy», Clientes, ficha del cliente, Ventas, Stock, Cierre y Ajustes. **Quién las usa:** quien revisa, es decir el administrador y el contador (CLAUDE.md).
- **Capturas:** `capturas/escritorio-2026-11-09/<pantalla>-1280.png`.

## 1. Medido

- **Auditoría visual a 1280 px** (`tests/e2e/auditoria-visual.spec.ts`, «escritorio, 1280 px»): pasa en las 7 pantallas y en las hojas (menú, abono, cliente nuevo, compra, merma y detalle de venta). Ningún texto queda por debajo de 4.5:1 (o 3:1 si es grande), nada se corta y no hay scroll horizontal con datos normales.
- **`tests/e2e/escritorio.spec.ts`:** el panel lleva a todas las pantallas y marca la actual, y el contador lo ve sin Ajustes y sin la voz. Además comprueba:
  - la grilla de «Hoy»;
  - la tabla de Clientes, que ordena, coincide con la base y abre la ficha con toda la fila;
  - la tabla de Ventas, con su hora, donde toda la fila abre el detalle.
- **El borde:** a 1024 px aparece el panel; a 1023 px sigue la barra de abajo. Sin scroll horizontal en ninguno de los dos.
- **Celular:** las pruebas de las pantallas tocadas pasan a 412 y 360 px.

## 2. Prueba a ciegas (Observado: un agente sin contexto, como contador, solo con las capturas)

| Tarea | Nota | Dónde dudó |
|---|---|---|
| Cuánto se vendió hoy y cuánto al crédito | 4 | «Hoy» y Ventas dan cifras distintas (ver ruido) |
| Quién debe más y su documento | 5 | Lo encuentra en la tabla. Lo confunden datos de prueba (dos clientes con el mismo DNI) |
| Ordenar por nombre | 6 | **Solo la columna ordenada tiene flecha:** no sabe que «Cliente» se puede tocar |
| La última venta y su hora | 6 | Lo resuelve. Cinco ventas en el mismo minuto (datos de prueba); no sabe si las anuladas cuentan |
| Efectivo en caja y el Excel del mes | 4 | **La caja negativa** (−S/ 122.92) no se explica. **La píldora de WhatsApp tapa en parte la tarjeta del Excel** mientras se desliza |
| Volver a «Hoy» | 10 | — |

- **Ruido descartado:** las capturas se tomaron en momentos distintos, mientras las pruebas e2e agregaban ventas a la base local. Por eso «Hoy» (11 ventas) y Ventas (360) no cuadran, y lo mismo pasa con «Te deben». Los clientes con el mismo DNI también son datos de prueba. No son defectos de la app.
- **Hallazgo nuevo del escritorio:** las **píldoras flotantes** («Registrar abono», «Compra / Merma», «Enviar por WhatsApp») y el orbe se centran sobre el contenido. En una pantalla ancha tapan filas mientras se desliza. En la maqueta A, esas acciones iban arriba, en la cabecera.

## 3. Notas

- **Leyes:** 1 · 7 · 2 · 8 · 3 · 6 (la caja negativa) · 4 · 8 · 5 · 9 · 6 · 9 · 7 · 8 · 8 · 8 · 9 · 8.
- **Reglas:** C1 · 7 (las acciones flotan sobre el contenido) · C2 · 10 · C3 · 10 · C4 · 9 · C5 · 10 · C6 · 10.
- **Oficio:** 8.
- **Nota total: 8.1.**

## 4. Los 3 cambios de mayor impacto (esperan OK)

1. **En escritorio, las acciones de cada pantalla van arriba, en la cabecera, como en la maqueta.**
   - **Antes:** «Registrar abono», «Compra», «Merma» y «Enviar por WhatsApp» flotan centradas sobre el contenido y tapan filas.
   - **Después:** desde 1024 px se dibujan a la derecha del título. En celular siguen flotando en la zona del pulgar.
   - **Se verifica:** con una e2e que compruebe que ninguna píldora se cruza con una fila a 1280 px, y repitiendo la tarea 5 a ciegas.
2. **Todas las columnas que se ordenan muestran que se pueden ordenar.**
   - **Antes:** solo la columna activa lleva flecha.
   - **Después:** las otras llevan un ícono de orden en gris.
   - **Se verifica:** repitiendo la tarea 3 a ciegas.
3. **La caja negativa se explica con una frase.**
   - **Antes:** «−S/ 122.92» sin más.
   - **Después:** «Salió más efectivo del que entró: revisa los gastos y compras pagados en efectivo».
   - **Toca cómo se presenta el dinero:** espera el OK aunque solo cambie la pantalla.

- **Lo que sobra (ley 8):** nada evidente. El escritorio no agregó información nueva, solo acomodo.
- **Lo que nadie pidió y más importa:** la tabla de Clientes con un nombre muy largo y sin espacios ensancha la pantalla (lo encontró `/chaos`).

### Lista aparte (sin ejecutar)

- Decir «las anuladas no cuentan» junto al conteo de Ventas (viene del pendiente del celular).
- La ficha del cliente deja aire bajo «Sus movimientos» cuando tiene pocos.

## 5. Arreglado con OK («Sí, aplica todo»)

| Cambio | Cómo quedó | Se verificó con |
|---|---|---|
| 1. Acciones arriba | Desde 1024 px, «Registrar abono», «Compra / Merma» y «Enviar por WhatsApp» van a la derecha del título (`BarraFlotante`, `lg:absolute`). En el celular siguen flotando en la zona del pulgar. | e2e «las acciones de la pantalla van arriba…»: a la altura del título, a su derecha y sin cruzarse con ninguna fila, en Clientes, Stock y Cierre |
| 2. Columnas ordenables a la vista | «Cliente» lleva un ícono de orden en gris aunque no esté activa | Captura `clientes-1280-despues.png` |
| 3. Caja negativa explicada | «Hoy salió más efectivo del que entró: revisa los gastos y las compras que pagaste en efectivo.» (`fraseDeLaCaja`, `lib/cierre-reglas.ts`) | Vitest (11 pasan) y captura `cierre-1280-despues.png` |

- **Capturas de después:** `capturas/escritorio-2026-11-09/<pantalla>-1280-despues.png`, con la base recién reiniciada. A 412 px, Clientes y Cierre se ven igual que antes (`*-412-despues.png`).
- **Sin repetir:** la prueba a ciegas de las tareas 3 y 5. Las e2e cubren lo que se midió; la duda de «se puede tocar» se juzga en la captura.
