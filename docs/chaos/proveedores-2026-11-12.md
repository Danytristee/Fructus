# /chaos · Hoja de pago a proveedor y hoja de alta y edición de proveedor · 2026-11-12

- **Rama:** `claude/suppliers-section-test-data-e7d687`.
- **Semilla:** 1112.
- **Base:** local, con `catalogo-real` y `proveedores-demo`. Se respaldó antes y se rehízo al terminar (`db reset` y las dos demos).
- **Conteo:** 9 ataques, 8 resistieron, 1 hallazgo de gravedad 4, ya arreglado.
- **Invariantes:** limpias antes y después de cada ataque que escribió.
- **Plan:**
  - El núcleo: doble toque, respuesta perdida, monto con coma y dos cuentas a la vez. La voz no aplica: estas hojas no se dictan.
  - Por sorteo: entradas hostiles, URL, sesión vencida, permisos del ayudante y teclado a 360 px.

## Hallazgos

### 1 · Gravedad 4 · «Revisa lo marcado en rojo» sin nada rojo a la vista

- **Pasos:**
  1. «Nuevo proveedor», escribe un nombre.
  2. Abre «Más datos» y escribe el RUC `2099900010` (10 dígitos).
  3. Cierra «Más datos».
- **Evidencia:**
  - El pie dice «Revisa lo marcado en rojo.» y Guardar no avanza.
  - El campo RUC está dentro del desplegable cerrado (`inert`) y su error no se ve.
  - No se guarda nada.
- **Causa:** `components/proveedores/HojaProveedor.tsx`. El aviso del pie es genérico y el error vive en un campo escondido.
- **Arreglo propuesto:**
  - el aviso dice cuál es el campo: «Revisa el RUC: tiene 11 números.»;
  - y si el campo con error está dentro de «Más datos», el desplegable se abre solo.

### Arreglo (con OK del 2026-11-12)

- **Primero, la prueba que falla:** `lib/proveedor-reglas.test.ts`, en «avisoDeProveedor». Falló porque la función no existía.
- **Después, el arreglo:**
  - `avisoDeProveedor` devuelve el primer error con el nombre de su campo («El RUC tiene 11 números y empieza con 10 o 20.») y dice si
    está dentro de «Más datos».
  - `Desplegable` suma un modo controlado (`abierto`, `alCambiar`).
  - La hoja mantiene «Más datos» abierto mientras adentro haya un error. No se vuelve a montar: con la primera versión, que cambiaba la
    llave del desplegable, el RUC perdía el foco al primer dígito.
- **Mismo ataque, misma semilla:**
  - el RUC conserva el foco en las 10 teclas;
  - el pie nombra el RUC;
  - «Más datos» sigue abierto (`aria-expanded=true`, el campo no queda `inert`).
  - **Resiste.**

## Resistió

| Ataque | Evidencia |
|---|---|
| Doble toque: 5 clics en el mismo tick en «Confirmar pago» | Un solo pago de S/ 100 (id 25, comando 43, con autor). |
| Respuesta perdida: el servidor guarda y el `fetch` falla | Dijo «La señal no respondió y no sé si se guardó. Toca Confirmar pago otra vez: no se va a repetir». El segundo toque devolvió el mismo pago (id 26): un solo pago de S/ 77. |
| Monto con coma «1,299.50» | «Escribe el monto así: 45 o 47.50.» No se guardó nada. |
| Dueño y ayudante pagan al Tacna a la vez | Dos pagos, cada uno con su autor. Son dos pagos distintos (no hay comando compartido): es lo correcto. |
| Dos altas a la vez: «Chaos Frutas SAC» y «chaos frutas sac » | Una sola fila: el índice `proveedores_nombre_unico` rechazó la segunda. |
| El ayudante crea o edita un proveedor | El alta se rechaza por RLS. El `update` no toca filas: las notas siguen iguales. |
| URL: `abc`, `999999`, `-1`, `1e3` y un proveedor desactivado | Las cinco responden 404 con «No encontré a ese proveedor». |
| Sesión vencida al confirmar (se borró la cookie `sb-*`) | Dijo «Tu sesión terminó. Vuelve a entrar y anota el pago otra vez», con «Entrar otra vez». Nada guardado (0 pagos de S/ 55). |
| Nombre con emojis | Pasa la validación. Es un nombre válido, no un estado imposible. |

## Sin probar

- **Teclado real a 360 px:** el navegador del escritorio no lo emula. El campo pide `inputmode="decimal"` y Confirmar va en `PieFijo`,
  como en el abono. Queda para un Android real.
