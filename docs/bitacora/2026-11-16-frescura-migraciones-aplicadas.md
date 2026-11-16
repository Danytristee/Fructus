# 2026-11-16 · Aviso de frescura: las tres migraciones, aplicadas al proyecto

- **Qué cambió:** con OK, se aplicaron al proyecto de Supabase (`fwrqquugiktwklleqwfa`) y los archivos tomaron la versión que les asignó:
  - `20261114190000_temperatura_diaria` → `20261116161805_temperatura_diaria`
  - `20261114200000_como_llego_la_fruta` → `20261116161825_como_llego_la_fruta`
  - `20261114210000_fecha_del_celular_sin_futuro` → `20261116161837_fecha_del_celular_sin_futuro`
- **Cómo se verificó, en el proyecto:**
  - Ninguna fila tocada: 159 ventas y 1465 movimientos antes y después.
  - `fecha_del_celular()` devuelve la hora del servidor para una hora dos minutos adelante y respeta una de hace seis horas.
  - `temperaturas` tiene RLS, sus tres políticas, su trigger de fecha y sus índices; `v_temperatura_dia` es `security_invoker`; ninguna función propia la ejecuta `anon`.
  - `registrar_compra` y `fecha_del_celular` son idénticas a las de la base local (misma huella), y también las políticas, los índices, las vistas y los triggers.
- **Avisos del linter (`get_advisors`):** en seguridad, ninguno nuevo. En rendimiento, cuatro, todos de `temperaturas` y de los tipos que CLAUDE.md ya deja para antes de producción: una llave foránea sin índice (`registrado_por`), políticas permisivas múltiples en `SELECT` e `INSERT` (el mismo patrón de roles que en gastos) y `temperaturas_fecha` «sin usar» (la tabla nació vacía).
- **Tipos:** `lib/supabase/tipos-db.ts` no cambia: ya traía `temperaturas`, `v_temperatura_dia` y `estado_llegada`.
- **Pendiente:**
  - `supabase/migrations/20261112190000_fecha_del_celular.sql` está aplicada en el proyecto como `20261112071132` (viene de antes de esta obra y también está así en `main`): el archivo no tiene su versión real. No cambia el resultado, porque la migración que queda en medio (`proveedores_completos`) no toca esas funciones.
  - La base local es compartida y la está usando la rama `claude/confirmar-hablando` (trae `comandos_voz.confirmado_por`): no se rehízo. Su historial todavía lista estas tres migraciones con la versión vieja; se arregla con el próximo `npx supabase db reset` desde esta rama.
  - Abrir el PR con `/abrir-pr`. Siguen pendientes la actividad 5 (clave de Anthropic) y `/voz-precision` (clave de Groq).
