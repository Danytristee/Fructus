# /formidable · Hoja de respuestas por voz (A7) · 2026-10-31

**Para quién:** el dueño, de pie en el puesto, que pregunta con las manos ocupadas. **Finalidad:** saber la respuesta en 5 segundos,
leída o escuchada, sin abrir otra pantalla (CLAUDE.md, «La voz»). **Rama:** `claude/voz-preguntas`.

## 1. Medido (412 × 915, 360 × 800 y 1280 × 800)

Cuatro respuestas: «quién me debe», «cuánto me debe don Lucho», «cuánta piña me queda» y «cómo voy».

| | Quién | Deuda | Stock | Día |
|---|---|---|---|---|
| Controles menores de 48 px | 0 | 0 | 0 | 0 |
| Textos bajo 7:1 o bajo 17 px | 0 | 0 | 0 | 0 |
| Algo fuera de la hoja | 0 | 0 | 0 | 0 |
| «Listo», desde arriba (412 / 360) | 91 % / 90 % | 91 % / 90 % | 91 % / 90 % | 91 % / 90 % |

- JavaScript de «Hoy»: 177.3 KB brotli (tope 180), igual que antes de A7.
- La primera pasada a 360 px mostró la lista y «Listo» cortados a la derecha. Se arregló antes de esta medición (columna `minmax(0, 1fr)`).
- Capturas «antes» en `docs/formidable/capturas/voz-respuesta-<pantalla>-antes-{412,360}.png`.

## 2. Prueba ciega (Observado)

| Pantalla | Respondió bien | Tiempo | Dónde dudó |
|---|---|---|---|
| Quién te debe | sí | menos de 5 s | «Y 1 más» lo hizo contar; ¿qué es «el cuaderno»? |
| Cuánto te debe | sí | 5 a 15 s | Preguntó por «don Lucho» y le respondió «Luis Paredes»: ¿es el mismo? |
| Cuánto te queda | sí | menos de 5 s | Preguntó por «piña» y le respondió «Piña golden»: ¿es toda la piña? |
| Tu día | sí, pero desconfió | 5 a 15 s | Vendido − cobrado no da «Te deben, en total»: mezcla lo de hoy con lo de siempre. «Gastaste y compraste» junta dos cosas. |

## 3. Calificación

| Ley o regla | Nota | Por qué |
|---|---|---|
| 1 · Sin manual | 8.5 | Las cuatro se resolvieron; dos tardaron de 5 a 15 s. |
| 2 · Una pregunta, una respuesta | 9 | Una cifra protagonista y un «Listo». |
| 3 · Simplicidad profunda | 7.5 | «Tu día» mezcla lo de hoy con la deuda acumulada y junta gastos con compras. |
| 4 · Lenguaje de puesto | 8.5 | «cuaderno» no es el nombre de la pestaña («Clientes»). |
| 5 · Contenido primero | 9 | El dinero y las cajas mandan. |
| 6 · Lo difícil, a un toque | 9 | El detalle, a un toque («Ver…»). |
| 7 · Perdonar | 10 | No hay nada que confirmar ni descartar. |
| 8 · Quitar antes de agregar | 8.5 | Un número que mezcla dos cosas es más que no mostrarlo. |
| 9 · De punta a punta | 9 | Sin deuda, sin stock, en negativo, con error y eligiendo el nombre: diseñados. |
| C1–C5, C7 | 10 | Medidos arriba; la respuesta se dice en voz alta y en texto. |
| C8 · Velocidad | 9 | 177.3 de 180 KB. |
| Oficio visual | 9 | Una columna, cifras tabulares, la misma pieza para las 7 respuestas. |
| **Total** | **8.8** | |

## 4. Los 3 cambios de mayor impacto (esperan OK)

1. **«Tu día» habla solo de hoy.** Las filas pasan de «Cobraste · Te deben, en total · Gastaste y compraste» a «Cobraste (contado y
   abonos) · Fiaste hoy · Gastaste · Compraste fruta». La deuda de todos los días queda en «¿quién me debe?». Arregla la ley 3. Toca qué
   cifras se muestran: es dinero, por eso espera OK. Se verifica con Vitest, el e2e y la prueba ciega.
2. **«dijiste …» bajo el nombre**, como en las tarjetas: «Luis Paredes te debe» con «dijiste «don lucho»» debajo, y lo mismo con la fruta
   («dijiste «piña»»). Arregla la ley 1. Se verifica con el e2e y la prueba ciega.
3. **«Y 1 más. Ver todo el cuaderno» → «Ver a los 6 en Clientes»**, con el mismo nombre que la pestaña de abajo. Arregla la ley 4.

- **Lo que sobra (ley 8):** la fila «Te deben, en total» dentro de «Tu día».
- **Lo que nadie pidió y más importa:** el enlace de «¿cuánto me debe?» lleva a la lista de clientes, no a la ficha de ese cliente,
  porque la ficha no existe todavía (llega en A8).

## 5. Aplicado con OK (31-10)

| Cambio | Antes → después | Verificado |
|---|---|---|
| «Tu día» habla solo de hoy | «Cobraste · Te deben, en total · Gastaste y compraste» → «Cobraste al contado · Te abonaron · Fiaste hoy · Gastaste · Compraste fruta» | Vitest y e2e; a 412 y 360 px ninguna etiqueta se corta («Cobraste (contado y abonos)» se cortaba a 360 y se partió en dos filas) |
| «dijiste …» bajo el nombre | «Luis Paredes te debe» → con «dijiste «don lucho»» debajo; igual con la fruta y con lo elegido de la lista | e2e de deuda y de cliente elegido |
| Enlace a Clientes | «Y 1 más. Ver todo el cuaderno» → «Ver a los 6 en Clientes» (o «Ver en Clientes») | e2e de «quién me debe» |

Capturas `voz-respuesta-{dia,deuda,quien}-despues-{412,360}.png`. Notas nuevas: ley 1 · 8.5 → 9, ley 3 · 7.5 → 9, ley 4 · 8.5 → 9,
ley 8 · 8.5 → 9. **Total 8.8 → 9.1.**
