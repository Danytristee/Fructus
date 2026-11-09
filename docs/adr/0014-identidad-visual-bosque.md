# ADR-0014 — Identidad visual «Bosque»

**Fecha:** 2026-11-09 · **Estado:** aceptado · **Reemplaza a:** ADR-0007 («Aurora») en colores, fondo, superficies e ícono. El movimiento de
ADR-0007 y las reglas de ADR-0012 siguen vigentes.

## Contexto

Quien dirige el proyecto pidió una estética «fintech premium» para el celular, con una imagen de referencia (verde bosque, marfil y lima),
y un logo nuevo que se vea bien instalado en el teléfono. Antes de tocar la app se hizo la maqueta navegable de `docs/maquetas/bosque/`
(8 pantallas, la voz completa y sus estados, a 360–430 px) y se aprobó mirándola.

## Decisión

- **Paleta (`app/globals.css`):** verde bosque `#103D29` (identidad, botón principal), marfil `#F7F5EE` (fondo), tarjeta `#FFFEFA` con
  borde `#E4E1D4`, lima `#D5F45A` (una acción por pantalla y el aro del orbe), positivo `#185A31`, deuda `#8E1F2A`, aviso `#8A4A0C`,
  texto `#17251D` y `#56625A`. La variante oscura nace definida y medida, pero sigue apagada (fase 2).
- **Cuatro ajustes a la paleta propuesta,** porque no se leían al sol (CLAUDE.md pide 7:1 en cifras clave):
  - el verde positivo `#348B50` daba 3.9:1 y pasó a `#185A31` (8.2:1 sobre la tarjeta);
  - la deuda `#A52B35` daba 6.4:1 sobre marfil y pasó a `#8E1F2A`;
  - el gris secundario `#667269` daba 4.25:1 y pasó a `#56625A`;
  - la lima da 1.1:1 sobre marfil: nunca es texto, siempre relleno con texto bosque encima (9.8:1).
- **El contraste se mide en una prueba,** no en una tabla: `lib/contraste-reglas.test.ts` lee `globals.css` y falla si un par de colores
  que se lee en la app baja de su mínimo. Ya atrapó uno: el micrófono sobre el orbe en oscuro daba 6.96:1.
- **Fondo liso y tarjetas sólidas.** Se quitan las luces de Aurora (`FondoAurora`). La utilidad `vidrio` conserva el nombre para no tocar
  cada pantalla, pero ahora es la tarjeta marfil sólida con un borde fino. Solo `vidrio-desenfocado` desenfoca (la barra de abajo).
- **El ícono sale de la imagen aprobada, recortada, no redibujada.** Un SVG dibujado a mano en código se veía como piezas sueltas; los íconos
  de la PWA son PNG de todos modos y la imagen da 818 px de ícono (el más grande que pide un teléfono es de 512). El recorte y sus tres
  formas (redondeada, a sangre para iPhone, maskable para Android) los arma `docs/maquetas/bosque/logo/generar-iconos.mjs`.

## Lo que se apartó de la referencia, y por qué

- **«Cobraste» y «Te deben» van en una tarjeta, una fila cada uno,** no en dos mosaicos: a 360–412 px, dos mosaicos dejan las cifras en
  20–22 px y CLAUDE.md pide 28 px o más.
- **Sin «66.5 % del total»:** lo cobrado incluye abonos de deudas viejas y lo que te deben acumula semanas; no comparten base con lo vendido
  hoy, y el porcentaje engaña.
- **«Clientes activos +3 hoy» no existe** en el sistema; «Pedidos» se dice «ventas», como en el resto de la app.
- **Texto base de 17 px, controles de 48 px y orbe de 96 px:** el prompt pedía 12–14 px y 44 px; mandan las reglas del sol de CLAUDE.md.
- **Pendiente de un OK aparte:** la comparación «que el lunes pasado a esta hora» (lectura nueva), la tarjeta «Venta por voz» en «Hoy», la
  voz en todas las pantallas (toca todos los módulos) y «¿Desde cuándo te debe?» (regla de dinero nueva).

## Consecuencias

- Los teléfonos que ya instalaron la app ven el ícono nuevo cuando el navegador vuelve a leer el manifest (puede tardar días).
- Las maquetas de escritorio (`docs/maquetas/escritorio/`) se hicieron con Aurora: se rehacen con Bosque antes de construir el escritorio.
