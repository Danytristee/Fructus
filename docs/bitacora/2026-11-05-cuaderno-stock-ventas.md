# 2026-11-05 · A8: cuaderno, stock y ventas

Lista aprobada: 1 ficha del cliente · 2 abono a mano · 3 alta y edición de cliente · 4 merma a mano · 5 compra a mano · 6 detalle de venta e historial · 7 anular venta con motivo.

**Actividad 1 · Ficha del cliente.**
- Qué cambió: un toque en un cliente del cuaderno abre `/clientes/[id]` (antes la fila se desplegaba). La ficha dice el veredicto en grande («Te debe S/ 2,030.00», «Al día» o «Tiene a favor»), lo último que pasó, sus datos si los hay (teléfono con `tel:`, documento, dirección, notas) y su historial de ventas y abonos día por día, con la misma `FilaOperacion` de «Lo último». Un enlace roto responde 404 con «No encontré a ese cliente». Lógica pura en `lib/ficha-cliente-reglas.ts`; el encabezado ganó `volver`.
- Cómo se verificó: Vitest (14 de la ficha, 192 en total), e2e a 412 y 360 px (la deuda y el número de movimientos que se ven son los de `v_saldo_clientes`, `ventas` y `abonos`; cliente al día y sin datos; 404; el contador la lee), sin scroll horizontal y con controles de 48 px o más. Capturas a 412 y 360 px en el navegador. Invariantes: las 12 en orden. No escribe en la base: no aplica `/chaos`.
- Decisión: el historial se corta en 40 movimientos y avisa «Se muestran los últimos 40»; las ventas completas están en Ventas. Si no hay nada que mostrar de un dato (teléfono, dirección), la fila no sale: nada de «—».

## Pendiente
- **`lib/sesion.ts:28`: con la base caída, la app dice «Tu cuenta todavía no está activa».** `exigirSesion` registra el error al leer el perfil pero sigue como si no hubiera perfil. Una señal lenta o una caída de Supabase le dice al dueño que su cuenta fue desactivada (principio 8). Se vio al detener PostgREST en local con la ficha abierta. Fuera de A8: va en su propia rama.
- El estado de error de la ficha («No pudimos leer su cuenta») no se pudo ver: la caída total la tapa el hallazgo de arriba. Es el mismo patrón que Clientes y Ventas.
- `/formidable` de la ficha: se corre junto con la hoja de abono (actividad 2), porque ahí la ficha gana su acción principal y cambia su composición.
- **Para correr los e2e:** «Hoy» espera ventas de hoy. Con una base local sembrada otro día, `hoy.spec.ts` falla sin que la app tenga la culpa; `npx supabase db reset` lo arregla.
