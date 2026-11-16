# 2026-11-15 · Aviso de frescura: los 3 cambios de /formidable y los 4 arreglos de /chaos

- **Qué cambió (con OK del 14-11):**
  - «Hoy»: la fruta que tiene que salir y el pedido de temperatura son renglones debajo de «Vendiste hoy» (`AvisosDeHoy`, pieza `Renglon`).
  - Stock: los avisos primero y los filtros después, sin números; cada fruta del aviso a todo el ancho.
  - Hoja «¿por qué?»: palabras de puesto («El calor de cada día», «Revísala antes de vender») y ya no se queda vieja tras una merma.
  - `/chaos`: nada queda fechado en el futuro (ajuste de ADR-0019); las cajas de hace más de 45 días piden revisarse hoy; la temperatura por voz acepta hasta tres cifras.
- **Cómo se verificó:** medido antes y después a 412, 360 y 1280 px (`docs/formidable/frescura-2026-11-14.md`, sección 6): en «Hoy» los avisos empiezan al 51 % y 58 % (antes 87 % y 101 %); en Stock el primer aviso, al 19 % (antes 38 %). Prueba ciega repetida: «Hoy» de 4 a 6; Stock y la hoja siguen en 6. Nota 7.3 → 7.8. Los 19 ataques de `/chaos` con la misma semilla: 18 resisten y queda 1 observación. Vitest 726, pgTAP 195, invariantes limpias; «Hoy» en 153.9 KB de 180.
- **Solo en la base local:** las tres migraciones (`temperatura_diaria`, `como_llego_la_fruta`, `fecha_del_celular_sin_futuro`). Falta el OK para aplicarlas al proyecto de Supabase, renombrarlas a su versión y correr `get_advisors`.
- **Pendiente:**
  - Actividad 5 (Sonnet estima cuánto aguanta cada fruta, con «Sigue buena»): falta la clave de Anthropic en `.env.development.local`.
  - `/voz-precision`: falta la clave de Groq en este worktree.
  - `tests/e2e/exportar-datos.ts:83` (y las demás inserciones con `fecha`): inserta con fecha de un mes pasado, que la base cambia por la de hoy desde el 12-11 (ADR-0019). `exportar-mes.spec.ts:181` y `:258` fallan y ensucian `hoy.spec.ts:64`. Arreglo: insertar y después mover la fecha, como en `stock-frescura.spec.ts`.
  - `tests/e2e/stock-compra.spec.ts:206` sigue fallando (venía de antes).
  - `components/inventario/TarjetaAlerta.tsx:112`: en la hoja «Ver las N frutas», las frutas que tienen que salir no abren su porqué.
  - Lo que queda de la 2.ª prueba ciega está en la sección 6 del informe de `/formidable`.
