# /chaos · Tarjetas de voz de A6 (abono, merma, gasto, compra) · 2026-10-31

**Rama:** `claude/voz-operaciones`. **Semilla:** 31. **Base:** local, con respaldo antes y `db reset` al terminar. **Invariantes:**
las 12 en orden antes, después de cada ataque que escribió y al final.

**Plan.** Núcleo: cinco toques en el mismo tick (las 4 tarjetas), red cortada y respuesta perdida al confirmar, voz ambigua, monto
con coma, y dueño y ayudante a la vez. Sorteo con la semilla 31: monto negativo, recargar con la tarjeta abierta, monto de 10
dígitos, sesión vencida al confirmar y el contador intenta registrar. Fuera del sorteo, por lectura del código: motivo y descripción
muy largos.

**Conteo:** 21 ataques; 19 resistieron, 2 hallazgos.

## Hallazgos

### 1 · Gravedad 2 · Respuesta perdida: la tarjeta dice «no se pudo guardar» de algo que se guardó

- **Pasos:** dictar un abono (o una compra) → la red deja pasar el pedido pero pierde la respuesta → Confirmar.
- **Evidencia:** la tarjeta dice «No se pudo guardar. Revisa tu señal e inténtalo otra vez.» y la base tiene **1 abono**. Si la
  persona descarta en vez de reintentar, el aviso dice «No guardé ese abono.».
- **Por qué es grave:** la persona cree que no se guardó y lo vuelve a dictar: es otro comando, así que **el abono se registra dos
  veces y la deuda baja el doble**. El reintento en la misma tarjeta sí es seguro (idempotente).
- **Causa:** `useConfirmar` trata toda falla de red como «no se guardó». Cuando el pedido salió, no se sabe. Pasa igual en la venta.
- **Arreglo propuesto:** si la acción falla por red, decir «La señal no respondió y no sé si se guardó. Toca Confirmar otra vez: no se
  va a repetir.» y descartar con el aviso incierto («Lo descarté. Si alcanzó a guardarse, lo ves en «Lo último»»), igual que con el
  tope de 15 s.

### 2 · Gravedad 3 · Un motivo o una descripción largos dejan la tarjeta sin poder guardarse

- **Pasos:** dictar una merma cuyo motivo pasa de 120 letras (o un gasto con descripción de más de 200) → Confirmar.
- **Evidencia:** «Revisa la fruta y las cajas de la tarjeta.» (merma) o «Revisa el monto de la tarjeta.» (gasto); 0 filas. Nada en la
  tarjeta deja corregir el motivo, así que no hay salida.
- **Causa:** las acciones limitan el largo con Zod y el intérprete no.
- **Arreglo propuesto:** recortar el motivo y la descripción al tope en el borrador (`borradorMerma`, `borradorGasto`). No es dinero.

## Resistieron

| Ataque | Resultado |
|---|---|
| 5 toques en el mismo tick (abono, merma, gasto, compra) | 1 fila cada uno |
| Red cortada al confirmar (gasto) | «No se pudo guardar…», 0 filas; el reintento guarda 1 |
| Respuesta perdida + reintento (abono, compra) | 1 fila |
| Compra sin fruta clara, sin costo ni condición | Confirmar bloqueado: «Falta elegir qué fruta fue y a cuánto la caja.» |
| «1,299.50» y «1.299,50» en el monto | «Escribe el monto así: 45 o 47.50.», Listo bloqueado |
| «-50» en el monto y en el costo | «… no puede ser negativo.», Listo bloqueado |
| «1234567890» en el monto y en el costo | «Escribe … así: 45 o 47.50.», Listo bloqueado |
| Recargar con la merma abierta | «Tienes una merma sin confirmar.» → Verla → se guarda 1 |
| Sesión vencida al confirmar (abono) | «Tu sesión terminó…», «Entrar otra vez», 0 filas; al volver, «Tienes un abono sin confirmar.» |
| Dueño (S/ 7) y ayudante (S/ 11) abonan a la vez al mismo cliente | Saldo 120 → 102 |
| La misma compra, mismo comando, en dos sesiones a la vez | Las dos devuelven la compra 37; 1 fila |
| El contador inserta abono, gasto, merma y compra | Rechazado por RLS en los 4 |

## Arreglados con OK (31-10)

1. **Respuesta perdida:** `useConfirmar` trata la falla de red como «no sé si se guardó» (y descartar avisa en incierto). Prueba:
   `tests/e2e/voz-abono.spec.ts` «respuesta perdida al confirmar». Vale también para la venta.
2. **Texto largo:** `borradorMerma` y `borradorGasto` recortan el motivo (120) y la descripción (200). Pruebas: Vitest de las dos reglas
   y `tests/e2e/voz-gasto.spec.ts` «una descripción dictada muy larga».

El mismo ataque con la semilla 31 ahora resiste: las dos pruebas fallaban antes del arreglo y pasan después.
