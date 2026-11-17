# ADR-0024 — Con el teclado abierto no se tapa ni se pierde nada

**Fecha:** 2026-11-17 · **Estado:** aceptado (amplía la regla 6 de «Celular primero» y ADR-0023)

## Contexto

Se pidió revisar que en todo campo donde se escribe, al abrirse el teclado, no se pierda la información. Había tres huecos:

1. **El teclado tapaba la hoja.** El viewport no declaraba `interactive-widget`. Desde Chrome 108, en Android el teclado por defecto solo
   achica lo visible (`resizes-visual`): la hoja, fija abajo, quedaba detrás del teclado con su botón de guardar.
2. **Lo que flota abajo quedaba sobre el teclado:** la barra de destinos, «Registrar abono», el orbe de voz. Con el buscador de clientes
   abierto, tapaban la lista.
3. **Un roce borraba lo escrito.** Con ADR-0023, tocar afuera (lo que uno hace para bajar el teclado), deslizar la hoja, «atrás» o Escape la
   cerraban, y con ella el nombre, el teléfono o el monto a medio escribir.

## Decisión

1. **El teclado achica la página** (`interactiveWidget: "resizes-content"` en `app/layout.tsx`): la hoja sube con el teclado y su pie pegado
   (`PieFijo`, con «Guardar» o «Confirmar») queda a la vista. Safari lo ignora; los celulares del puesto son Android.
2. **`components/marco/Teclado.tsx` marca `data-teclado` en `<html>`** mientras hay un campo de escribir con el foco y la pantalla se achicó
   120 px o más (`lib/teclado-reglas.ts`).
   - Lo marcado con `data-con-teclado="oculto"` se esconde: la barra de abajo, `BarraFlotante`, el orbe de voz, y el ícono y el subtítulo de
     las pantallas de acceso (a 360 px empujaban «Entrar» fuera de la pantalla). La regla vive fuera de las capas de Tailwind: dentro de
     `base` perdía contra `flex`.
   - Apenas sube el teclado, y otra vez a los 350 ms (lo que se estaba animando ya se acomodó), el campo con el foco se lleva a la vista. La
     hoja reserva el lugar de su pie con `scroll-padding-bottom`, así el campo no queda detrás de él.
3. **Lo escrito no se pierde por un roce** (`Hoja.tsx`):
   - Con el teclado abierto, tocar afuera solo lo baja; la hoja sigue ahí.
   - Si la persona escribió algo, tocar afuera, deslizar, «atrás» o Escape no cierran: preguntan «¿Cierras sin guardar? Se pierde lo que
     escribiste», con **Seguir aquí** y **Cerrar sin guardar**.
   - Una búsqueda (`type="search"`) no cuenta: se vuelve a escribir en un segundo.
   - Cerrar a propósito (Cancelar, Descartar, después de guardar) lo hace cada pantalla por su cuenta y no pregunta.
   - Es una pregunta y no un «Deshacer» (ley 7) porque deshacer exigiría guardar el formulario de cada hoja después de cerrarla. Las 9 hojas
     ganan la pregunta sin tocarlas.

## Cómo se prueba

- `lib/teclado-reglas.test.ts`.
- `tests/e2e/teclado.spec.ts`, a 412 y 360 px. Playwright no tiene teclado: se simula como lo hace `resizes-content`, achicando la pantalla
  330 px con el foco en el campo. Recorre uno por uno estos campos y revisa que cada uno quede entero a la vista, que no quede detrás del pie,
  que el botón se alcance sin bajar el teclado y que lo escrito siga ahí:
  - cliente nuevo y proveedor nuevo, incluidos los de «Más datos»;
  - pago a un proveedor;
  - el precio en la tarjeta de voz;
  - entrar.

  También prueba la pregunta al cerrar y que la búsqueda no cuenta.

## Pendiente

- Probar en el S25 y en un Android de gama media con el teclado de verdad (Gboard y el de Samsung).
- Sobrevivir a que Android cierre la app en segundo plano (ir a WhatsApp a copiar un RUC y volver): hoy solo la tarjeta de voz lo resiste.
