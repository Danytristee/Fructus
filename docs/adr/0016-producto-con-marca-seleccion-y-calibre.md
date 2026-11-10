# ADR-0016 — El producto es fruta, variedad, marca, selección y calibre

**Fecha:** 2026-11-10 · **Estado:** aceptado

## Contexto

El catálogo cargado salió de una proyección del dueño (`catalogo-proyeccion.sql`). Tenía variedades que el puesto no vende y precios
promedio: todas las manzanas a S/ 128.72. El dueño entregó su inventario real («Copia de Inventario de Frutas.xlsx»), con 50 filas.
Cada fila trae tipo, marca, selección, calibre, kilos por caja, precio de compra y precio de venta.

Varias filas solo se distinguen por la selección (Membrillo 3era, 4ta y 5ta) o por el calibre (Manzana Roja americana Nordic Premium,
en 113 y en 100). Cada una tiene su precio y su stock. Con la llave de antes, `(nombre, variedad)`, no se podían guardar.

Quien dirige el proyecto decidió el 2026-11-10:
- columnas propias, no todo dentro de «variedad»;
- las frutas que el puesto vende y no están en la lista, sin precio;
- la cereza («280 a 150») sin precio sugerido;
- «Pink de light» se escribe «Pink Lady».

## Decisión

- **Esquema** (`20261110120000_catalogo_con_detalle.sql`):
  - `productos` suma `marca`, `seleccion`, `calibre` (texto: «125 o 113», «AA», «Jumbo»), `kg_por_caja` y `costo_referencia`. Este
    último es el precio de compra de la lista; el costo real de cada lote sigue en `compra_items`.
  - La llave pasa a las cinco partes, sin mirar mayúsculas: «Unifrutti» y «UNIFRUTTI» son el mismo producto.
  - Un texto vacío no es un dato: o tiene letras o es null.
- **Una sola regla para nombrar y ordenar** (`lib/productos-reglas.ts`):
  - en grande va «Manzana Verde Premium»;
  - en una frase, con el calibre, para no confundir dos calibres: «Manzana Roja americana Premium cal. 113»;
  - en la línea chica, «Nordic · cal. 100 · 18 kg»;
  - el orden es fruta → variedad → selección (Super, Premium, Extra, Elegido, 1era…6ta, Comercial) → calibre → marca.
  - Ninguna pantalla vuelve a juntar `nombre` y `variedad` por su cuenta.
- **Stock agrupa por fruta.** Antes ordenaba por desgaste, pero eso ya lo dice «Qué hacer hoy».
- **La voz:**
  - `buscar_productos` compara también contra la selección y el nombre completo, y devuelve las partes
    (`20261110120100_buscar_productos_con_detalle.sql`);
  - `elegir()` no elige solo si el segundo candidato queda a menos de 0.15 del primero: «manzana verde» calza igual con la Premium y con
    la Comercial;
  - un alias nunca es el nombre a secas de una fruta con varias selecciones.
- **El catálogo se carga** con `scripts/demo/catalogo-real.sql`. Lo que no está en él queda inactivo y no se borra.

## Consecuencias

- La marca no forma parte del nombre en una frase. Si mañana dos productos se distinguen solo por la marca, `nombreProducto()` tiene que
  sumarla.
- La voz pregunta más a menudo («¿cuál manzana verde?»). Es a propósito (principio 1). Si molesta en el puesto, se agregan alias, no se
  baja el margen.
- El vocabulario de Whisper nombra cada fruta una vez, con sus variedades: con frases enteras, el catálogo real pasaba el tope de
  ~700 caracteres y dejaba fuera a los clientes.
- El precio de compra se ve en Ajustes. Todavía no se sugiere en la hoja de Compra (pendiente en la bitácora del 2026-11-10).
