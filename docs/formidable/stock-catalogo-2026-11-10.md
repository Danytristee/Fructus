# /formidable · Stock con el catálogo real (ADR-0016) · 2026-11-10

**Para quién:** el dueño y el ayudante, en el celular, de pie y al sol. El administrador lo mira en escritorio.

**Finalidad:** cajas por fruta, qué hacer hoy con el stock, y mermas y compras a mano (`docs/PROMPT-INICIAL.md`, A8; CLAUDE.md).

**Rama:** `claude/reorganizar-stock-productos-56bd8c` (PR #25).

**Datos:** catálogo real (58 productos) con `historia-demo.sql` y `dia-demo.sql`. Quedan 17 frutas con cajas, 538 cajas y 10 alertas.

**Pasada:** se midió a 412, 360 y 1280 px y se hizo una prueba ciega con un agente. No hubo escéptico. Las capturas de antes están en
`capturas/stock-catalogo-2026-11-10/`.

## 1. Medido

| | 412 | 360 | 1280 |
|---|---|---|---|
| Controles menores de 48 px | 0 | 0 | 0 |
| Desborde horizontal | 0 | 0 | 0 |
| Fuentes | solo Manrope | solo Manrope | solo Manrope |
| Contraste menor de 4.5:1 | 0 * | 0 * | 0 |
| Textos entre 4.5 y 7:1 | 4 (etiquetas del detalle plegado, 6.9:1) | 4 | 4 |
| Textos de menos de 15 px | insignias «Hoy»/«Pronto» y números de los filtros (14 px) | igual | igual |
| «Compra» / «Merma», desde arriba | 83 % | 81 % | 4 % (arriba, ADR-0015) |
| **Dónde empieza «Tu stock»** | **3 271 px = 3.6 pantallas** | **3 662 px = 4.6 pantallas** | a la derecha (dos columnas) |
| Alto de cada tarjeta de «Qué hacer hoy» | 183–298 px (10 tarjetas) | 227–342 px | — |
| La misma recomendación repetida | «No compres más hasta que baje…» × 6 | × 6 | × 6 |

\* El título blanco «Stock» da 1:1 en el medidor porque va sobre un degradado, que el medidor no lee. Es un falso positivo.

## 2. Prueba ciega

Un agente sin contexto recibió solo las capturas a 412 px (la pantalla inicial y la página entera) y cuatro tareas.

| Tarea | Nota | Qué pasó |
|---|---|---|
| A · «¿Te queda manzana verde premium? ¿Cuántas?» | **4** | Deslizó «mucho». No la encontró y respondió con dudas: «no sé si no existe o si es la Comercial con otro nombre». Tiene 0 cajas, y la lista solo muestra lo que tiene stock. |
| B · Registrar 2 cajas de durazno malogradas | 6 | Tocó «Merma» flotante. Dudó porque las píldoras tapan la primera tarjeta y el durazno está al fondo. |
| C · Lo más urgente, en 5 segundos | 5 | Acertó (caqui), pero dijo: «“6 de 17 urgentes”, “1 por malograrse” y el filtro “Por malograrse 2” no cuadran; casi todas dicen Hoy, todo parece urgente». |
| D · Cajas de kiwi y de qué tipo | 7 | Respondió bien: 111 = 78 Cilíndrico + 33 Riñón. Le estorbaron las tarjetas «Te sobra Kiwi…», que repiten datos. |

En sus palabras, lo que más confunde: las cifras de urgencia que no cuadran, la frase repetida en las tarjetas, una pantalla «larguísima»
y los nombres largos (marcas y calibres). Lo que se lee bien: «538 cajas» y «S/ 66,962.00».

## 3. Notas

**Leyes:**

| Ley | Nota | Por qué |
|---|---|---|
| 1 · Sin manual | 6 | La tarea A falla sin ayuda. |
| 2 · Una pregunta, una respuesta | 5 | Dos protagonistas: 10 alertas tapan la lista, a 3.6 pantallas. |
| 3 · Simplicidad profunda | 5 | Tres cifras de urgencia que no cuadran; la misma frase 6 veces. |
| 4 · Lenguaje de puesto | 7 | Marcas y calibres en los títulos de las alertas («cal. 25 o 27»). |
| 5 · Contenido primero | 7 | — |
| 6 · Lo difícil, a un toque | 8 | — |
| 7 · Perdonar antes que preguntar | 8 | — |
| 8 · Quitar antes de agregar | 5 | — |
| 9 · De punta a punta | 6 | Lo que tiene 0 cajas no se ve. |

**Reglas del celular:** C1 9 · C2 10 · C3 8 (insignias a 14 px) · C4 10 · C5 9 · C6 10 · C7 8 · C8 sin medir (el JavaScript de la
ruta no se midió en esta pasada).

**Oficio visual:** 8.

**Nota total: 7.2.**

## 4. Los 3 cambios de mayor impacto (esperan OK)

1. **«Qué hacer hoy» en tres tarjetas; el resto, a un toque, y las repetidas juntas.**
   - **Antes:** 10 tarjetas de 183–342 px cada una, «Tu stock» a 3.6 pantallas (4.6 a 360 px) y la frase «No compres más…» seis veces.
   - **Después:**
     - Las alertas del mismo tipo y gravedad se juntan en una tarjeta con una sola recomendación: «Te sobran 4 frutas: Kiwi Cilíndrico
       chileno (72 de más), Tuna (12), Piña (8), Durazno chileno (6)».
     - Se ven las 3 primeras y debajo va «Ver las otras N».
     - Meta: «Tu stock» a menos de 1.5 pantallas a 412 px.
   - **Arregla:** leyes 2, 3, 8 y 9.
   - **Se verifica:** midiendo `#tu-stock` a 412 y 360 px, con Vitest de la regla que junta las alertas
     (`lib/inventario-reglas.ts`, `priorizarAlertas`) y con e2e de los filtros.
2. **Las cifras de urgencia cuadran.**
   - **Antes:** el anillo dice «6 de 17 urgentes», el recuadro «1 por malograrse» y el filtro «Por malograrse 2».
   - **Después:** el recuadro y el filtro cuentan lo mismo, las frutas de ese tipo. El anillo sigue contando solo lo que dice «Hoy»
     (decisión de bosque-2026-11-09), y el recuadro lo aclara con «1 hoy, 1 pronto» cuando no son iguales.
   - **Arregla:** leyes 1 y 3.
   - **Se verifica:** con Vitest de `resumirInventario` y con una captura.
3. **Lo que no tienes también se ve.**
   - **Antes:** las variedades con 0 cajas no aparecen. «¿Te queda manzana verde premium?» queda sin respuesta.
   - **Después:** al pie de cada fruta, una línea chica «Sin cajas: Verde Premium, Roja americana Premium cal. 113». No va una fila por
     cada una, para no alargar la lista.
   - **Arregla:** leyes 1 y 9, y la tarea A de la prueba ciega.
   - **Se verifica:** con la prueba ciega repetida sobre la tarea A, y con Vitest de `agruparPorFruta` con stock 0.

**Lo que sobra (ley 8):** el calibre en el título de una alerta («Te sobra Kiwi Cilíndrico chileno cal. 25 o 27») cuando ningún otro
producto activo tiene ese mismo nombre sin calibre. Hoy solo hace falta para la Manzana Roja americana Premium.

**Lo que nadie pidió y más importa:** con 58 productos, buscar dentro de «Tu stock». Esto queda para después de los 3 cambios: con
«Qué hacer hoy» corto y las frutas sin cajas a la vista, puede que ya no haga falta.

## 5. Aparte, sin ejecutar

- Insignias «Hoy» y «Pronto» y números de los filtros a 14 px (ya anotado el 2026-11-05).
- Los filtros ocupan 3 filas a 412 px y empujan lo útil hacia abajo. Con el cambio 1 hay menos tipos a la vista.
- Las píldoras «Compra» y «Merma» tapan el texto de la primera tarjeta en la pantalla inicial. Es el patrón elegido; se revisa si el ciego
  vuelve a fallar ahí.

## 6. Después (aplicado con OK del 2026-11-10)

**Qué se hizo:**
- **Cambio 1:** `juntarAlertas()` junta las alertas del mismo tipo y urgencia en una tarjeta. Cada fruta lleva su dato corto («72 cajas de
  más») y la tarjeta, una sola recomendación. En «Todas» se ven 3 tarjetas, y el resto va detrás de «Ver N avisos más». Con un filtro se
  ven todas.
- **Cambio 2:** cada recuadro cuenta lo mismo que su filtro (`resumen.porTipo`) y, si no todas son para hoy, lo dice en rojo: «1 hoy».
- **Cambio 3:** `listaDeStock()` agrega al pie de cada fruta la línea «Sin cajas: Verde Premium, …» (con el calibre solo si dos se llaman
  igual) y, al final, una tarjeta «Sin ninguna caja» con las frutas que no tienen ninguna.

**Medido:**

| | Antes | Después |
|---|---|---|
| Dónde empieza «Tu stock» a 412 px | 3.6 pantallas | **1.6 pantallas** (la meta era menos de 1.5: no se llegó) |
| Dónde empieza «Tu stock» a 360 px | 4.6 pantallas | **2.1 pantallas** |
| Tarjetas en «Qué hacer hoy» | 10 | 3, más «Ver 4 avisos más» |
| La misma recomendación repetida | × 6 | ninguna |
| Recuadro «por malograrse» y su filtro | 1 / 2 | 2 / 2, con «1 hoy» |
| Controles menores de 48 px, desborde y fuentes (412, 360 y 1280) | 0, 0, Manrope | 0, 0, Manrope |

**Prueba ciega repetida** (otro agente, mismas tareas y capturas de después):

| Tarea | Antes | Después | Lo que dijo |
|---|---|---|---|
| A · ¿Te queda manzana verde premium? | 4 | **6** | «No te queda, 0 cajas; tienes la Verde Comercial, 39». Le costó porque el «no» está en una línea gris. |
| B · Merma de durazno | 6 | 7 | — |
| C · Lo más urgente | 5 | 6 | Acierta. Todavía no cuadra «6 de 17 urgentes» con 2 + 1 + 6 = 9, ni con «Todas 10». |
| D · Kiwi | 7 | **9** | «Fue fácil porque el total está en el encabezado del grupo». |

**Pruebas:**
- `lib/inventario-reglas.test.ts`: 20 pruebas, 6 de ellas nuevas (juntar, recuadros que cuadran, sin cajas y su calibre).
- E2e de Stock, auditoría visual, escritorio y consultas por voz: pasan.
- `stock-tablero.spec.ts` ahora cuenta frutas, no tarjetas. Lee los productos de cada tarjeta (`data-productos`) y abre «Ver avisos más».
  Pasa con el seed y con la demo.
- Invariantes limpias.

**Notas después:**
- Leyes: 1 · 7, 2 · 7, 3 · 6, 4 · 7, 5 · 7, 6 · 8, 7 · 8, 8 · 7, 9 · 8.
- Celular: igual que antes.
- Oficio: 8.
- **Nota total: 7.2 → 7.7.**

**Lo que queda** (sin ejecutar):
- **Las cifras de arriba cuentan cosas distintas.** El anillo cuenta frutas para hoy (6), los recuadros cuentan frutas por tipo (2 + 1 + 6)
  y «Todas» cuenta avisos (10). El ciego sigue sin saber cuál creer. La salida más simple es que «Todas» no lleve número.
- **La línea «Sin cajas» se lee como pie de página.** Podría ir en texto normal en vez de gris.
- **«Tu stock» a 1.6 pantallas.** Para llegar a menos de 1.5 habría que mostrar 2 tarjetas en vez de 3.
- **El calibre en los títulos de las alertas** («Kiwi Cilíndrico chileno cal. 25 o 27») sigue: es «lo que sobra» de la sección 4.

