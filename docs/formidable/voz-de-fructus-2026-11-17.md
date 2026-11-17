# /formidable · «Voz de Fructus» en la hoja «Más» (2026-11-17)

**Rama:** `claude/friendly-voice-reading-762a6f`. **Quién la usa:** el dueño y el ayudante, en su celular, para que la voz que les lee la venta suene menos a robot. Se usa una vez, o pocas veces: no es una pantalla del día a día.
**Escala:** 1 agente ciego. Las medidas y el escepticismo, con el navegador de Claude.
**Ojo con las voces:** el navegador de la prueba (una Mac) trae las voces de macOS. Para ver cómo podría verse en Android se simularon voces con nombres de código de Android (`es-us-x-esc-local`…). Es una **suposición**: no se ha mirado qué nombres entrega Chrome en el S25 Ultra.

## 1 · Medido (412, 360 y 1280 px)

- **Controles de menos de 48 px:** ninguno, en los tres anchos. Cada voz mide 56 px de alto.
- **Separación entre voces: 4 px**, en los tres anchos. La regla C2 pide 8 px.
- **Desborde horizontal:** ninguno. A 360 px, «Estados Unidos · necesita internet» se parte en dos líneas sin salirse.
- **Contraste:** desde 7.8:1 (el texto suave sobre la superficie); los nombres, 15.9:1. **Letra:** desde 17 px.
- **Al abrir la lista, la lista no se ve:** a 412 × 915 la fila «Voz de Fructus» queda a 1 390 de 1 776 px de la captura, y al tocarla solo asoma la primera voz en el borde de abajo. Hay que bajar con el dedo para ver las demás.
- **Las voces que no están elegidas no parecen botones:** son texto sobre la superficie, sin borde ni fondo. Solo la elegida tiene fondo y el ✓.
- **En la Mac:** 18 voces en español; las 6 primeras son Paulina y 5 voces «de personaje» de Apple (Eddy, Flo, Grandma, Grandpa, Reed), todas «México».
- **En Android (simulado):** los nombres salen como «Voz ESC», «Voz ESD», «Voz SFB»; la misma «Voz ESC» aparece dos veces (sin internet y «necesita internet»).
- **1280 px:** la hoja se centra (440 px de ancho), igual que el resto del menú.
- **Foco visible y movimiento reducido:** los da `app/globals.css` para toda la app.
- **Capturas:** `capturas/voz-de-fructus-2026-11-17/`.

## 2 · Prueba ciega (Observado)

Un agente sin contexto, como el dueño, con 3 capturas a 412 px (voces de Android simuladas). Tarea: «la voz suena a robot, cámbiala por una más amigable».

- **Encuentra la fila:** primero mira «Ajustes», pero ve «Voz de Fructus» con el parlante y la toca. Por un momento duda con «Manos libres» («te leo la venta»).
- **«Voz ESC · Estados Unidos»:** «ESC» le suena a la tecla Escape. «¿Por qué Estados Unidos? Yo estoy en Trujillo». Cree que por eso suena a gringo.
- **La lista:** «parecen placas de carro». No sabe cuál es de hombre o de mujer, ni cuál es peruana. Le confunden las dos «Voz ESC» y las dos «Voz SFB».
- **«Necesita internet»:** no las elegiría, porque en el mercado se va la señal. Teme que la voz se quede callada sin que se entere.
- **Cómo elige:** las tocaría una por una con el celular pegado a la oreja, por el ruido. Si olvida cuál le gustó, tiene que volver a tocarlas todas.
- **Tocar = elegir:** entiende que suena y queda elegida. Le da «un poquito de miedo», pero ve que puede tocar otra.
- **¿Terminó?** Supone que sí, porque el ✓ se mueve y cambia el nombre de arriba, pero extraña un «Guardar». Lo comprobaría dictando una venta.
- **«Texto a voz» del celular:** no lo haría: «se me malogra algo».
- **Resultado:** lo logra con dudas. Facilidad: 6 de 10. Lo que más lo confundió: los nombres en código, repetidos y todos «Estados Unidos».

**Escéptico (cada hallazgo contra la evidencia):**
- Los nombres en código dependen de qué entrega Chrome en el S25 Ultra, y eso **no se ha visto**. El cambio 1 sirve igual con nombres propios, porque solo traduce los que son código.
- «De hombre o de mujer» no se puede mostrar: el navegador no lo dice. Lo que sí se puede es numerarlas y que cada toque suene.
- «Estados Unidos» es un error de etiqueta, no de voz: `es-US` es el español latino neutro de Google, no un acento gringo.
- Las voces que «necesitan internet» contradicen la regla de esta misma obra: la lectura tiene que sonar al instante y sin señal.

## 3 · Nota (0 a 10)

| | Nota | Por qué |
|---|---|---|
| Ley 1 · Sin manual | 6 | Llega a la lista, pero elige a ciegas y no sabe si quedó guardada |
| Ley 2 · Una pregunta | 8 | Una lista, una acción: tocar |
| Ley 3 · Simplicidad | 6 | Los códigos de Android se muestran crudos |
| Ley 4 · Lenguaje | 6 | «ESC», «Estados Unidos» para el español latino |
| Ley 5 · Contenido primero | 7 | El país repetido en cada fila pesa tanto como el nombre |
| Ley 6 · Lo difícil a un toque | 9 | Tocar es oírla |
| Ley 7 · Perdonar | 9 | Tocar otra deshace; no hay nada irreversible |
| Ley 8 · Quitar | 6 | Voces de internet duplicadas; las de juguete de Apple en la lista |
| Ley 9 · Punta a punta | 7 | Al abrir, la lista queda fuera de la vista; sin voces, la fila no aparece |
| Celular (C1 a C8) | 8 | 4 px entre voces (C2 pide 8); lo demás en verde |
| Oficio visual | 7 | Las voces no elegidas no parecen botones |
| **Total** | **7.2** | |

## 4 · Los 3 cambios de mayor impacto (esperan el OK)

1. **Nombres que se entienden y sin voces de internet** (leyes 3, 4 y 8).
   - **Antes:** «Voz ESC · Estados Unidos», «Voz ESC · Estados Unidos · necesita internet».
   - **Después:** los nombres en código se numeran en el orden de la lista: «Voz 1», «Voz 2»… Los nombres propios (Paulina) se quedan. `es-US` se dice «Latinoamérica». Las voces que necesitan internet salen de la lista y de la elección automática; solo se usan si el celular no tiene ninguna otra en español.
   - **Se verifica:** pruebas de `voces-reglas.ts`, y la captura con las voces de Android simuladas.
2. **La lista a la vista y con forma de botón** (ley 9, C2, oficio).
   - **Antes:** al tocar la fila, la lista abre debajo del borde. Entre voz y voz hay 4 px, y las no elegidas son texto suelto.
   - **Después:** al abrir, la hoja baja sola hasta la lista (sin animación si se pidió movimiento reducido). Cada voz es una fila con fondo y un parlante a la derecha que dice «toca y suena». La elegida lleva el ✓. Entre voces, 8 px.
   - **Se verifica:** que la última voz quede a la vista al abrir a 412 y 360 px; separación medida ≥ 8 px.
3. **Decir que quedó** (ley 1).
   - **Antes:** solo se mueve el ✓; el ciego extraña un «Guardar».
   - **Después:** al tocar una voz, la línea de arriba de la lista cambia a «Listo: te leo las ventas con Voz 2», anunciada a lectores de pantalla.
   - **Se verifica:** la línea cambia al tocar; segunda prueba ciega: «¿cómo sabes que quedó?».

**Lo que sobra (ley 8):** las voces de internet (cambio 1). En una Mac, las de personaje (Eddy, Grandma…) se podrían quitar del todo, pero el escritorio no se usa para dictar: quedan al final.

**Lo que nadie pidió y más importa:** abrir el menú en el S25 Ultra y mirar qué voces y qué nombres entrega Chrome. Todo el cambio 1 está hecho sobre una simulación.

**Aparte, sin ejecutar:**
- El ciego no instalaría voces en «Texto a voz». Para el dueño, ese paso lo haría quien le instale la app.

## 5 · Después, con el OK del 2026-11-17

**Lo aplicado:**
1. **Nombres y voces de internet:** los códigos de Android se numeran («Voz 1», «Voz 2»…), `es-US` se dice «Latinoamérica» y las voces que necesitan internet quedan fuera mientras haya alguna sin internet (`etiquetarVoces` y `vocesEnEspanol` en `lib/voz/voces-reglas.ts`, con 15 pruebas).
2. **Lista a la vista y con forma de botón:** al abrir, la hoja baja sola hasta la lista (sin animación si se pidió movimiento reducido). Cada voz tiene borde y fondo, un parlante si no está elegida y el ✓ si lo está. Entre voces, 8 px.
3. **Decir que quedó:** al tocar una voz, la primera línea dice «Listo: te leo las ventas con Voz 3», en verde y anunciada a lectores de pantalla.

**Medido después** (voces de Android simuladas, igual que antes):
- **Separación entre voces:** 8 px en 412, 360 y 1280 px (antes 4).
- **Al abrir:** la lista queda entera a la vista, a 412 px (de 360 a 915) y a 360 px (de 221 a 800). Antes solo asomaba la primera voz.
- **Contraste:** al medir con la transparencia del fondo, el país de la voz elegida daba 5.9:1 sobre su verde (la primera medición no contaba la transparencia). Ahora va en el texto pleno, y el mínimo de la lista es 7.1:1.
- **Controles chicos y desborde:** ninguno, en los tres anchos.
- **Al tocar «Voz 3»:** dice la frase de prueba con esa voz (velocidad y tono 1.05) y la guarda en el celular.
- **Capturas:** las que empiezan con `despues-` en `capturas/voz-de-fructus-2026-11-17/`. Mismo ancho que antes: `412-al-abrir-android-simulada.jpg` → `despues-412-al-abrir.jpg`.

**Segunda prueba ciega:** 6 → **7 de 10**.
- **Ya sabe que quedó:** «por el "Listo: te leo las ventas con Voz 3" en verde, el check y porque arriba ya dice "Voz 3"».
- **Ya no le confunden** los códigos repetidos ni «Estados Unidos». Descarta las de España («yo quiero una que hable como acá»).
- **Sigue extrañando** saber si cada voz es de hombre o de mujer y cómo suena. El navegador no lo dice: solo se puede oír.
- **Nuevo:** la voz elegida ya no muestra el parlante y no sabe cómo volver a oírla. Tocarla sí la vuelve a decir, pero no se nota.
- **Le sigue dando un poco de miedo** que oírla ya la deje elegida, aunque el «Listo» lo tranquiliza.

**Nota:** ley 1 de 6 a 7, ley 3 de 6 a 8, ley 4 de 6 a 8, ley 8 de 6 a 7, ley 9 de 7 a 8, celular de 8 a 9, oficio de 7 a 8. **Total: 7.2 → 7.9.**

**Queda (sin ejecutar):**
- Que la voz elegida muestre el parlante junto al ✓, para que se note que tocarla la vuelve a decir.
- Mirar en el S25 Ultra qué nombres de voz entrega Chrome de verdad.
