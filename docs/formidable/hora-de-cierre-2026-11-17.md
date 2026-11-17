# /formidable · Hoja «Hora de cierre» de Ajustes · 2026-11-17

- **Qué es:** un renglón arriba de Ajustes que abre una hoja con las 16 horas posibles. Con un toque se elige a qué hora le llega a cada teléfono el resumen del día (ADR-0023).
- **Quién la usa:** el dueño, en el celular, una vez y rara vez después. El administrador también puede, en escritorio.
- **Rama:** `claude/configurable-closing-time-b772ab`. Medido en el navegador a 412 × 915, 360 × 800 y 1280 × 800. Hubo una prueba a ciegas con un agente; no hubo escéptico.
- **Capturas:** `capturas/hora-de-cierre-2026-11-17/`.

## Medido

| | 412 × 915 | 360 × 800 | 1280 × 800 |
|---|---|---|---|
| Controles menores de 48 px | 0 (renglón de 100 px, horas de 92 × 56) | 0 (horas de 76 × 56) | 0 |
| Separación entre horas | 8 px | 8 px | 8 px |
| Desborde horizontal | no | no | no |
| Texto cortado en una hora | no | no (con «✓» al lado, «11 p. m.» se salía 9 px; el visto se pasó a la esquina) | no |
| Contraste más bajo | 7.1:1 (texto de la hoja) | 7.1:1 | — |
| Texto | 17 px; título 23 px; Manrope | igual | igual |
| Dónde están las horas | de 640 a 888 (tercio de abajo desde 610) | de 495 a 784 (tercio de abajo desde 533: la 1.ª fila queda apenas arriba) | hoja centrada de 440 px |
| Movimiento | `hoja-sube` (el de todas las hojas) | igual | `hoja-aparece` |

- e2e `hora-de-cierre.spec.ts` en verde a 412 y 360 px.
- **Sin medir:** el presupuesto de JS de la ruta (C8). Ajustes no es «Hoy» y la hoja no carga librerías nuevas.

## Prueba a ciegas (observado)

**Tarea:** «Tu puesto cierra a las 4 de la tarde. Haz que el resumen del día te llegue a esa hora.»

- **Renglón:** lo encontró sin dudar («es lo único que habla de hora»).
- **Hoja:** tocaría «4 p. m.». Creyó que se guardaba sola, «con un poco de duda». Entendió el visto en «7 p. m.» como la hora puesta.
- **Para salir sin cambiar nada:** tocaría fuera o bajaría la hoja; no hay «Cerrar».
- **Después de guardar:** entendió «Hoy ya pasó esa hora: empieza mañana», pero preguntó **«si yo quería el resumen hoy, no sé cómo lo consigo»**.
- **Seguridad:** 8 de 10.
- **La duda más grande:** si «dentro de esa hora, no en punto» quiere decir que le puede llegar a las 4:50, cuando ya está cerrando.

## Notas (0 a 10)

| Ley o regla | Nota | Por qué |
|---|---|---|
| 1 · Sin manual | 9 | El ciego hizo la tarea a la primera. |
| 2 · Una pregunta, una respuesta | 9 | El título es la pregunta y las horas son las respuestas. |
| 3 · Simplicidad profunda | 7 | «Llega dentro de esa hora, no en punto» muestra el límite técnico crudo, no un veredicto («te llega entre las 4 y las 5»). |
| 4 · Lenguaje de puesto | 8 | Claro. «No en punto» le sonó a que llega tarde. |
| 5 · Contenido primero | 9 | Las horas son lo único grande. |
| 6 · Lo difícil a un toque | 8 | Sin «¿por qué?» necesario. |
| 7 · Perdonar antes que preguntar | 8 | Reversible, sin confirmar. |
| 8 · Quitar antes de agregar | 8 | El subtítulo de Ajustes («…y tu hora de cierre») ahora ocupa 2 líneas. |
| 9 · De punta a punta | 6 | Si no se guarda, el aviso queda detrás de la hoja (`/chaos` 2026-11-17). «Empieza mañana» no dice dónde ver el día de hoy. |
| C1 Pulgar | 9 | Las horas están en el tercio de abajo (a 360 px, la 1.ª fila apenas arriba). |
| C2 Tamaño | 10 | 56 px de alto y 8 px de separación. |
| C3 Sol | 9 | 7.1:1 como mínimo y 17 px. |
| C4 Bordes | 10 | Sin desborde; la hoja respeta `safe-area`. |
| C5 Hojas | 10 | Usa `<Hoja>`. |
| C6 Navegación | 10 | No la toca. |
| C7 Señal | 8 | El color no es la única señal (relleno y visto) y vibra al guardar, pero no suena. |
| C8 Velocidad | — | Sin medir. |
| Oficio visual | 8.5 | Grilla de 4 y múltiplos de 4. El visto en la esquina es una pieza nueva: si se repite en otra pantalla, va a `components/ui/`. |
| **Total** | **8.5** | |

## Los 3 cambios de mayor impacto (esperan OK)

1. **Si no se guarda, decirlo dentro de la hoja** (ley 9, `/chaos` hallazgo 1).
   - **Antes:** la hoja queda abierta, nada cambia y el aviso sale atrás, atenuado.
   - **Después:** el aviso rojo sale dentro de la hoja, debajo de las horas. Con la sesión vencida, lleva «Entrar».
   - **Se verifica con** el ataque de red cortada (semilla 1117) y una e2e que espera el aviso dentro del diálogo.
2. **Traducir «dentro de esa hora» a un veredicto** (ley 3; la duda más grande del ciego).
   - **Antes:** «Llega dentro de esa hora, no en punto.»
   - **Después:** debajo de las horas, con la hora marcada: «Te llega entre las 4 y las 5 p. m.». Al guardar: «Listo: el resumen te llega entre las 4 y las 5 p. m.».
   - El renglón sigue diciendo «como a las 4 p. m.», que es corto.
   - **Se verifica con** Vitest (texto de cada hora, 11 p. m. → «entre las 11 p. m. y las 12 de la noche») y otra prueba a ciegas.
3. **«Empieza mañana» con salida** (leyes 9 y 6; la otra duda del ciego).
   - **Antes:** «Hoy ya pasó esa hora: empieza mañana.»
   - **Después:** el mismo texto más un enlace «Ver el cierre de hoy» que lleva a `/cierre`, donde están las mismas cifras y el botón de WhatsApp.
   - **Se verifica con** e2e: guardar una hora que ya pasó, tocar el enlace y llegar a «Cierre».

- **Lo que sobra (ley 8):** el subtítulo de Ajustes «Tu catálogo, tu equipo y tu hora de cierre» pasa a dos líneas. Puede volver a «Tu catálogo y tu equipo»: el renglón ya dice «Hora de cierre».
- **Lo que nadie pidió y más importa (opinión):** el dueño elige la hora «para cada teléfono», pero no sabe en cuántos teléfonos está activado el aviso. Una línea como «Le llega a 2 teléfonos» le diría si sus ayudantes lo reciben.

## Aparte, sin ejecutar

- La hoja no tiene «Cerrar»: se cierra tocando fuera, bajándola o tocando la hora ya marcada. Es igual que las demás hojas de opciones; no se cambia sola.
- Al guardar no suena nada (C7 pide vibración y sonido al confirmar). Es un ajuste, no dinero: queda a criterio.
- A 360 px la 1.ª fila de horas empieza 38 px arriba del tercio de abajo.
