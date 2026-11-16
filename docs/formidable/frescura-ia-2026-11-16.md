# /formidable · Hoja «¿por qué?» con «Sigue buena» y el origen de la cuenta · 2026-11-16

- **Qué es:** la hoja de una llegada en Stock, ahora con el botón «Sigue buena» (para la que ya pasó su día) y, al pie, de dónde sale
  la cuenta: la tabla o la IA, con su motivo (ADR-0021). La usa el dueño o el ayudante en el celular, de pie.
- **Rama:** `claude/frescura-ia`. **Escala:** un agente ciego. Sin escéptico.

## 1. Medido (412 × 915 y 360 × 800, con la demo y estimaciones reales de Sonnet)

- 0 controles menores de 48 px, 0 desborde horizontal, 0 errores de consola. La hoja no necesita deslizarse (657 px a 412; 731 a 360).
- «Sigue buena» y «Se malogró» van lado a lado, de 56 px de alto. A menos de 400 px van sin dibujo: con él, el texto se partía en dos líneas.
- Tras el toque: vibración, sonido y el veredicto cambia a «Sigue buena · La revisaste hoy. Mañana vuelve a mirarla.» (con visto, no con triángulo).
- El pie va a 15 px (texto secundario) y llega a 5 líneas cuando el motivo es largo.
- E2e (`stock-sigue-buena`, `vida-estimada`) a 412 y 360 px: en verde.

Capturas en `capturas/frescura-ia-2026-11-16/`: `hoja-sigue-buena-antes-{412,360}`, `hoja-sigue-buena-despues-{412,360}`,
`hoja-origen-ia-{412,360}` y `hoja-origen-ajuste-412`.

## 2. Prueba ciega (Observado; tres capturas a 412 px)

| Tarea | Nota | Lo que pasó |
|---|---|---|
| 1 · La fruta está buena: ¿qué tocas? | 8 | Tocó «Sigue buena» sin dudar y esperaba que se quitara el aviso rojo. Dudó con «Su último día bueno fue ayer» («suena a que ya está malograda, y yo la veo buena») y con «llegaron hace 9 días» junto a «Lleva 10 días en el puesto». Buscó dónde poner la rebaja. |
| 2 · Después del toque | 8 | Entendió que quedó anotado, que sus 6 cajas no se movieron, que hoy la vende y mañana la vuelve a mirar. Para una merma tocaría «Se malogró». Dudó: la barra sigue en rojo, y «no veo cómo deshacer si toqué sin querer». |
| 3 · ¿De dónde sale la cuenta? (tuna ajustada) | 5 | Supo que lo dice la IA, por mermas anteriores y por el calor. Pero «las cuentas no me cierran»: «unos 6 días», «el calor le quitó 2», «le quedan 3», «hasta el sábado 21». Y los motivos sueltos no se entienden: «¿el mismo día de qué?», «no entendí qué es "cambiarla"». Si no está de acuerdo, no ve qué tocar. |

## 3. Notas

- Leyes: 1 · 8, 2 · 8, 3 · 6, 4 · 7, 5 · 8, 6 · 7, 7 · 7, 8 · 7, 9 · 8.
- Celular: C1 9 · C2 10 · C3 7 · C4 10 · C5 10 · C6 10 · C7 9 · C8 9.
- Oficio: 7 (los rótulos de los días se pisan en una fruta de vida larga: ver abajo).
- **Nota total: 7.8.** El toque se entiende solo (8 y 8); el pie con el origen de la cuenta, no (5).

## 4. Los 3 cambios de mayor impacto (esperan OK)

1. **Que los números del pie cuadren con los de arriba.** Antes: «cuento unos 6 días con clima normal» debajo de «aguantaba hasta el
   sábado 21» y «el calor le quitó 2 días». Después: una sola frase en la tarjeta del calor, con la misma fecha («La IA le calcula 6 días
   con clima normal: hasta el sábado 21. El calor le quitó 2.»), y el pie solo con el motivo. Ley 3. Se verifica con Vitest de las frases
   y repitiendo la tarea 3.
2. **Un motivo que se entienda sin haber visto el pedido.** Antes: «Una sola revisión pasada su fecha no alcanza para cambiarla», «el
   mismo día: le quito un día». Después: cuando el ajuste deja el número igual, la hoja dice «La IA miró lo que pasó en el puesto y la
   dejó igual»; cuando cambia, el motivo nombra el hecho («Dos mermas el día que llegó»). Ley 4. Se verifica midiendo motivos reales.
3. **«Su último día bueno fue ayer» no debe sonar a «ya está mala».** Antes: el veredicto rojo lo dice así. Después: «Según la cuenta,
   ayer era su último día. Mírala.», y los días se cuentan igual en toda la hoja («llegaron hace 9 días» / «lleva 10 días»). Leyes 1 y 4.

**Lo que sobra** (ley 8): la frase «Es un cálculo aproximado…» repetida al pie de cada hoja, cuando el pie ya es largo.
**Lo que nadie pidió y más importa:** «Sigue buena» no tiene «Deshacer» (ley 7). Un toque por error calla el aviso de esa llegada hasta mañana.

## 5. Lo demás (sin ejecutar)

- Los rótulos de los días («31° 30° 30° 30°», «vie sáb dom hoy») se pisan cuando la fruta dura mucho y lleva pocos días
  (`components/inventario/HojaPorQue.tsx:83`): se ve en `hoja-origen-ia-412.png`. Venía de antes.
- Después de «Sigue buena», la barra del calor sigue en rojo.
- No hay dónde anotar la rebaja ni decir que solo algunas cajas están malas.
- Si la persona no está de acuerdo con la IA (cree que aguanta más), solo puede esperar a que la llegada se pase para tocar «Sigue buena».
- El INP sigue sin medirse en un teléfono real.
