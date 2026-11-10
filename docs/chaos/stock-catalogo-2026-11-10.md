# /chaos · Stock con el catálogo real (ADR-0016) · 2026-11-10

**Pantalla:** Stock: la lista nueva por fruta, las tarjetas juntas de «Qué hacer hoy», la merma desde la fila y las hojas de Compra y Merma.

**Rama:** `claude/reorganizar-stock-productos-56bd8c` (PR #25).

**Semilla:** 1110.

**Base:** local. Tenía el catálogo real y la demo de dos semanas, y antes de atacar se guardó un volcado. Las invariantes estaban limpias
antes y siguieron limpias después de cada ataque que escribió. Al final se rehízo la base con `db reset` y se recargó la demo.

**Conteo:** 8 ataques, **6 resistieron**, 1 hallazgo nuevo de gravedad 2 y 1 observación que ya estaba antes de este PR.

**Sin probar:** la voz real. `/api/voz` necesita `GROQ_API_KEY`, que esta máquina no tiene. En su lugar se probó que la búsqueda de las
hojas distinga las selecciones (N3).

## Hallazgos

### 1 · Gravedad 2 · Un stock negativo se muestra como «Sin ninguna caja» (nuevo en este PR)

- **Pasos:**
  1. En Stock, abrir la fila de Durazno chileno (5 cajas) y tocar «Se malogró».
  2. Poner 8 cajas y confirmar. La hoja avisa bien: «Según la app solo tenías 5… el stock queda en −3: revísalo cuando puedas».
  3. Volver a Stock.
- **Evidencia:**
  - Base: `select sum(cantidad) from movimientos_stock where producto_id = <durazno>` da **−3.00**.
  - Pantalla: la fruta desaparece de los grupos y sale en «Sin ninguna caja: Albaricoque, …, **Durazno**, …»
    (`stock-catalogo-2026-11-10/x1-sin-ninguna-caja.png`).
  - En «Qué hacer hoy» dice «Durazno chileno cal. 40 · se acabó: compra unas 3 cajas».
  - Invariantes limpias: el negativo está permitido a propósito (`20261031211526_merma_unica_por_comando.sql:10`).
- **Por qué es grave:** la pantalla afirma algo que la base contradice. Un −3 quiere decir que falta registrar una compra o un conteo, y
  «sin cajas» lo esconde. Antes de este PR la fruta tampoco aparecía (la lista filtraba `stock > 0`), pero ahora además se dice algo falso.
- **Causa:** `listaDeStock()` trata `stock <= 0` como «sin cajas» (`lib/inventario-reglas.ts`).
- **Arreglo propuesto (espera OK, toca cómo se muestra el stock):**
  - Un stock negativo no va a «Sin cajas». Se queda como fila en su fruta, con la cifra en el color de la deuda («−3 cajas») y una línea
    que diga qué hacer: «La app cuenta menos de cero: falta registrar una compra».
  - El total del grupo sigue sumando solo lo positivo.
  - Prueba primero: Vitest de `listaDeStock` con stock −3, y el mismo ataque con la semilla 1110.

### Observación · ya estaba antes de este PR · Con el teclado abierto a 360 px, «Listo» queda bajo el borde en la hoja de Compra

- **Pasos:** a 360 × 800 px, Compra → elegir Kiwi Riñón → tocar «Costo de la caja». Se simula el teclado bajando el alto a 420 px.
- **Evidencia:** «Listo» queda en y = 593 con una pantalla de 420 px, y el campo del costo queda en el borde (`stock-catalogo-2026-11-10/r5.png`).
- **Ojo:** es una simulación. En Android, Chrome por defecto no achica la página al abrir el teclado. Hay que confirmarlo en un teléfono
  real antes de tocar la hoja. No entra en la escala de gravedad, porque no escribe nada malo.

## Resistieron

| Ataque | Familia | Resultado |
|---|---|---|
| N1 · «Confirmar merma» 5 veces en el mismo tick, desde la fila de Durazno | Doble toque | Stock 7 → 5, **una** merma. La hoja pregunta «¿Cuántas cajas de Durazno chileno cal. 40?» |
| N2 · Red cortada al confirmar la compra (todo POST abortado) | Red | «La señal no respondió y no sé si se guardó. Toca Confirmar otra vez: no se va a repetir.» 0 compras; al reintentar, **1** compra. Stock de Membrillo 4ta: 0 → 3 |
| N3 · Buscar «membrillo», «manzana verde» y «kiwi» en la hoja | Voz y catálogo | Se distinguen: «Membrillo 4ta / 5ta / 3era», «Manzana Verde Premium cal. 100 / Comercial cal. 80 o 75», «Kiwi Riñón chileno cal. 33 / Cilíndrico americano cal. 23 / Cilíndrico chileno cal. 25 o 27» |
| N4 · Costo «1,299.50» | Entradas hostiles | «Escribe el costo así: 45 o 47.50.» y «Listo» apagado. Nada guardado |
| R1 · Volver atrás con la hoja de merma a medio llenar | Celular | La hoja se cierra y vuelve a «Hoy». Stock de Tuna igual (35) |
| R2 · El contador intenta una merma | Permisos | No ve «Compra», «Merma» ni «Se malogró». El insert directo con su sesión lo rechaza la RLS. 0 filas |
| R3 · Motivo de 5000 letras con emojis (directo como dueño) | Entradas hostiles | Se guarda. «Hoy» a 360 px sin desborde (`scrollWidth` 360). Invariantes limpias |
| R4 · Cajas en 0, negativas o de 10 dígitos | Entradas hostiles | La hoja no tiene campo para escribir cajas, solo − y +. Con 0, «Listo» queda apagado (ya probado en `stock-merma.spec.ts`) |

**Ya cubierto por pruebas que pasan:** dueño y ayudante a la vez en merma y compra (`stock-merma.spec.ts:206`, `stock-compra.spec.ts:241`)
y la sesión vencida al confirmar (`stock-compra.spec.ts:219`).
