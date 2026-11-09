# /chaos · Escritorio: tablas de Clientes y Ventas, panel lateral · 2026-11-09

- **Qué se ataca:** la tabla del cuaderno, la de ventas y el panel lateral, a 1280 px. Las tablas no guardan, pero abren las hojas que sí guardan. Esas hojas no cambiaron y ya pasaron `/chaos` (`bosque-2026-11-09.md`).
- **Rama:** `claude/escritorio-bosque` · **Semilla:** 1110 · **Base:** local, con respaldo `pg_dump` antes y `db reset` al final. Las invariantes quedaron limpias.
- **Conteo:** 6 ataques. **4 resistieron y hay 2 hallazgos.**

## Hallazgos

### G3 · Un nombre de 120 letras sin espacios ensancha la tabla de Clientes, y aparece scroll horizontal

- **Cómo repetirlo:** crea un cliente con un nombre de 120 caracteres sin espacios (por ejemplo `<b>Raro&Co</b>XXXX…`) y con deuda. Después abre `/clientes` a 1280 px.
- **Lo que pasa:** la pantalla mide 447 px más que la ventana. No se pierde ningún dato: el saldo quedó bien guardado (S/ 99,999.99), las invariantes están limpias y el `<b>` sale como texto, no como negrita. Pero hay que deslizar de lado para ver «Te debe».
- **Causa:** la tabla usa el ancho automático: una palabra que no se puede partir estira su columna, aunque el nombre tenga `wrap-anywhere`. La tabla de Ventas usa el mismo patrón.
- **Arreglo propuesto (espera OK):** las dos tablas con `table-fixed` y anchos de columna. Primero va una e2e que inserta ese nombre y mide que no haya scroll horizontal.

### G4 · Con el teclado, al cerrar el detalle de una venta, el foco no vuelve a la fila

- **Cómo repetirlo:** en `/ventas`, a 1280 px, usa Tab hasta una venta, abre su detalle con Enter y ciérralo con Escape.
- **Lo que pasa:** el detalle se abre y se cierra bien, pero el foco queda al principio de la página. Quien usa el teclado tiene que volver a recorrer todo.
- **Causa:** la hoja se abre controlada, sin un `SheetTrigger`, así que Radix no sabe a qué elemento devolver el foco. En el celular pasa lo mismo, pero ahí casi no se usa el teclado.
- **Arreglo propuesto (espera OK):** recordar el botón que abrió la hoja y devolverle el foco al cerrarla.

## Resistieron

| Ataque | Qué pasó |
|---|---|
| Doble clic en una fila de Ventas | Una sola hoja abierta |
| Doble clic en una fila de Clientes | Una sola ficha y ningún error |
| Tocar 15 veces seguidas los botones de orden | Sin errores; queda el último orden pedido y las 123 filas siguen ahí |
| Ventana de 1024 px justo y de 1023 px | A 1024 px el panel y la tabla; a 1023 px la barra de abajo, sin tabla. Sin scroll horizontal en ninguno |
| Abrir el detalle solo con el teclado (Tab y Enter) | Se abre, y la fila se marca al recibir el foco |
| Un nombre con `<b>…</b>` | Se ve como texto: no se interpreta como HTML |

- **Aparte (ya estaba antes):** el servidor avisa «Each child in a list should have a unique key prop» en `ListaClientes`, y aparece desde antes de esta obra. Queda en la bitácora como pendiente.

## Arreglado con OK («Sí, aplica todo»)

- **G3:** las dos tablas usan `table-fixed` con anchos por columna. Al probarlo apareció la causa real en Clientes: el resumen «más que nadie, RaroXXX…» tampoco partía el nombre, y ahora lleva `wrap-anywhere`. La e2e de regresión inserta el nombre de 120 letras y mide 0 px de scroll horizontal: falló antes del arreglo y pasa después.
- **G4:** `Hoja` recuerda qué elemento tenía el foco al abrirse y se lo devuelve al cerrarse (si sigue en la página). La e2e de regresión abre el detalle con Enter, lo cierra con Escape y comprueba que el foco vuelve a la fila: falló antes y pasa después. Arregla también el celular, porque la hoja es la misma.
- **Corrida final:** `escritorio`, `auditoria-visual`, `cierre-whatsapp` y las píldoras de Stock y Clientes: 33 pasan, 11 se saltan (las de escritorio en el proyecto de 360 px) y ninguna falla.
