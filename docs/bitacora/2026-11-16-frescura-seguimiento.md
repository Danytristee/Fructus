# 2026-11-16 · Aviso de frescura: seguimiento después de fusionar el PR 34

- **El CI no está corriendo.** Desde el 5-11 todas las corridas terminan en `startup_failure`, en todas las ramas y también en la tarea programada que mantiene despierta la base (100 seguidas; la última buena es del 4-11). Los archivos de `.github/workflows/` no cambian desde el 28-10: apunta a la cuenta dueña del repositorio (cupo o facturación de Actions). El PR 34 se fusionó sin ningún chequeo. Hasta que se arregle, lo que hacía el CI se corre a mano.
- **Lo que el CI no verificó, verificado a mano:** en una base nueva, con los nombres finales de las migraciones, pgTAP 195 de 195 e invariantes en orden.
- **Voz (`docs/voz/precision-2026-11-16.md`):** primera corrida completa desde el 31-10. Intención 97.1 %, datos clave **82.9 %** (meta 90 %), prudencia con el dinero 100 %. Tres casos los rompió esta obra: las reglas de la temperatura, de «cómo llegó» y de «qué sale hoy», puestas en el prompt general, hicieron que el modelo dejara de entender «¿Cómo voy?», «¿Cuántas cajas de mango me quedan?» y «Le di 50 al cargador» (comprobado con el prompt de antes y el de ahora). **Corregido:** esas reglas van en la descripción de cada herramienta, y que «manzana verde» no es «llegó verde» se decide contando (`lib/voz/como-llego-reglas.ts`). Medido en 11 casos: intención 11 de 11.
- **Qué más cambió en esta rama:**
  - `fecha_del_celular` lleva su versión real del proyecto (`20261112071132`).
  - Las pruebas de exportar el mes insertan y después mueven la fecha: `exportar-mes.spec.ts:181` y `:258` y `hoy.spec.ts:64` vuelven a pasar.
  - «Hoy» pide la temperatura siempre que falte la de hoy, y dice «del puesto». La cuarta fruta de un aviso abre su porqué desde «Ver las N frutas».
  - Maqueta con tres variantes para el número de «Qué hacer» y los filtros: `docs/maquetas/frescura/numero-y-filtros.html`. **Espera elección.**
- **Base de pruebas propia.** La base local es compartida y otra sesión la estaba usando. Esta sesión levantó la suya (`npx supabase start --workdir <copia de supabase/ con otro project_id y otros puertos>`), y las pruebas leen su contenedor de `SUPABASE_DB_CONTENEDOR` en `.env.development.local`. Nada versionado cambia de puertos.
- **En otra rama (`claude/temperaturas-solo-agregar`):** las lecturas de temperatura solo se agregan; nadie las edita ni las borra por la API. pgTAP 205 de 205. **La migración está solo en local: falta el OK para aplicarla al proyecto.**
- **Pendiente:**
  - La corrida completa de los 70 casos de voz con la corrección (cupo diario de Groq: una por día).
  - Para llegar a 90 % en datos clave: los apodos de clientes («flaco Carlos», «el Mochica») y la selección de la fruta («plátano isla», «de segunda»). No son de esta obra.
  - Actividad 5: la clave de Anthropic no quedó guardada en `.env.local` (el renglón sigue vacío).
  - `GEMINI_API_KEY` está vacía en todas las copias locales: revisar que exista en Vercel, o la voz no tiene respaldo.
  - `tests/e2e/stock-compra.spec.ts:206` sigue fallando (venía de antes).
