---
name: formidable
description: Lleva una pantalla o una hoja de Fructus al nivel «se entiende en 5 segundos, con una mano, al sol» — el dueño del puesto sabe qué es, qué pasó y qué le toca hacer, sin manual, y además se ve impecable. Mide en el navegador a 412 y 360 px, la hace recorrer a un agente ciego sin contexto, la califica contra las 9 leyes de comprensión, las 8 reglas del celular y el oficio visual, y propone los 3 cambios de mayor impacto antes de tocar nada. Úsala al terminar o rediseñar cualquier pantalla u hoja (es obligatoria), y cuando digan «formidable», «no se entiende», «muy cargada», «se ve feo» o «que sea como un iPhone». Con `rapido` solo mide.
---

Lleva a nivel Formidable: $ARGUMENTS   (una ruta como `/clientes`, una hoja, o nada = lo que se está construyendo)

Viene de la skill `/formidable` de CAYLA Retail. Allá manda el escritorio y el celular se adapta. **Aquí es al revés: manda el celular.**
Referente: una app de iPhone que el dueño entiende de pie, con una jaba en la otra mano y a pleno sol.

## Candados

1. **Analiza → propone → espera el OK → implementa.** Nada cambia sin que quien dirige el proyecto lo vea.
2. **Dinero y precios, stock, permisos y comprobantes esperan siempre el OK**, aunque la propuesta sea «solo visual».
3. **Respeta los tokens de `app/globals.css` y las piezas de `components/ui/`.** Si algo no encaja, propone cambiar la pieza (o un ADR); no inventas un estilo local.
4. **Nada optimista en dinero ni stock.** Deshacer vale solo para estado de interfaz.

## Las 9 leyes (el orden es la prioridad si dos chocan)

1. **Sin manual:** alguien nuevo la completa a la primera.
2. **Una pregunta, una respuesta:** un protagonista y una acción principal.
3. **Simplicidad profunda:** la complejidad se traduce a un veredicto («don Lucho te debe S/ 230»), no se esconde ni se muestra cruda.
4. **Lenguaje de puesto:** «tú», peruano neutro, frases cortas, cero jerga.
5. **Contenido primero:** la fruta, el cliente y el dinero pesan más que los marcos.
6. **Lo difícil, a un toque:** el «¿por qué?» vive detrás de un toque, nunca de un hover.
7. **Perdonar antes que preguntar:** se confirma solo lo irreversible; lo reversible ofrece Deshacer.
8. **Quitar antes de agregar.**
9. **De punta a punta:** vacíos, errores, primer uso, carga y 360 px.

## Las 8 reglas del celular (CLAUDE.md «Celular primero»)

Se miden, no se opinan:
- **C1 · Pulgar:** la acción principal está en el tercio de abajo.
- **C2 · Tamaño:** controles de 48 × 48 px como mínimo, con 8 px de separación.
- **C3 · Sol:** contraste de 7:1 en cifras y textos clave, texto base de 17 px o más, cifras de 28 px o más con `tabular-nums`.
- **C4 · Bordes:** sin scroll horizontal, respeta `safe-area`, el teclado no tapa la acción.
- **C5 · Hojas:** en celular, todo diálogo es una hoja que sube desde abajo (`<Hoja>`).
- **C6 · Navegación:** la barra de abajo tiene 4 destinos como máximo.
- **C7 · Señal:** el color nunca es la única señal; al confirmar hay vibración y sonido.
- **C8 · Velocidad:** el JavaScript de la ruta está dentro del presupuesto y la interacción responde en menos de 200 ms.

## Oficio visual (nota aparte, se mide en el navegador)

- Alineación a la grilla y espaciado en múltiplos de 4.
- Jerarquía con un solo protagonista.
- Una sola pieza por función (dos «Confirmar» distintos es un hallazgo).
- Tipografía: una familia, cifras tabulares.
- Foco visible y orden de tabulación lógico.
- Movimiento sin rebote que respeta `prefers-reduced-motion`.

## Método

Cada dato lleva su etiqueta: **Medido** / **Observado** / **Opinión**. Sin evidencia no hay nota.

0. **Terreno.**
   - Haz `git fetch origin`.
   - Lee la finalidad de la pantalla en `docs/` y en `CLAUDE.md`, nunca de la captura.
   - Anota quién la usa: el dueño en el celular, o el administrador o el contador en escritorio.
1. **Medir** (Medido). Abre la pantalla en el navegador a **412 × 915**, luego a **360 × 800** y por último a **1280 × 800**. Con `javascript_tool` mide:
   - el tamaño de cada control interactivo (lista los menores de 48 px);
   - el contraste de los textos clave;
   - el desborde horizontal;
   - la posición vertical de la acción principal;
   - las fuentes y colores que no salen de tokens.

   Toma capturas en cada ancho, sin animaciones a medias. Si hay Playwright, corre la prueba e2e de la ruta.
2. **Prueba ciega** (Observado). Un agente sin contexto recibe solo la captura a 412 px y una tarea («registra que don Lucho te pagó 100»). Observa lo que **hace**, no lo que opina: dónde duda, qué toca primero, qué no encuentra. Si se puede, repítelo con una persona real.
3. **Calificar.** Pon una nota de 0 a 10 a cada ley, a cada regla del celular y al oficio visual, y una nota total.
4. **Proponer los 3 cambios de mayor impacto** (no 12). Cada uno con «antes → después», qué ley o regla arregla y cómo se verifica. Agrega una línea de «lo que sobra» (ley 8) y una de «lo que nadie pidió y más importa». El resto va a una lista aparte, sin ejecutar.
5. **Esperar el OK.** Con él: implementa, vuelve a medir y entrega las capturas **antes y después al mismo ancho** con las notas nuevas.

**Costo:** hasta 3 agentes (medidor, ciego, escéptico que intenta refutar cada hallazgo). **Avisa la escala antes de lanzarlos.** Con `rapido` solo corre el paso 1, sin agentes.

## Salida

- El informe va en `docs/formidable/<slug>-AAAA-MM-DD.md`. Es historial: no se sobrescribe.
- Su fila va en `docs/formidable/README.md`, que es el tablero por pantalla.
- Una pantalla no es Formidable porque sus hojas lo sean, ni al revés.
