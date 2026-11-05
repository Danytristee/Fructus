# /chaos · Alta y edición de un cliente (A8) · 2026-11-05

**Rama:** `claude/cuaderno-stock-ventas`. **Base:** local; las invariantes salieron en orden después de cada ataque que escribió. Solo
dueño y administrador usan la hoja (la base también lo exige: `clientes_gestion`).

**Plan.** Pasada compacta, **sin sorteo**: elegí los ataques según lo que la hoja tiene. Núcleo: cinco toques en el mismo tick, red
cortada y respuesta perdida (están como pruebas permanentes en `clientes-alta.spec.ts`), entradas hostiles, y dos cuentas a la vez. La voz
no aplica. El ayudante y el contador están en pgTAP (`10_cliente_nombre_unico.test.sql`) y en el e2e: no ven el botón y la base les
rechaza el alta y la edición.

**Conteo:** 7 ataques; 6 resistieron, 1 hallazgo (gravedad 2). Ninguno dejó la base en un estado imposible.

## Hallazgos

### 1 · Gravedad 2 · Dos ediciones a la vez: la última pisa a la primera, sin avisar

- **Pasos:** el dueño y un administrador abren «Editar» del mismo cliente → el dueño cambia el teléfono y el administrador agrega un
  apodo → los dos tocan «Guardar cliente» al mismo tiempo.
- **Evidencia:** los dos ven «Cambios guardados». En la base queda el apodo nuevo y el teléfono **viejo**: el cambio del dueño se perdió.
- **Por qué importa:** poco probable (dos personas editando al mismo cliente en el mismo segundo), pero es un dato que se pierde en silencio
  después de decirle a la persona que se guardó.
- **Causa:** la edición manda la fila entera (todos los campos) y la última escritura gana.
- **Arreglo propuesto:** mandar y guardar solo lo que la persona cambió (compara el borrador con lo que abrió). Así dos cambios en campos
  distintos se suman. Dos cambios al mismo campo siguen ganando el último, que es lo esperable. No toca dinero ni permisos.

## Resistieron

| Ataque | Resultado |
|---|---|
| 5 clics en el mismo instante sobre «Guardar cliente» | 1 cliente |
| Dueño y administrador guardan el mismo nombre a la vez (con teléfonos distintos) | 1 cliente; el otro recibe «Ya tienes un cliente con ese nombre. Agrega algo para distinguirlos…» (el sello del ganador ya había pasado a su ficha cuando se miró: una falla de la medición, no de la app) |
| Respuesta perdida al guardar y reintento | 1 cliente; el reintento devuelve el mismo y abre su ficha |
| Nombre de 5000 letras, con etiquetas `<b>`, comodines `%_\`, emojis y espacios de más | El campo corta en 80; el nombre se guarda limpio y la ficha lo pinta como texto, sin HTML |
| Un 9.º apodo, uno de 41 letras y uno repetido | «Con 8 apodos alcanza.», «Un apodo no puede pasar de 40 letras.», «Ese apodo ya está.» |
| La sesión vence con la hoja abierta | «Tu sesión terminó. Vuelve a entrar y guarda al cliente otra vez.» y el botón «Entrar otra vez»; 0 clientes |
| Se borra el cliente mientras se edita | «No encontré a ese cliente: puede que ya no esté en tu cuaderno.» |

## Notas

- Dos clientes distintos pueden tener el mismo DNI o RUC: la base no lo impide. No es un hallazgo (no rompe un total), pero conviene
  decidirlo antes de emitir facturas (A9).
- La migración `20261105180000_nombre_cliente_unico.sql` está probada en local (10 pruebas pgTAP). **No se ha aplicado al proyecto de
  Supabase:** va con el OK, junto con la de anular ventas, y se renombra a la versión real que asigne Supabase.
