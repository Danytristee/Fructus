# /chaos · Cola sin conexión (ADR-0017) · 2026-11-12

- **Qué se atacó:** la cola sin conexión (`useConfirmar`, `ColaProveedor`, `lib/cola/enviar.ts`, registrar a mano sin señal, audios en cola).
- **Rama:** `claude/offline-request-queue-2a6568` · **Semilla:** 1112 · **Ancho:** 412 px
- **Conteo:** 10 ataques, 7 resistieron, 1 hallazgo grave, 1 menor y 1 decisión de dinero que queda para quien dirige.
- **Base:** local. Las invariantes salieron limpias antes y después de cada ataque que escribió.
- **Nota:** otra sesión reinició la base local a mitad de la corrida (el contenedor quedó vacío por un minuto). Se esperó y se volvió a
  respaldar antes de atacar.

## Hallazgos

### 1 · Gravedad 2: una venta en cola cuyo cliente se borró se reintenta para siempre, culpa a la señal y frena lo de detrás

- **Cómo se repite:**
  1. Dictar una venta al crédito para un cliente sin ventas.
  2. Cortar la red y Confirmar.
  3. Borrar al cliente.
  4. Volver la red.
- **Evidencia (A1 y A5):** 20 a 25 s después, la entrada sigue `pendiente`. La franja dice «La señal está débil. Por enviar: 1 venta. Lo
  reintento solo». No hay ninguna venta en la base, y en A1 el abono que venía detrás tampoco entró.
- **Causa:** `confirmarVenta` (`app/(app)/acciones-voz.ts`) no traduce la llave foránea rota (23503). Cae en `SIN_SENAL`, que la cola trata
  como falta de señal. Pasa lo mismo sin la cola: con señal, la tarjeta dice «Revisa tu señal» cuando el cliente ya no está. `confirmarAbono`,
  `confirmarMerma` y `confirmarCompra` sí lo traducen.
- **Arreglo propuesto:** con 23503, `confirmarVenta` devuelve `CLIENTE_YA_NO_ESTA` (como el abono). La cola lo muestra como rechazo, y el
  rechazo frena lo de detrás hasta que la persona decide. No toca dinero: solo cambia la frase de un error.

### 2 · Gravedad 4: «no se entendió: No te entendí, inténtalo otra vez.»

- **Evidencia (N3):** un dictado sin señal vuelve como «no entendido». El aviso dice «Un dictado que guardé sin señal no se entendió: No te
  entendí, inténtalo otra vez.». Es seguro (no se guardó nada, se puede borrar), pero repite la frase.
- **Arreglo propuesto:** «Un dictado que guardé sin señal no se entendió. Dilo otra vez.»

### A decidir (regla de dinero): un abono en cola de una venta que se anuló mientras tanto

- **Evidencia (A4):**
  1. El dueño anota sin señal un abono de S/ 60 por una deuda de S/ 60.
  2. Mientras está en cola, la venta se anula.
  3. Al volver la señal, el abono entra y el cliente queda con S/ 60 a favor (saldo −60). Invariantes limpias.
- **Lectura:** no es un estado imposible. La plata se recibió, y pagar de más ya se permite (decisión del 31-10). Pero nadie lo ve:
  la tarjeta mostraba que saldaba la deuda.
- **Opciones:**
  - dejarlo así;
  - que el «Listo» de la franja diga «Don Lucho quedó con S/ 60 a favor».

  Lo decide quien dirige el proyecto.

## Resistieron

| Ataque | Evidencia |
|---|---|
| N1 · 5 toques a Confirmar en el mismo tick, sin señal | 1 entrada en la cola, 1 venta en la base |
| N2 · Respuesta perdida al confirmar y durante el envío | Cubierta por las e2e de «respuesta perdida» (abono, merma, voz): 1 sola fila |
| N3 · Voz ambigua sin señal | Vuelve como «no entendido», se puede borrar, nada guardado (ver hallazgo 2 por la frase) |
| N4 · Monto «1,299.50» a mano sin señal | El campo lo rechaza: «Escribe el monto así: 45 o 47.50.», «Listo» desactivado |
| N5 · Dueño con abono en cola y ayudante abona en línea al mismo cliente | Entran los dos (30 y 40, cada uno con su autor), saldo 30, invariantes limpias |
| A2 · Sesión vencida con la cola llena, y otra cuenta entra en el mismo celular | Pide «Entra otra vez». El ayudante no envía lo del dueño. El dueño vuelve a entrar y entra el abono |
| A3 · Cerrar la app con la cola llena, sin señal | Al abrirla con señal, el abono entra solo |

## Lo que queda en la base local

Los clientes, ventas y abonos de prueba siguen ahí. No se hizo `db reset` porque otra sesión estaba usando la misma base. El respaldo
previo está en el scratchpad de la sesión. Conviene `npx supabase db reset` cuando la otra sesión termine.

## Arreglos (con OK, el mismo día)

- **Hallazgo 1:** primero la prueba que fallaba (`regresión /chaos` en `tests/e2e/cola-sin-conexion.spec.ts`: la franja decía «La señal está débil»
  y nunca «No entró»). Después, `confirmarVenta` traduce el 23503 a «Ese cliente ya no está en tu cuaderno». El mismo ataque ahora resiste: la
  franja muestra el rechazo, nada se guarda, «Quitar de la lista» limpia la cola. En verde a 412 y 360 px.
- **Hallazgo 2:** el aviso dice «Un dictado que guardé sin señal no se entendió. Dilo otra vez.».
- **A decidir:** el saldo a favor del abono en cola cuya venta se anuló sigue esperando la decisión de quien dirige.
