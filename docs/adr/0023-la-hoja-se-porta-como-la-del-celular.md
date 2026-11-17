# ADR-0023 — La hoja se porta como la de un celular: sigue al dedo y «atrás» la cierra

**Fecha:** 2026-11-17 · **Estado:** aceptado (amplía la regla 4 de «Celular primero»: «Hojas, no ventanas»)

## Contexto

Las hojas (`components/ui/Hoja.tsx`, sobre el Dialog de Radix) subían y bajaban con un resorte, pero no respondían al dedo: deslizarlas hacia
abajo o hacia arriba no hacía nada, y el botón atrás del Android (o el gesto de atrás) **sacaba a la persona de la pantalla** en vez de cerrar
la hoja. En un celular eso no pasa en ninguna app; el dueño lo nota en la primera venta.

## Decisión

1. **La hoja sigue al dedo** (`components/ui/useArrastreHoja.ts`, decisiones en `lib/hoja-reglas.ts` con su prueba):
   - Se arrastra siempre desde la manija y el título (`data-asa`), y desde el contenido cuando este está arriba del todo. Si el contenido se
     desliza, primero se desliza él; al llegar arriba, **el mismo dedo** sigue bajando la hoja.
   - Hacia arriba se estira poco y cada vez menos (la curva de los bordes de iOS) y vuelve.
   - Al soltar se cierra si bajó un tercio (entre 56 y 240 px) o si iba rápido (0.4 px/ms o más, el umbral de las hojas nativas); si no, vuelve
     con el resorte de la app. El velo de atrás se aclara a medida que baja.
   - Un gesto más de lado que vertical no es de la hoja. Los campos de texto no arrastran (para no robarle el cursor a nadie).
   - Solo en celular (menos de 768 px): en escritorio la hoja es una ventana centrada y se cierra con Escape o tocando afuera.
   - Se mueve con la propiedad `translate`, no con `transform`: la animación de entrada deja `transform` fijo y le ganaría a un estilo en línea.
     Las dos se suman, así que la bajada de Radix arranca donde la dejó el dedo. Solo `translate` y `opacity` (ADR-0012).
   - Táctil con `touchstart`/`touchmove` (no Pointer Events): solo así se puede frenar el deslizamiento del navegador en el momento.
2. **«Atrás» cierra la hoja** (`components/ui/historial-hojas.ts`): al abrir se agrega una entrada al historial con la misma dirección; atrás la
   quita y la hoja se cierra. Si la hoja se cierra de otra forma, la hoja quita su entrada (`history.go(-1)`), así el siguiente «atrás» va al
   módulo anterior y no se gasta en una hoja que ya no está. Hojas una sobre otra se apilan.
   - Si la hoja no se deja cerrar (está guardando), vuelve a anotar su entrada: el siguiente «atrás» tampoco saca a nadie de la pantalla.
   - **Quien cierra una hoja y navega** espera a que la entrada se haya quitado (`despuesDeCerrarHoja`): si no, la vuelta del historial cancelaría
     la navegación de Next. Los enlaces dentro de una hoja lo hacen solos; `HojaCliente` y `HojaProveedor` lo usan al abrir la ficha nueva.
   - Next también oye ese `popstate`: en `window` los listeners corren en el orden en que se registraron y el suyo va primero. Como la dirección
     no cambió y Next copia su estado en cada `pushState`, solo restaura la misma pantalla.

## Alternativas descartadas

- **vaul (el `Drawer` de shadcn):** resuelve el arrastre, pero su repositorio está sin mantenimiento desde 2025, suma una dependencia al
  primer render de «Hoy» y no resuelve el botón atrás. Lo propio son ~250 líneas, con la decisión de soltar probada aparte.
- **Una ruta por hoja (`?hoja=venta`):** «atrás» saldría gratis, pero cada hoja dependería de la URL y abrir una hoja haría una navegación de
  Next (más lenta en un Android de gama media). Las hojas de Fructus son estado de la pantalla, no destinos.

## Consecuencias

- Las 9 hojas de la app ganan el gesto y el «atrás» sin tocarlas, salvo las dos que navegan después de guardar.
- Pruebas: `lib/hoja-reglas.test.ts` y `tests/e2e/hoja-gestos.spec.ts` (toques reales por CDP a 412 y 360 px).
- Sin hacer: tamaños intermedios (una hoja a media pantalla que se agranda al subirla). Hoy cada hoja mide lo que su contenido.
