# 2026-11-17 · Proveedores: lo que quedó fuera del PR 29

- **Qué cambió:** el PR 29 se fusionó el 12-11 a las 06:10 (UTC) y 16 minutos después se subieron a su rama 4 commits que nunca llegaron a
  `main`. Se traen aquí, en orden y con `cherry-pick -x`:
  - `/formidable` de Proveedores (8.2 → 8.8): la deuda arriba en la ficha con tres razones, el porqué en cada fila y a quién le debes más;
  - el filtro dice «Pide mejor precio», como la insignia;
  - el informe de `/chaos` de las hojas de pago y de proveedor (9 ataques, 8 resistieron);
  - el arreglo del ataque que no resistió: el pie de la hoja de proveedor nombra el campo con error y «Más datos» se abre solo si el
    error está adentro.
  Solo chocó el índice de `docs/formidable/README.md`; la fila de Proveedores entra en su fecha.
- **Arreglo nuevo:** la e2e que faltaba (`tests/e2e/proveedores-hoja.spec.ts`) encontró un error en ese arreglo. Si se tocaba
  «Más datos» para cerrarlo con el RUC mal, la hoja lo recordaba y, al escribir el último número bueno, se cerraba sola con el dedo en el
  RUC. Ahora ese toque no se anota mientras el error sigue adentro.
- **Cómo se verificó:** tipos, ESLint (sin avisos nuevos) y Knip limpios; Vitest de proveedores 33 de 33. Playwright a 412 y 360 px:
  `proveedores-hoja` (falló antes del arreglo, pasa después) y las dos de proveedores de `teclado.spec.ts`, 6 de 6. Capturas
  `rescate-*` en `docs/formidable/proveedores-2026-11-12/`, sin scroll horizontal.
- **Pendiente:** de `/formidable` quedan «Se enfrió» y «Ocasional», que no se entienden solos. La rama `claude/cola-segunda-parte` también
  tiene 2 commits fuera de `main` (una prueba de la compra en la cola y el renombre de `fecha_del_celular`, que `main` ya tiene): sin revisar.
