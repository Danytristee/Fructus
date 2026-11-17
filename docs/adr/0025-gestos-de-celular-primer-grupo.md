# ADR-0025 — Gestos de celular, primer grupo: pantalla encendida, contactar, pestaña que sube, «+» que repite y monto seleccionado

**Fecha:** 2026-11-17 · **Estado:** aceptado (sigue a ADR-0023 y ADR-0024; elegido de un inventario de lo que una app del celular hace y
Fructus no)

## Contexto

Después de la hoja (ADR-0023) y el teclado (ADR-0024) se hizo un inventario de lo que se espera de cualquier app del celular. Quien dirige
el proyecto eligió el primer grupo: lo más barato que más se nota en el día del puesto.

## Decisión

1. **Pantalla encendida con «Hola Fructus»** (`components/voz/usePantallaEncendida.ts`, Screen Wake Lock).
   - Mientras el interruptor está prendido en «Hoy», la pantalla no se apaga sola. «Hola Fructus» solo escucha con la pantalla a la vista
     (ADR-0022): apagada al minuto, nadie oía la frase.
   - Se pide otra vez al volver a la pantalla y se suelta al salir de «Hoy» o al apagar el interruptor.
   - Si el ahorro de batería lo niega, la pantalla se apaga como siempre, y queda un aviso en la consola sin datos de nadie.
   - **Costo:** batería. Va ligado al mismo interruptor que ya abre el micrófono, y lo apaga quien no lo quiere.
2. **«WhatsApp» y «Llamar» en la ficha del cliente** (`components/ui/Contactar.tsx`, `lib/contacto-reglas.ts`).
   - Es la misma pieza que ya tenía el proveedor: una función, una pieza.
   - WhatsApp abre el chat con un mensaje ya escrito, que la persona lee y manda ella. La API de WhatsApp sigue sin usarse.
   - El mensaje saluda por su apodo («Hola don Lucho») y, si debe, dice cuánto va su cuenta. No es una regla de dinero: el saldo es el mismo
     de la ficha.
3. **Tocar la pestaña en la que estás sube al inicio** (`BarraInferior.tsx`). Desde una ficha, la pestaña lleva a la lista. Cada toque de la
   barra vibra 8 ms.
4. **«+» y «−» son una sola pieza, `BotonPaso`**. Reemplaza las dos copias, la de cajas y la de grados.
   - Un toque es exactamente un paso, también con el teclado.
   - Mantenerlo apretado espera 450 ms y después repite cada vez más rápido (`lib/paso-reglas.ts`): de 10 a 30 cajas en menos de 2 s.
   - Cada paso vibra 8 ms, y se detiene solo al llegar al límite.
5. **Al tocar un monto, el número queda seleccionado** (`components/ui/seleccionar-al-enfocar.ts`).
   - Lo usan `Campo` con `inputMode="decimal"` y los montos de la tarjeta de voz.
   - Escribir «47» reemplaza el «45» sugerido; antes eran cinco toques de borrar.
   - Se cancela el primer `mouseup`, que ponía el cursor y deshacía la selección.

## Cómo se prueba

- `lib/contacto-reglas.test.ts` y `lib/paso-reglas.test.ts`.
- `tests/e2e/gestos-celular.spec.ts`: la pestaña que sube, el «+» que repite, el toque exacto y el monto seleccionado.
- `voz-hola-fructus.spec.ts`: la pantalla encendida, con un Wake Lock de mentira que anota cada pedido.
- `clientes-ficha.spec.ts`: los enlaces de llamar y de WhatsApp.
- Todo a 412 y 360 px.

## Pendiente

- La vibración y la pantalla encendida se notan solo en un celular de verdad. En Playwright se reemplazan por mentiras que anotan las
  llamadas.
- El segundo grupo del inventario sigue sin hacer:
  - elegir un contacto del teléfono al crear un cliente;
  - compartir la boleta como archivo;
  - un número en el ícono de la app;
  - deslizar para actualizar.
