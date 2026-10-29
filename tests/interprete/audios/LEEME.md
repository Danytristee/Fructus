# Audios reales del puesto (mejora 4)

La voz sintética del Mac (`pnpm voz:stt`) mide en condiciones ideales. Para saber de verdad si Fructus entiende al dueño hacen
falta **sus voces, en el puesto, con el ruido del mercado**. Son 30 frases, unos 10 minutos.

## Cómo grabar

1. **Quién:** el dueño y, si se puede, un ayudante. Cada uno lee las frases como las diría vendiendo, no como un locutor.
   Si en el puesto se dice distinto («cajita», «al toque me yapea»), mejor: se dice como sale y se anota abajo.
2. **Dónde:** en el puesto, a la hora de trabajo, con el ruido normal. No en un lugar callado.
3. **Con qué:** la grabadora de voz del celular, sosteniéndolo como para hablarle a la app (a un palmo de la boca).
4. **Nombre de cada archivo:** el `id` de la frase, por ejemplo `venta-manzana-yape.m4a`. Sirve cualquier formato del celular
   (m4a, webm, ogg, mp3).
5. **Dónde dejarlos:** en esta carpeta, `tests/interprete/audios/`. **No se suben a git** (`.gitignore`): son voces de personas.
   Antes de grabar, se pide permiso para usarlas solo en las pruebas de Fructus.

## Las 30 frases

| id | Qué se dice (puede cambiar la forma, no el sentido) |
|---|---|
| venta-manzana-yape | Vendí 10 cajas de manzana royal a don Lucho a 128, me yapeó |
| venta-pera-credito | 12 de pera gaucho para Santa Ana, lo debe |
| venta-kiwi-transferencia | 5 de kiwi cope al Mochica a 140, por transferencia |
| venta-uva-sin-precio | 6 de uva bolón a la señora Rosa, pagó en efectivo |
| venta-sin-nada | Vendí 4 cajas de manzana crispin |
| venta-dos-frutas | Al Paraíso 10 de naranja y 6 de piña golden, me plineó |
| venta-centimos | 8 de manzana roja a don Lucho a 128 con 70, anótalo |
| venta-rebaja | 20 de pera chilena al Mochica a 121, le rebajé 20, pagó |
| venta-factura | 15 de kiwi importado para el Mochica a 139, con factura |
| venta-media-caja | Media caja de arándanos a la señora Rosa, cancelado |
| venta-fiado | Al fiado 3 de granadilla para el flaco Carlos |
| venta-sabado | 6 de mango kent para Carlos, me paga el sábado |
| venta-apodo-puesto | 10 de tangelo para la del puesto 12, lo debe |
| venta-me-apuntas | Me apuntas 5 de níspero hbs para Santa Ana |
| venta-al-paso | Vendí 3 de sandía, me yapearon |
| abono-yape | La señora Rosa me yapeó 150 de su deuda |
| abono-efectivo | Don Lucho me abonó 500 en efectivo |
| abono-a-cuenta | El flaco me dio 80 a cuenta |
| compra-chao | Llegaron 40 cajas de uva bolón del de Chao a 130 |
| compra-piura | Compré 60 de manzana royal a Piura Norte a 124 con 56 |
| compra-sin-precio | Llegó la naranja, 50 cajas, todavía no sé el precio |
| merma-platano | Se malograron 2 cajas de plátano biscocho |
| merma-podrida | Bota 3 de kaki, están podridos |
| gasto-flete | Pagué 120 de flete |
| gasto-cargador | Le di 60 al cargador |
| consulta-quien-debe | ¿Quién me debe? |
| consulta-deuda-flaco | ¿Cuánto me debe el flaco? |
| consulta-ventas | ¿Cuánto vendí hoy? |
| consulta-stock | ¿Cuántas cajas de manzana royal me quedan? |
| no-entendido | Oye, pásame la balanza |

## Qué se hace después

`/voz-precision --audio` pasa cada audio por `lib/voz/stt.ts` y por el intérprete, y compara contra lo que se quiso decir. El
resultado va a `docs/voz/` junto a la medición con voz sintética. Si una forma de hablar se repite y falla, se agrega como caso en
`tests/interprete/casos.json`, nunca se borra un caso que falla.
