---
name: chaos
description: Usa MAL Fructus a propósito, pantalla por pantalla y en local, para encontrar lo que se rompe antes de que lo rompa el dueño un sábado con el puesto lleno — doble toque en Confirmar, se cae la red al guardar, dos ayudantes registran lo mismo, una frase de voz ambigua o con ruido, un monto con coma, una URL ajena. Después de cada ataque que escribe corre las invariantes de la base, porque lo grave no es la pantalla caída sino el descuadre que nadie ve. Entrega un informe rankeado y, con OK, la prueba de regresión y el arreglo de UNA pantalla. Obligatoria al terminar toda pantalla u hoja que guarda. Úsala cuando digan «chaos», «rómpelo» o «qué pasa si lo usan mal».
---

Ataca esta pantalla o ruta: $ARGUMENTS   (`--semilla N` repite una corrida exacta; sin argumento, pregunta cuál y para)

Viene de `/chaos` de CAYLA Retail, recortada a lo que Fructus tiene y con una familia nueva: **la voz**.

**Contrato.**
- **Promete:** un informe de UNA pantalla con lo que se rompe al usarla mal. Cada hallazgo trae los pasos para repetirlo, la semilla y la evidencia de la base, ordenado de peor a menos malo. Lo que se escribió en la base local se deshace.
- **Asume:** Supabase local arriba (`npx supabase start`), tu rama actual, las cuentas de prueba y datos inventados.
- **No hace:**
  - tocar el proyecto de Supabase alojado;
  - emitir fuera del sandbox;
  - cambiar reglas de dinero, stock, permisos o comprobantes;
  - arreglar algo antes de que el informe se lea.

## Candados

1. **Solo local.** La app debe hablar con el Supabase local (`http://127.0.0.1:54321` por defecto; revisa `supabase status`). Nunca uses el conector de Supabase contra el proyecto alojado para atacar.
2. **Todo se deshace.**
   - **Antes de empezar:** `pg_dump --data-only` de la base local a un archivo del scratchpad.
   - **Al terminar:** `npx supabase db reset`, o restaurar el volcado si había datos que quieres conservar.
3. **Datos inventados.** Usa las cuentas de prueba del seed y no repitas sus contraseñas en el informe.
4. **Un hallazgo de permisos o de seguridad no va a un archivo versionado:** solo al chat.

## Familias de ataque

| Familia | Ataques típicos | Capa |
|---|---|---|
| **Doble toque** | Confirmar dos veces seguidas, o 5 veces en el mismo tick (`javascript_tool`: `for … boton.click()`) | navegador + base |
| **Red** | Parchar `window.fetch` para que falle, tarde 10 s o pierda la respuesta justo al confirmar; modo avión a mitad de la grabación | navegador |
| **Voz** | Frase ambigua («dale lo de siempre»), sin precio, sin cliente, dos clientes en una frase, número dicho en palabras, nombre que no existe, audio vacío, audio de 60 s, ruido de fondo, otro idioma | navegador + `/api/voz` |
| **Entradas hostiles** | Monto con coma («1,299.50»), negativo, cero, 10 dígitos, texto de 5000 letras, emojis, RUC mal formado | navegador + base |
| **Concurrencia** | Dueño y ayudante registran una venta a crédito al mismo cliente a la vez; anular mientras otro abona | base (dos sesiones `psql` en paralelo, con `request.jwt.claim.sub` de cada cuenta) |
| **Permisos y URL** | El ayudante intenta anular; el contador intenta insertar; abrir `/ventas/<id ajeno>`; llamar la RPC directo sin sesión | base + navegador |
| **Celular** | 360 px, teclado abierto tapando Confirmar, girar la pantalla, volver atrás a mitad del flujo | navegador |
| **Sesión** | Sesión vencida al confirmar; recargar con la tarjeta abierta | navegador |

**Núcleo obligatorio** (corre siempre que la pantalla guarda): doble toque, red cortada al confirmar, una frase de voz ambigua, un monto con coma y la concurrencia de dos cuentas. Además se sortean **5 ataques al azar** del resto con la semilla, que se anota siempre.

## Método

1. **Terreno.**
   - `git status`.
   - `supabase status`.
   - Confirma que la app apunta al local.
   - Haz el volcado de respaldo.
   - Corre `psql "$DB_URL" -f scripts/invariantes.sql`: debe salir limpio **antes** de atacar. Si no sale limpio, para y repórtalo.
2. **Ingredientes.** Lee la pantalla y anota qué tiene: campos, montos, voz, RPC que llama, `id` en la URL, rol que la usa. Arma el plan: el núcleo más 5 ataques de azar con la semilla. Dilo en dos líneas y sigue.
3. **Por cada ataque, uno por uno:**
   - Anúncialo.
   - Ejecútalo y guarda la evidencia: captura, consola y red, y la consulta a la base.
   - Si escribió, corre las invariantes. Solo cuentan las violaciones **nuevas**.
   - Restaura el estado antes del ataque siguiente.

   No arregles nada todavía, ni lo obvio.
4. **Gravedad** (la decide la evidencia, no el ataque):
   - **1 · Estado imposible:** dos ventas por un doble toque, stock que no cuadra, comprobante duplicado.
   - **2 · Dato malo en silencio:** «1,299.50» guardado como 1.29, una venta sin autor.
   - **3 · Pantalla caída:** página en blanco o error 500, con la base bien.
   - **4 · Error feo pero seguro:** sale un código de Postgres a la vista en vez de una frase de puesto.

   Un rechazo claro sin nada escrito **no es hallazgo**: se anota como «resistió».
5. **Informe**, primero en el chat y una copia en `docs/chaos/<slug>-AAAA-MM-DD.md`. Lleva:
   - pantalla, rama, semilla y conteo (atacados / resistieron);
   - hallazgos agrupados por causa, del más grave al menos grave;
   - para cada uno: los pasos para repetirlo y la evidencia.
6. **Con el OK**, por cada hallazgo elegido:
   - primero la prueba que falla (pgTAP o e2e);
   - después el arreglo;
   - después el mismo ataque con la misma semilla, que ahora debe resistir.

   Lo de dinero, stock, permisos y comprobantes lo decide siempre quien dirige el proyecto.
