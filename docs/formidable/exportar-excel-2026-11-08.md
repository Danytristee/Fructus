# /formidable (rápido) · tarjeta «Excel para tu contador» en «Cierre» · 2026-11-08

**Para quién:** el contador en escritorio (lo usa una vez al mes) y el dueño o el ayudante en el celular, que se lo pasan. **Pasada rápida:** solo mide (a 412 y 360 px, y la captura a 1280); no corrió la prueba a ciegas ni el escéptico.
**Qué se mira:** la tarjeta nueva de `/cierre` (título, frase, 6 filas de mes, aviso de «Listo» y de error). Capturas en `docs/formidable/capturas/exportar-excel-412.png`, `-360.png` y `-listo-412.png`.

## Medido

| | 412 | 360 |
|---|---|---|
| Altura de cada fila de mes | 64 px | 64 px |
| Separación entre filas | 8 px | 8 px |
| Controles menores de 48 px en la tarjeta | 0 | 0 |
| La tarjeta se sale por la derecha | no (16 → 396) | no (16 → 344) |
| Texto más chico de la tarjeta | 17 px | 17 px |
| Contraste del título de la fila / de «Hasta hoy» y «Mes completo» / de la frase | 18.3 / 9.0 / 8.4 | 18.3 / 9.0 / 8.4 |

A 1280 px solo se miró la captura: la tarjeta queda en la misma columna central que el resto de «Cierre» y las filas ocupan todo su ancho.

- **Lo que no cumple y no es de la tarjeta:** a 360 px el resumen de arriba (`PanelCierre`) se corta por la derecha con importes de cinco cifras (hoy: S/ 31,701.94 al contado en la base local). Ya estaba; ver «Pendiente» de la bitácora. La tarjeta nueva tiene su propia columna y no lo hereda.
- **Color como única señal:** no. «Listo» lleva icono y texto; el error, icono y texto; «Preparando el Excel…» lleva giro y texto.
- **Orden de lo que se lee:** el aviso de «Listo» y el de error van arriba de las filas, no debajo: con 6 filas, abajo quedaría fuera de pantalla, lejos del dedo.
- **Toques:** Hoy → Menú → Cierre del día → el mes: 3. No es una acción diaria del dueño: la regla de los dos toques se deja pasar.
- **No medido:** una persona real, la descarga en el navegador de un teléfono y en la app instalada (en iPhone, sobre todo), el teclado (no lleva campos).

## Lo que se ve (Observado, por mí; sin prueba a ciegas)

- Un título corto («Excel para tu contador», cabe en una línea a 360 px), una frase («Lo anulado se ve marcado y no suma») y 6 filas con el mes y «Hasta hoy» / «Mes completo». El mes en curso va primero.
- Al tocar una fila, su ícono de descarga pasa a un giro con «Preparando el Excel…», las otras quedan atenuadas y no aceptan toque; al terminar, un check en la fila y el aviso verde «Listo: Noviembre 2026. Búscalo en las descargas de tu teléfono».
- Sin señal o con un error del servidor: aviso rojo «No pudimos armar el Excel», con lo que hacer, y las filas quedan libres para reintentar.

## Lo que no se hizo
- **Prueba a ciegas** con alguien que no conozca la app: queda para la demo, con el contador y un teléfono real.
- **Nota:** no se califica sin la prueba a ciegas (la skill pide evidencia para cada nota).
