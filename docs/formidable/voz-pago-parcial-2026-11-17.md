# /formidable · Hoja «¿Así fue la venta?» con pago parcial · 2026-11-17

**Qué es:** la tarjeta que sale después de dictar una venta. Desde el ADR-0023 dice cuánto pagó el cliente al llevarse la fruta y cuánto
queda debiendo. **La usa** el dueño o el ayudante, en el celular, de pie y al sol.

## 1 · Medido (Playwright, 412 × 915, 360 × 800 y 1280 × 800, con pago y sin pago)

- Controles de menos de 48 px: **ninguno**, en los tres anchos.
- Scroll horizontal: **ninguno**.
- «Confirmar venta» en el tercio de abajo: **sí** (top 783 de 915 a 412 px; 668 de 800 a 360 px).
- Contraste:
  - «Pagó ahora» 15.9:1 y «Queda debiendo» 14.6:1;
  - las cifras S/ 1,000.00 (verde) y S/ 4,000.00 (deuda), 8.2:1 y 8.1:1, a 30 px;
  - «No pagó nada», 7.1:1 a 17 px;
  - los medios de pago, 15.9:1.
- Fuente: solo Manrope. Colores: todos de tokens.

## 2 · Prueba ciega (Observado, un agente sin contexto, capturas a 412 px)

1. **Anotar «dejó S/ 1,000 por Yape, el resto lo debe»:** tocó «Pagó una parte», que era lo correcto, pero dudó si era un tercer camino
   o si iba junto con «Lo debe».
2. **Leer la venta con el pago:** entendió S/ 1,000 pagados y S/ 4,000 debiendo.
   - Vio **tres cifras grandes** juntas (Total, Pagó ahora, Queda debiendo) y además la tarjeta de deuda repitiendo los S/ 4,000.
   - Creyó que «Efectivo» marcado de entrada era un error.
   - Dudó si «Debe el resto» era el mismo botón que «Lo debe».
3. **Quitar el pago («no te dio nada»): no lo encontró.** «No pagó nada», debajo de «Pagó ahora S/ 1,000», lo leyó como algo que
   contradice el pago, no como un botón para quitarlo.

## 3 · Notas

| | Nota | Por qué |
|---|---|---|
| Ley 1 · Sin manual | 7 | Quitar el pago no se encontró; «Pagó una parte» se encontró, con duda. |
| Ley 2 · Una pregunta, una respuesta | 7 | Tres cifras grandes y una tarjeta que repite la deuda. |
| Ley 3 · Veredicto | 9 | «Queda debiendo S/ 4,000» y «te debe S/ 4,000» son veredictos, no cuentas. |
| Ley 4 · Lenguaje de puesto | 7 | «No pagó nada» se lee como un hecho, no como una acción. |
| Ley 5 · Contenido primero | 9 | El dinero manda. |
| Ley 6 · Lo difícil, a un toque | 9 | El pago parcial está a un toque, debajo de «Lo debe». |
| Ley 7 · Perdonar | 9 | Todo se corrige antes de Confirmar. |
| Ley 8 · Quitar antes de agregar | 6 | «Queda debiendo» repite la tarjeta de deuda cuando hay cliente; el botón cambia de nombre. |
| Ley 9 · De punta a punta | 9 | 360 px, sin pago, con pago, pago que llega al total, sin señal y sesión vencida, todo probado. |
| C1–C8 | 9 | Todo medido en verde. C8 sin medir aparte: la hoja ya estaba dentro del presupuesto. |
| Oficio visual | 8 | Un solo rojo de más (píldora, cifra y medidor seguidos). |
| **Total** | **8.1** | |

## 4 · Los 3 cambios de mayor impacto (esperan el OK)

1. **«No pagó nada» → «Quitar lo que pagó».**
   - **Arregla** las leyes 1 y 4. La prueba ciega no encontró cómo quitar el pago.
   - **Se verifica** cuando un nuevo ciego quita el pago a la primera, y con la e2e por nombre.
2. **«Lo debe» no cambia de nombre.** Hoy pasa a «Debe el resto» cuando hay un pago.
   - **Arregla** las leyes 1 y 8: el ciego dudó si era el mismo botón. Lo que pagó ya está escrito justo debajo.
   - **Se verifica** cuando el ciego lee la píldora y el pago sin preguntar.
3. **Con cliente y su deuda a la vista, sacar la fila «Queda debiendo».** La tarjeta de deuda ya dice «+ S/ 4,000.00 de hoy» y el
   total que debe. La fila se queda solo cuando no hay tarjeta de deuda (cliente de paso, o saldo que no cargó).
   - **Arregla** las leyes 2 y 8: una cifra grande menos y un rojo menos.
   - **Se verifica** con la medición y el ciego a 412 px.

**Lo que sobra (ley 8):** la doble cifra de deuda (cambio 3).
**Lo que nadie pidió y más importa:** que el medio que viene marcado de entrada («Efectivo», regla 4 del prompt) no parezca un error.
Pasó lo mismo en la tarjeta de abono (2026-10-31) y quedó como está. Se anota y no se toca.

## Fuera de los 3 (lista, sin ejecutar)

- «Pagó una parte» podría decir que va con «Lo debe» (por ejemplo, unirlo visualmente a la píldora).
- El número pegado al nombre del cliente en las capturas viene de los datos de prueba, no de la pantalla.

## 5 · Después de los 3 cambios (con OK, el mismo día)

**Medido:** las e2e `voz-pago-parcial` y `voz-venta` pasan (26 de 26) a 412 y 360 px. La captura de después tiene una sola cifra de
deuda y un solo bloque rojo.

**Segunda prueba ciega**, con un agente nuevo y la captura de después a 412 px:
- **Quitar el pago:** encontró «Quitar lo que pagó» a la primera. Antes no lo encontraba. Dijo que se ve gris y chico, «como un
  título»: es la variante `texto` de `Boton`, la misma de «Descartar».
- **Cambiar el monto:** tocó la fila «Pagó ahora S/ 1,000.00 ›» a la primera.
- **Leyó bien** S/ 1,000 por Yape y S/ 4,000 de esta venta. Por un momento tomó el total acumulado (S/ 17,180) por lo de hoy: lo de hoy
  está en letra chica en la tarjeta de deuda.
- **«Lo debe» marcado con un pago anotado** le hizo dudar un momento, hasta que entendió que era pago parcial. Al primer ciego le
  confundía más que el botón cambiara de nombre.

**Notas después:** ley 1 · 7 → 8, ley 4 · 7 → 8, ley 8 · 6 → 8, ley 2 · 7 → 7. **Total 8.1 → 8.5.**

**Queda (sin ejecutar):**
- Que lo de esta venta pese más que el acumulado en la tarjeta de deuda, cuando el cliente ya debía. Toca `MedidorDeuda`, que usan
  todas las ventas.
- Que «Quitar lo que pagó» se lea como un botón: toca la variante `texto` de `Boton`, que usan otras pantallas.
