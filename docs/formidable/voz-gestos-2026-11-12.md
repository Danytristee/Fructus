# /formidable · Botón de voz: toque, candado y X (2026-11-12)

**Pantalla:** el orbe de «Hoy» con sus tres modos: mantener, tocar para escuchar y tocar para enviar, y deslizar al candado. **Quién:** el dueño y el ayudante en el celular, con una caja en la otra mano. **Capturas:** `capturas/voz-gestos-2026-11-12/` (en reposo, manteniendo y bloqueado, a 412, 360 y 1280 px).

## Medido

- **Controles:** orbe de 104 px (114 px escuchando) y X de 56 × 56 px a 20 px del orbe. Ninguno bajo 48 px.
- **Pulgar:** el orbe está en el tercio de abajo en los tres anchos (y = 795 de 915, 680 de 800, 664 de 800).
- **Contraste:**
  - la etiqueta tiene 11.2:1 a 17 px;
  - «Sube» tiene 15.8:1 sobre el vidrio (calculado con los tokens; el medidor automático no leyó el fondo translúcido), pero a **13 px**, bajo el mínimo de 17.
- **Desborde horizontal:** 0 en los tres anchos y los tres estados.
- **Movimiento:** solo `transform` y `opacity`: el candado se mueve con `translateY` y la barra se aparta con opacidad. `animate-subir` respeta `prefers-reduced-motion` por la regla global.

## Observado (prueba a ciegas, 1 agente, solo con las capturas a 412 px)

1. **Grabar sin dejar el dedo:** tocó el orbe. Dudó **un poco**: no sabe si un toque graba hasta otro toque o por un rato fijo.
2. **Levantar el dedo sin cortar:** dudó **un poco, casi mucho**. La flecha y «Sube» apuntan arriba, pero la píldora está **a la derecha**: no supo si subir recto o en diagonal, ni cuánto.
3. **Enviar:** tocó el orbe, por «toca para enviar». Dudó **un poco**: el orbe sigue con las mismas ondas, sin nada que diga «enviar».
4. **Que no se guarde nada:** tocó la X. Dudó **un poco**: la X no dice si borra o solo cierra, y teme tocar el orbe por error.
5. **Barra apartada:** entendió que se esconde para no tocarla sin querer y no le preocupó.

Lo demás que notó y no es de este cambio:
- Los montos se movían entre capturas: la animación de las cifras de «Hoy» y las pruebas de otra sesión escribiendo en la misma base.
- La «N» abajo a la izquierda es el indicador de desarrollo de Next y no existe en producción.
- La etiqueta flotando sobre las tarjetas ya estaba así (/formidable de «Hoy», 2026-10-28).

## Notas (0–10)

| Ley o regla | Nota | Por qué |
|---|---|---|
| 1 · Sin manual | 7 | Tocar y enviar sale a la primera; el candado confunde la dirección. |
| 2 · Una pregunta, una respuesta | 9 | Un protagonista: el orbe. |
| 3 · Simplicidad profunda | 8 | Los tres modos conviven sin pedir elegir. |
| 4 · Lenguaje de puesto | 8 | «Toca para enviar» y «Sube» son cortos; a la X le falta palabra. |
| 6 · Lo difícil, a un toque | 9 | |
| 7 · Perdonar antes que preguntar | 9 | Cancelar no pregunta y mantener sigue igual. |
| 9 · De punta a punta | 8 | Sin permiso y sin señal se dicen bien (/chaos); bloqueado no se ve distinto. |
| C1 Pulgar · C2 Tamaño · C4 Bordes | 10 · 10 · 10 | Medido. |
| C3 Sol | 8 | «Sube» a 13 px. |
| C7 Señal | 7 | El estado «bloqueado» solo se dice con texto; el orbe se ve igual que manteniendo. |
| Oficio visual | 8 | La X y el candado son simétricos; el candado no está en la dirección del gesto. |
| **Total** | **8.4** | |

## Los 3 cambios de mayor impacto (esperan OK)

1. **El candado, arriba del orbe y no al lado (ley 1, oficio).**
   - **Antes:** la píldora está a la derecha con «Sube ^», y la prueba ciega no supo hacia dónde ir.
   - **Después:** la píldora va justo encima del orbe, en la dirección del gesto, como en WhatsApp. La etiqueta de «Te escucho…» se corre a su lado mientras se mantiene, y bloquea al llegar a la píldora.
   - **Se verifica:** con la e2e del deslizamiento y una prueba ciega nueva.
2. **Bloqueado se ve distinto: el orbe dice «Enviar» (C7, ley 1).**
   - **Antes:** las mismas ondas que manteniendo.
   - **Después:** escuchando sin el dedo, el orbe muestra una flecha de enviar con la palabra «Enviar», y las ondas siguen en los anillos de alrededor. La etiqueta queda en «Te escucho 0:03».
   - **Se verifica:** con una captura y la e2e del toque.
3. **La X dice qué hace: «Borrar» (ley 4, ley 1).**
   - **Antes:** un círculo con X, sin palabra.
   - **Después:** una píldora con X y «Borrar», con el mismo alto de 56 px. Cabe a 360 px: va del borde (16 px) al orbe (123 px).
   - **Se verifica:** midiendo los anchos a 360 px.

**Lo que sobra (ley 8):** con el candado arriba, la palabra «Sube» sobra: la flecha y el candado en la dirección del dedo bastan. Hay que comprobarlo con la prueba ciega.

**Lo que nadie pidió y más importa:** el micrófono que queda prendido tras varios toques seguidos (`docs/chaos/voz-gestos-2026-11-12.md`). No se ve en ninguna captura y es lo más grave de esta pasada.

## Aparte, sin ejecutar

- `#voz-texto` en reposo no dice qué hace un toque («Toca o mantén para hablar»). Una vez tocado, la etiqueta lo explica; no vale otra palabra.
- Probar el umbral de 80 px y el toque de 300 ms en un celular real.

## Después del OK (aplicado el mismo día)

| Cambio | Antes → después | Medido |
|---|---|---|
| 1 · Candado arriba | Píldora a la derecha con «Sube» → píldora con candado y flecha justo encima del orbe. Bloquea al llegar a ella (`SUBIDA_PARA_BLOQUEAR` = 94 px). | Centro del candado alineado con el orbe (x 206 = 206 a 412 px) y a 95 px por encima. «Sube», de 13 px, ya no está. |
| 2 · El orbe dice «Enviar» | Las mismas ondas que manteniendo → flecha y «Enviar» a 17 px; los anillos siguen. La etiqueta queda en «Te escucho… 0:03». | «Enviar» a 17 px. Nombre accesible: «Enviar lo que dijiste». |
| 3 · «Borrar» con palabra | X sin texto a la izquierda del orbe → «× Borrar» junto a la etiqueta, arriba y lejos del orbe. | 108 × 48 px. Desborde 0 a 412, 360 y 1280. |

**Desvío de la propuesta:** «Borrar» no quedó a la izquierda del orbe sino junto a la etiqueta. A 360 px una píldora con palabra no cabía a la izquierda del orbe sin pasar el borde de 16 px, y arriba además queda más lejos del pulgar que va a enviar, que era la otra duda de la prueba ciega.

**Además:** el largo del toque se mide con `e.timeStamp` y no con la hora del manejador. Bajo carga, un «mantener» de 0.4 s se tomaba por un toque (falló una vez `voz.spec.ts`, «la etiqueta enseña…»).

**Capturas:** `4-despues-*`, `5-despues-*` y `6-despues-*` a 412, 360 y 1280 px, junto a `1-`, `2-` y `3-` (antes).

### Segunda prueba a ciegas (mismas tareas, capturas nuevas)

| Tarea | Antes | Después |
|---|---|---|
| 1 · Grabar sin dejar el dedo | un poco | un poco (no sabe cómo termina hasta tocar) |
| 2 · Levantar el dedo sin cortar | un poco, casi mucho (no supo la dirección) | un poco: subió al candado, «igual que en WhatsApp» |
| 3 · Enviar | un poco | **nada**: «el orbe dice Enviar» |
| 4 · Que no se guarde nada | un poco (X sin palabra) | un poco: «Borrar» se entiende; duda si pide confirmación |
| 5 · Barra apartada | no preocupa | no preocupa |

**Nota:** 8.4 → **8.9**. Ley 1 de 7 a 8, C3 de 8 a 10 y C7 de 7 a 9.

**Queda, sin ejecutar:**
- El candado no tiene palabra: quien no conoce WhatsApp lo adivina por la flecha.
- La etiqueta en reposo no dice cómo se termina.
- «Borrar» no avisa que no hay Deshacer. Hoy no hace falta: no se guardó nada.
