# ADR-0002 — La voz propone, la persona confirma

**Fecha:** 2026-10-26 · **Estado:** aceptado

## Contexto

Pasar audio a texto es fácil. Lo caro es el error: una venta mal registrada descuadra el cuaderno del cliente, y un comprobante mal
emitido obliga a sacar una nota de crédito. El ambiente del puesto tiene ruido moderado, y a los clientes se les nombra por apodo.

## Decisión

1. **Ninguna operación se guarda sin un toque de confirmación** en una tarjeta grande que muestra lo *entendido*: cliente, fruta, jabas, precio, total, y si pagó o lo debe.
2. **El intérprete nunca inventa dinero:**
   - si no se dijo el precio, devuelve `null` y la app sugiere el último cobrado a ese cliente, marcado «sugerido»;
   - si no se dijo si pagó, la app pregunta con dos botones.
3. **El intérprete devuelve los nombres tal como se dijeron.** El servidor los resuelve con búsqueda difusa (pg_trgm) y, si la similitud es baja, ofrece las 3 mejores opciones.
4. **Todo comando queda en `comandos_voz`** con su resultado (confirmado, corregido, descartado, no entendido) y su latencia. Eso permite medir la precisión con `/voz-precision`.

## Consecuencias

- Cada operación cuesta un toque más que un sistema «sin manos». A cambio, ningún error de reconocimiento llega a la base sin que alguien lo vea.
- La palabra de activación («Fructus, …») queda para la fase 2. En un navegador, escuchar todo el tiempo gasta batería y se activa con el ruido.
