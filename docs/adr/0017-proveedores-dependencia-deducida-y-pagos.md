# ADR-0017 — Proveedores: la dependencia se deduce de tus compras y la deuda con ellos baja con pagos

**Fecha:** 2026-11-12 · **Estado:** aceptado

## Contexto

Quien dirige el proyecto pidió un apartado de proveedores para saber a quién le compra más (de quién depende) y quién depende más de
él, para negociar mejores precios. Había dos huecos:

- Una compra al crédito subía la deuda con el proveedor, pero no había dónde anotar que se le pagó. La deuda solo podía crecer: un
  estado imposible (principio 3).
- Fructus no ve las ventas del proveedor, así que no puede saber de verdad cuánto pesa el puesto en su negocio.

El 2026-11-12, quien dirige el proyecto eligió que la dependencia del proveedor **se deduzca sola**, sin pedirle al dueño una
estimación.

## Decisión

- **Esquema** (`20261112120000_proveedores_completos.sql`):
  - `pagos_proveedor`: solo se agregan filas, como en `abonos`. Un comando, un pago (índice único parcial).
  - `v_saldo_proveedores`: deuda = compras al crédito − pagos.
  - `compras_por_proveedor(desde)`: una fila por proveedor y fruta, porque Supabase corta en 1000 filas.
  - `proveedores` suma contacto, origen, dirección y notas, y su nombre no se repite entre los activos.
- **Las reglas** viven en `lib/proveedores-reglas.ts` y `lib/negociacion-reglas.ts`, y miran los últimos 90 días:
  - **Dependes de él** si se lleva el 25 % o más de tus compras, o si es tu única fuente de una fruta que pesa el 5 % o más de lo
    que compras. La única fuente se mira por fruta, no por calibre: que otro te traiga otro kiwi ya cuenta.
  - **Eres su cliente fijo** si le compras cada 7 días o menos, desde hace 60 días o más, y le compraste en los últimos 14. Así se
    lee «él depende de ti». La pantalla lo dice como «eres su cliente fijo», no como «depende de ti»: es una deducción.
  - De eso sale un veredicto:
    - **Dependes de él:** dependes de él y no eres su cliente fijo, o es tu única fuente de algo.
    - **Socio: negocia volumen:** se necesitan los dos.
    - **Pide mejor precio:** eres su cliente fijo y tienes otras opciones.
    - **Ocasional.**
    - **Se enfrió:** más de 30 días sin comprarle.
  - Las razones para negociar:
    - el mismo producto más barato con otro proveedor, y cuánto ahorrarías al mes (desde S/ 100);
    - que su último precio esté 4 % o más sobre su promedio;
    - la deuda que tienes con él.
- **El pago a mano** abre un comando, como el abono (ADR-0010): un doble toque no paga dos veces.

## Consecuencias

- Los umbrales (25 %, 5 %, 7 días, 60 días, S/ 100) son una primera apuesta para un puesto de 20 a 60 ventas al día. Si en el puesto
  real no cuadran, se cambian en `lib/proveedores-reglas.ts` y en sus pruebas.
- Si el dueño quiere decir de verdad cuánto pesa en su proveedor, se agrega como dato opcional, sin quitar la deducción.
- Falta el pago por voz («le pagué 500 a Chao»): la tabla ya acepta `comando_voz_id`.
