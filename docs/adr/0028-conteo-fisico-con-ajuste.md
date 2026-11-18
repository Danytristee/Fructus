# ADR-0028 — Conteo físico: se anota lo contado y la base pone la diferencia

**Fecha:** 2026-11-18 · **Estado:** construido en la rama `claude/conteo-fisico`. La migración `conteo_fisico` está en la base local;
aplicarla al proyecto espera el OK de quien dirige el proyecto, y va antes de fusionar.

## Contexto

El stock de Fructus es la suma de los movimientos (principio 4). En el puesto se cuela lo que nadie anota: una compra que llegó de
noche, dos cajas que se pudrieron al fondo, una venta al paso. La app dice 20 cajas de mango y hay 18, y no había cómo decirlo. El
Informe T3 lo pide como función 1 (conteo con ajuste y causa) y mide con él la exactitud de los conteos.

El tipo `ajuste` existía desde el esquema inicial, pero sin un camino propio: no guardaba lo contado ni la causa, así que un ajuste
cambiaba el número sin decir por qué.

## Decisión

1. **Se registra lo contado, no la diferencia.** Una fila en `conteos`: lo contado, lo que decía la app, la diferencia (calculada por
   la base) y la causa. El conteo que cuadra también se guarda: el panel de indicadores mide cuántos conteos cuadran.
2. **La diferencia la pone la base al guardar** (`registrar_conteo`), contra el stock de ese instante. La pantalla manda lo que vio
   (`p_segun_app`); si al guardar es otro número (entró una venta o una compra mientras se contaba), la base rechaza (P0C01) y la
   pantalla vuelve a comparar. Sin esto, «falta 1, se malogró» con una compra de 5 en medio quedaba como merma de 6 (lo encontró la e2e).
3. **La causa decide el movimiento** (decisión del 2026-11-17): «se malogró» entra como **merma**, para que el % de merma diga la
   verdad (principio 5); «se vendió sin anotar», «llegó sin anotar» y «no sé» entran como **ajuste**, con la causa escrita. Si no
   cuadra, hay que decir por qué; las causas que se ofrecen son las que pueden explicar esa diferencia.
4. **Cuentan el dueño, el administrador y el ayudante** (decisión del 2026-11-17: el ayudante cuenta al abrir el puesto). El contador
   solo lee. Queda la firma de quien contó.
5. **Solo `registrar_conteo` hace ajustes.** Ningún rol con sesión inserta un `ajuste` directo, ni el dueño, y nadie ata un movimiento a
   un conteo a mano. Como el ayudante tiene que poder ajustar por esta vía, la función es `security definer` y revisa el rol antes de
   tocar nada (como `fijar_hora_cierre`). El candado va en la RLS y no en un `check`: los 624 ajustes viejos del proyecto, de los
   scripts de demo, no se tocan.
6. **Necesita señal.** Sin saber qué dice la app no hay con qué comparar: el conteo no va a la cola del celular (CLAUDE.md, regla 10).
7. **A mano y por voz, con la misma tarjeta** (ADR-0010). A mano, el contador arranca en lo que dice la app (si cuadra, cero toques).
   Por voz, «conté 18 de mango, dos se malograron»: el intérprete tiene la herramienta `registrar_conteo`. Para el modelo, las causas se
   llaman `se_malogro`, `se_vendio`, `llego_mas` y `no_se`: con «anotar» en los nombres, «anótalo» (crédito) dejaba de leerse como
   crédito (/voz-precision 2026-11-17-6). Con manos libres se lee la diferencia y la causa y se confirma con «confirmo»; sin causa,
   se elige en la tarjeta.

## Lo que no se hizo

- Un flujo de aprobación (el ayudante cuenta y el dueño aprueba): se descartó por tiempo; el conteo queda firmado.
- Contar todas las frutas de una vez: se cuenta una por vez, desde su fila o dictando.
- Un ajuste a favor sigue contando como «llegada» de hoy para la frescura (`lib/inventario.ts`, `revision_de_una_llegada_que_existe`):
  cambiarlo toca otro módulo y se decide aparte.

## Consecuencias

- `registrar_conteo` se suma a los avisos del linter que se dejan a propósito (CLAUDE.md).
- INV-14 revisa que cada conteo haya dejado en el stock exactamente su diferencia, con el tipo que manda su causa.
- La lista de Stock tiene «Contar» en cada fruta y «Contar una fruta sin cajas» al final; la barra flotante sigue con dos píldoras.
