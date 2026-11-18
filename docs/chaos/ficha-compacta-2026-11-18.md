# /chaos · Ficha de venta por voz, compacta y con manos libres · 2026-11-18

- **Pantalla:** la hoja «¿Así fue la venta?» (`TarjetaVenta`, `MedidorDeuda`, `useToqueTarjeta`, `useConfirmar`, `acciones-voz.ts` → `registrar_venta`), después de los cambios del PR #54: deslizar sin callar, tocar calla, la deuda en dos renglones y el stock que no alcanza en la fila de la fruta.
- **Rama:** `claude/ficha-informacion-compacta-825044` (`90f4b18`). **Semilla:** 20261118.
- **Base:** solo la local de esta copia (`127.0.0.1:56421`, `fructus-frescura`).
  - Antes de atacar: respaldo con `pg_dump --data-only` e invariantes limpias.
  - Al terminar: se restauró el respaldo (154 ventas, 366 comandos y 46 clientes, como antes) y las invariantes volvieron a salir limpias.
- **Voz real:** Whisper e intérprete de verdad, con audios hechos con la voz Paulina (es-MX) de la Mac.
  - Playwright levanta el servidor con una clave de Anthropic de prueba, así que respondió el respaldo de Groq.
- **Conteo:** 21 ataques. 20 resistieron y hay 1 hallazgo, más 3 observaciones.

## Hallazgo

### 1 · Con saldo a favor, la deuda no cuadra en la tarjeta (la cifra grande sí)

- **Gravedad:** un texto de dinero falso a la vista antes de confirmar. Lo que se guarda en la base está bien. No es una pantalla caída ni un error feo.
- **No viene del PR #54:** la lógica es de antes. El PR solo cambió «Ya debía» por «Debía».

**Repetir:**
1. Un cliente debe S/ 100 y abona S/ 300: queda con S/ 200 a favor.
2. Dictarle una venta al crédito de 10 cajas a S/ 45.

**Evidencia** (captura en el scratchpad, `chaos-D5-credito.png`):
- **La tarjeta dice:** «Con esta venta te debe S/ 250.00» (correcto: −200 + 450), y debajo «No debía nada · + S/ 450.00». No es cierto que no debía nada: tenía S/ 200 a favor, y 0 + 450 no da 250.
- **La barra sale toda en rojo oscuro:** el tramo de antes es negativo y se ignora, y el de hoy mide el 180 % y se corta.
- **Al contado:** no se dice nada del saldo a favor.

**Causa:** `MedidorDeuda.tsx` solo distingue «debía» (saldo > 0) de «no debía nada». Un saldo negativo cae en «no debía nada», y la barra usa el saldo negativo como ancho.

**Arreglo propuesto (espera OK, es dinero):**
- **Al crédito:** «Tenía S/ 200.00 a favor · + S/ 450.00», y la barra solo con el tramo de hoy, descontado lo que tenía a favor.
- **Al contado:** «Tiene S/ 200.00 a favor».
- **La prueba:** el caso D5 de este informe como e2e.

## Resistieron (20)

**Núcleo:**
- **N1a · Confirmar 5 veces en el mismo tick:** 1 venta (comando 368), el saldo sube una sola vez (100 → 550).
- **N1b · «Confirmo» por voz y el toque en Confirmar en el mismo instante:** 1 venta, `confirmado_por = voz`. «Guardado» se dice una vez.
- **N2a · La petición de Confirmar no sale** (corte antes del servidor):
  - La tarjeta pasa a la cola: «Quedó en el celular» y «+ 1 venta por enviar (S/ 450.00): todavía no está sumada».
  - Con la red de vuelta, la cola la reenvía sola: 1 venta, saldo 550.
- **N2b · Se guarda en la base y se pierde la respuesta:** la tarjeta la deja en la cola y, al reenviarla, no se repite. 1 venta, saldo 550.
- **N2c · La respuesta tarda 10 s:**
  - Mientras guarda, Descartar y Confirmar están apagados, y Escape y «atrás» no cierran la hoja.
  - En los tres casos (sin tocar nada, con Escape y con «atrás») se guarda 1 venta a los ~11 s.
- **N3 · Voz ambigua, «dale lo de siempre a don lucho»:** Whisper la transcribe bien. El intérprete dice «No te entendí»: no inventa fruta, cajas ni precio, y nada se guarda.
- **N4 · Monto con coma:** «1,299.50», «1,250» y «1.299,50» se rechazan con «Escribe el precio así: 45 o 47.50.». «45,5» se guarda como 45.50 (10 cajas, total S/ 455.00).
- **N5 · Dos cuentas a la vez, en la base, con dos sesiones en paralelo:**
  - **N5a:** dueño y ayudante fían al mismo cliente a la vez. Quedan 2 ventas, cada una con su firma, y el saldo suma las dos (220).
  - **N5b:** el mismo comando, confirmado a la vez por dos sesiones del dueño, deja 1 venta y 1 salida de stock.
  - **N5c:** un comando del ayudante, confirmado a la vez por él y por el dueño, deja 1 venta.
  - Invariantes en orden.

**Dirigidos al cambio del PR:**
- **D1 · Deslizar 235 px mientras escucha y decir «confirmo»:** la escucha sigue. Se guarda la venta de 4 frutas tal como estaba a la vista (920), por voz.
- **D2 · Dejar el dedo quieto 700 ms sobre una fila mientras lee:** la voz se calla antes de soltar.
- **D3 · Tocar la tarjeta tres veces y Confirmar mientras guarda lo confirmado por voz:** 1 venta, «Guardado» una vez, sello visible.
- **D4 · Marca de stock con datos raros, a 412 y 360 px:**
  - La misma fruta dos veces (20 cajas, quedan 15): las dos filas dicen «Solo hay 15».
  - Media caja: «Solo hay 2.5». Sin stock: «No te queda».
  - Un nombre de 45 letras, sin desborde y sin controles chicos.
  - La voz dice «según la app te quedan 2 cajas y media de Papaya».

**Al azar (semilla 20261118):**
- **A1 · Audio vacío:** 400, «No llegó el audio…».
- **A1 · 300 ms de silencio:** «No te entendí». Ver la observación 2.
- **A3 · «Véndele diez cajas de mango a Pancracio, lo debe»:**
  - Pancracio no existe: el cliente queda sin elegir, con 3 opciones.
  - El mango queda por elegir (Kent, Edward o Mandarina) y el precio, vacío.
  - Falta la fruta, el precio y el cliente, y Confirmar está apagado. Nada inventado.
- **A4 · Precio −45, 0, 0.00, 999999999, 9999999999, 45.555, «١٢» y «45 soles»:** todos se rechazan con su frase y «Listo» apagado.
- **A5 · «Pagó una parte»:**
  - S/ 500 o S/ 450 en una venta de S/ 450: «Si pagó los S/ 450.00, toca «Pagó»: no debe nada.».
  - Con S/ 400 anotados, bajar el precio a S/ 30 (total S/ 300) deja «Falta elegir cuánto pagó: menos que el total…» y Confirmar apagado. 0 ventas.
- **A9 · Teclado abierto en el precio:** `teclado.spec.ts` (tarjeta de voz), 2 de 2 a 412 y 360 px.

## Observaciones (no son hallazgos)

1. **Con la respuesta perdida (N2b), la tarjeta dice «No hay señal. Guardé una venta aquí» y «todavía no está sumada», aunque la venta ya estaba en la base.**
   - Es el caso incierto de ADR-0019: el reenvío no duplica y se corrige solo.
   - La frase dice «no hay señal» cuando la señal anda y lo que se perdió fue la respuesta.
2. **Con un audio en silencio, Whisper repite el vocabulario del puesto en vez de transcribir** («Lucho 2787, Lucho 475, …»).
   - La base local tiene decenas de clientes de prueba (`Lucho NNNNN`, `Caos NNNNN`) y entran todos al prompt de vocabulario.
   - El intérprete responde «No te entendí», así que es seguro.
   - Con muchos clientes reales pasaría lo mismo: conviene mirar el largo del vocabulario antes de producción.
   - `voz-ficha-compacta.spec.ts` crea un cliente `Lucho NNNNN` por corrida: se acumulan en las bases locales (el CI empieza de cero).
3. **Mantener el dedo sobre una fila (D2) calla la voz, pero al soltar no abre el editor:** en Android, un toque largo no termina en clic. Hay que tocar otra vez. Es lo de siempre en el celular.
