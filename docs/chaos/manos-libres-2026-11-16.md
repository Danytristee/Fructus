# /chaos · Manos libres en la hoja de confirmación (2026-11-16)

**Rama:** `claude/confirmar-hablando`. **Semilla:** 2026111601. **Ataques:** 11. **Resistieron:** 9.

**Base:** local y compartida con otra sesión, así que no se hizo `db reset`.
- Antes: volcado de los datos de `public` y las 12 invariantes en orden.
- Después de cada ataque que escribió: invariantes en orden, sin dos ventas por comando y sin un «por voz» sin confirmar.
- Al final se restauró el volcado (truncar `public` y cargarlo con `supabase_admin`): 321 ventas, 452 comandos, 32 abonos y 220 compras, como antes.

**Cómo se atacó:** la voz y el micrófono simulados (`tests/e2e/manos-libres.ts`), salvo N4 y N5, que fueron con Whisper y el intérprete reales sobre audios sintéticos. La concurrencia, con dos sesiones de `psql` en paralelo.

## Hallazgos

### 1 · «45 con 50» se entiende como 50 al corregir (gravedad 2: dato malo propuesto)

Fructus dice los precios así («a 45 con 50 la caja»), y quien corrige lo repite igual. Whisper suele escribir los números en cifras.

- **Para repetirlo:**
  - La lectura es «10 cajas de Mango Kent, a 45 la caja…».
  - Corregir con «No, a 45 con 50».
  - El intérprete devuelve `precio_unitario: 50`.
- **Evidencia** (`/voz-precision` con 4 formas, `openai/gpt-oss-120b`):
  - «No, a cuarenta y cinco con cincuenta» → 45.5 ✅
  - «No, a 45 con 50» → **50** ❌
  - «No, a 45.50» → 45.5 ✅
  - «No, a cuarenta y cinco cincuenta» → 45.5 ✅
  - Con el audio real («no, a cuarenta y cinco con cincuenta»), la corrección volvió con 45: no aplicó el cambio.
- **Por qué no es gravedad 1:** no se guarda solo. La venta corregida se vuelve a leer («a 50 la caja… Total, 500 soles») y hay que decir «confirmo». Pero un precio mal oído en la lectura pasa fácil con el ruido del puesto.
- **Arreglo propuesto (con OK):**
  - Decirle al intérprete, en el mensaje de corrección, que «45 con 50» son 45.50.
  - Medir antes y después con estos 4 casos sumados a `casos.json`.
  - Ver si también hace falta en el dictado normal: eso tocaría el prompt de sistema, con su `/voz-precision` completo.

### 2 · Toca permisos: el detalle va solo por chat (candado 4)

Una venta confirmada por dos cuentas a la vez sobre el mismo comando queda bien guardada (una sola venta, invariantes en orden), pero el comando no queda marcado. Viene de antes de esta obra.

## Riesgo aceptado (no es hallazgo)

- **k · «correcto» dicho por otra persona:** guarda.
  - Whisper no distingue quién habla, y así lo acepta el ADR-0020 (Consecuencias). Lo baja el audífono que suprime el ruido.
  - La venta queda con `confirmado_por = 'voz'` para auditar. Solo el dueño o el administrador anulan.

## Resistieron

- **N1 · Tocar Confirmar y decir «confirmo» a la vez:** una venta. Queda «por toque»: tocar toma el control y la respuesta tardía de la voz no cuenta.
- **N2 · Doble «confirmo»:** una sola petición, una venta y un solo «Guardado».
- **N3 · Se cae la red justo al guardar por voz:**
  - La venta pasa a la cola del celular, la hoja dice «Quedó en el celular» y no dice «Guardado».
  - La cola la reenvía sola: una venta, con `confirmado_por = 'voz'`.
- **N4 · «Correcto, pero son ocho»** (Groq real): no confirma. Corrige a 8 cajas y vuelve a leer.
- **j · Sin señal justo cuando llega «confirmo»:** «Quedó en el celular», sin «Guardado». Al volver la señal: una venta, por voz.
- **d · Recargar con la hoja escuchando:** «Tienes una venta sin confirmar» → «Verla» → se lee otra vez → «confirmo» → una venta.
- **b · La respuesta llega después de tocar la tarjeta:** no guarda nada.
- **l · «Repite» cinco veces:** lee otra vez 2 veces, repregunta 1 y deja la tarjeta para tocar («No guardé…»). No hay bucle.
