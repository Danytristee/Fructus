-- Un cliente no se crea dos veces con el mismo nombre (A8, alta de cliente a mano).
--
-- El problema: el alta de un cliente es un insert directo en una sola tabla (CLAUDE.md, «Reglas de capas»), sin nada que
-- mire si ese cliente ya existe. Un doble toque, o un reintento tras una respuesta que no llegó, creaba dos «Luis Paredes».
-- Con dos clientes que se llaman igual, la voz ya no puede elegir uno solo (buscar_clientes da la misma similitud a los
-- dos) y las deudas se reparten entre dos fichas: el cuaderno deja de decir la verdad (principios 3 y 4). Se corrige en la
-- base, no con un botón que se desactiva.
--
-- Qué cambia: no puede haber dos clientes activos con el mismo nombre, sin importar mayúsculas ni espacios de más. Quien
-- tiene de verdad dos «Juan Pérez» los distingue en el nombre («Juan Pérez (puesto 12)»): es lo que ya haría para
-- reconocerlos al dictar. Un cliente desactivado no bloquea: su nombre queda libre.
--
-- La acción de guardar toma el choque (23505) y, si el cliente que ya existe es idéntico al que se intentó guardar (un
-- reintento), responde con ese mismo cliente; si no, dice «Ya tienes un cliente con ese nombre».
--
-- Antes de aplicarla a un proyecto con datos: `select lower(btrim(nombre)), count(*) from clientes where activo group by 1
-- having count(*) > 1` debe salir vacío. El seed y las pruebas locales no repiten nombres.

create unique index clientes_nombre_unico on clientes (lower(btrim(nombre))) where activo;
