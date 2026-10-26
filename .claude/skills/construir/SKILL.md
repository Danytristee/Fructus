---
name: construir
description: Ejecuta una construcción grande de Fructus (pantalla nueva, módulo, migración con RPC e interfaz, flujo de voz) actividad por actividad — cada una un corte vertical verificable a ancho de celular, con su propio commit, sin desviarse a nada fuera de esa actividad. Úsala para trabajo de varios pasos que normalmente se dispersa; no la uses para un arreglo de un solo archivo.
---

Construye $ARGUMENTS con este protocolo. Objetivo: cortar el divagar, no añadir ceremonia. (Viene de la skill homónima de CAYLA Retail.)

## 0. Apuesta el alcance antes de tocar código

Arma la lista COMPLETA de actividades. Cada actividad es un **corte vertical demostrable de punta a punta**: «registrar un abono por voz»
es esquema + RPC o insert + prueba pgTAP + interpretación + tarjeta + pantalla + prueba e2e a 412 px. Una capa sola («todo el esquema») no
es una actividad: es un tercio de varias.

Ordénalas por dependencia técnica primero y por valor para el dueño como desempate. Preséntala como lista numerada corta, una línea por
actividad, con **qué queda demostrable al cerrarla**, y espera aprobación o ajuste explícito antes de escribir una sola línea de código.
Es la única pausa dura del flujo.

## 1. Por cada actividad aprobada, en orden, sin adelantarte a la siguiente

a. **Anuncia** en una línea qué vas a hacer y cómo lo vas a verificar: comando, prueba o pantalla en el navegador a 412 px. Nunca «debería funcionar».
b. **Constrúyela completa.** Sin excepciones: ningún refactor «ya que estoy aquí», ninguna mejora oportunista, ningún archivo fuera de lo que la actividad necesita.
c. **Verifícala con evidencia real:**
   - las pruebas en verde;
   - el navegador a 412 y 360 px si es pantalla;
   - la consulta a la base si guarda;
   - `scripts/invariantes.sql` limpio si escribió.

   Aplica «Antes de decir listo» de `CLAUDE.md`: concurrencia, caída externa y persona sin contexto.
d. Si la actividad cierra una pantalla u hoja: **ofrece `/formidable`** y, si guarda, **`/chaos`**. No la des por cerrada sin ellas, o di explícitamente que quedan pendientes.
e. **Un commit por actividad** (Conventional Commits, scope del dominio). Nunca mezclado con la siguiente.
f. **Reporta** en 3 líneas (QUÉ HICE / POR QUÉ ASÍ / QUÉ SE ROMPERÍA SIN ESTO) y pasa a la siguiente.

## 2. Si algo FUERA de la actividad la bloquea

No inventes una regla. Aplica el test de `/decide`. Si lo pasa, detente y pregunta con Ganas/Pagas, tu recomendación y «si no respondes,
ejecuto [X]». Si no lo pasa, resuélvelo, sigue y dilo en el reporte de esa actividad.

## 3. Si algo NO bloquea pero vale la pena arreglar

No lo toques. Anótalo con `archivo:línea` en la sección «Pendiente» de la entrada de bitácora de la sesión (`docs/bitacora/AAAA-MM-DD-<tema>.md`)
y sigue. Si solo lo mencionas en el chat, se pierde.

## 4. Si la LISTA completa resulta estar mal

Si falta una actividad, el orden no sirve o una actividad era en realidad dos: detente del todo, explica por qué y repropón la lista
completa. No sigas por inercia con un plan que ya sabes que está mal.

## 5. Al cerrar la última actividad

- Escribe la entrada de bitácora del día.
- Escribe un ADR si en el camino hubo una decisión estructural.
- Abre el PR con `/abrir-pr`.
