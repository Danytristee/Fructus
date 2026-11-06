# /formidable · Aviso «No pudimos conectar» (sin conexión con la base) · 2026-11-05

**Para quién:** el dueño o un ayudante, de pie en el puesto, con la señal del mercado cayéndose. **Finalidad:** saber en 5 segundos que
fue la señal (no su cuenta) y qué hacer: tocar «Volver a intentar» (CLAUDE.md, principio 8). **Rama:** `claude/sesion-sin-conexion`.
Dos lugares donde aparece: **el marco** (carga completa: no hay nada más que mostrar) y **bajo el encabezado de Hoy, Cierre y Ajustes**
(al navegar dentro de la app, cuando el rol no se pudo leer).

## 1. Medido (412 × 915, 360 × 800 y 1280 × 800) — con la API de la base caída

| | Antes (412 / 360) | Después (412 / 360) |
|---|---|---|
| Controles menores de 48 px | 0 / 0 | 0 / 0 |
| Título, contraste y tamaño | 7.54:1, 17 px | 7.54:1, 17 px |
| Cuerpo, contraste y tamaño | 15.6:1, 17 px | 15.6:1, 17 px |
| «Volver a intentar», tamaño | 219 × 56 / 219 × 56 | 348 × 56 / 296 × 56 |
| «Volver a intentar», posición (marco), desde arriba | 38–44 % / 40–47 % | **88–94 % / 86–93 %** |
| «Volver a intentar», posición (bajo el encabezado) | 21–28 % / 28–35 % | 19–25 % / 25–32 % |
| Scroll horizontal | 0 / 0 | 0 / 0 |
| «Tu cuenta todavía no está activa» en pantalla | no | no |

- JavaScript de «Hoy»: 177.2 KB brotli (tope 180), igual que antes (`pnpm build` y `medir:js / 180` con sesión).
- Capturas en `docs/formidable/capturas/sin-conexion-{marco,ajustes}-{antes,despues}-{412,360}.png`. El «antes» trae la pastilla «1 Issue»
  de las herramientas de Next (solo existe en desarrollo); el «después» la oculta.

## 2. Prueba ciega (Observado) — 1 agente sin contexto, solo las capturas a 412 px

| Pregunta | Respuesta |
|---|---|
| ¿Qué pasó? | «Se cortó internet, no que la app esté rota.» |
| ¿Qué tocas primero? | «Volver a intentar», y espera que el aviso desaparezca. |
| ¿Qué es «tu cuaderno»? | «Me suena a la lista de clientes… pero no sé si es esa lista, todo lo que anoto, o un nombre técnico. Dudo.» |
| ¿Se perdió lo que anotaste? | «No lo sé con seguridad. Lo creo por lo que dice.» |
| ¿Y el botón más abajo? | «Sí, con una caja en la mano solo me sirve el pulgar.» |

Una sola persona simulada: es una señal, no una prueba. Sigue pendiente repetirlo con el dueño.

## 3. Calificación (antes → después)

| Ley o regla | Nota | Por qué |
|---|---|---|
| 1 · Sin manual | 8 → 9 | Entendió qué hacer a la primera. Dudó con «tu cuaderno». |
| 2 · Una pregunta, una respuesta | 9 → 9 | Un mensaje y un botón. |
| 3 · Simplicidad profunda | 9 → 9 | Dice «señal», no «error de base de datos». |
| 4 · Lenguaje de puesto | 7 → 9 | «cuaderno» no es el nombre de ninguna pantalla (ya lo había marcado la pasada de A7). |
| 5 · Contenido primero | 8 → 8 | |
| 6 · Lo difícil, a un toque | 9 → 9 | |
| 7 · Perdonar | 10 → 10 | No hay nada que confirmar. |
| 8 · Quitar antes de agregar | 9 → 9 | Sin «Salir» ni menú: solo el reintento. |
| 9 · De punta a punta | 8 → 8 | Falta decir algo cuando el reintento sigue sin señal (ver «lista aparte»). |
| C1 · Pulgar | 5 → 9 | En el marco el botón pasó del 40 % al 90 % de la altura. Bajo el encabezado queda arriba, como todo aviso en el flujo. |
| C2 · Tamaño | 10 → 10 | 56 px de alto, ahora de ancho completo. |
| C3 · Sol | 10 → 10 | 7.54:1 y 15.6:1; 17 px. |
| C4 · Bordes | 10 → 10 | Sin desborde; en el marco usa `env(safe-area-inset-bottom)`. |
| C7 · Señal | 9 → 9 | Ícono y texto; no depende del color. |
| C8 · Velocidad | 10 → 10 | 177.2 KB, sin cambio. |
| Oficio visual | 9 → 9 | Mismas piezas (`Aviso`, `BotonReintentar`), sin estilo propio. |
| **Total** | **8.5 → 9.1** | |

## 4. Los 3 cambios (aplicados)

Se aplicaron sin esperar un OK separado porque son solo del componente nuevo (`SesionSinConexion`), no tocan dinero, stock, permisos ni
comprobantes, y la tarea que pidió esta pasada la autoriza. Quien dirige el proyecto puede revertirlos.

1. **Título sin «cuaderno»:** «No pudimos conectar con tu cuaderno» → «No pudimos conectar». Arregla la ley 4 y evita que «cuaderno»
   quedara solo en la segunda línea. Se verifica con el e2e (busca el texto).
2. **En el marco, el aviso baja a la zona del pulgar:** `content-center` → `content-end` con 40 px de margen y `safe-area` (en escritorio
   sigue al centro). Arregla C1. El e2e mide que el botón quede en el tercio de abajo a 412 y 360 px.
3. **El botón ocupa el ancho de la tarjeta:** `BotonReintentar` acepta `className`; el aviso pasa `w-full`. Arregla C2 con el pulgar de una
   sola mano. Se verifica en las capturas.

- **Lo que sobra (ley 8):** nada. No se agregó «Salir» ni un menú recortado.
- **Lo que nadie pidió y más importa:** hoy no se avisa que «Volver a intentar» sí intentó cuando la señal sigue caída: el aviso reaparece
  igual y parece que no pasó nada.

## 5. Lista aparte (sin ejecutar)

- Decir «Sigue sin señal» (o un aviso corto) cuando el reintento falla otra vez. Es estado de interfaz, no dinero.
- Los demás avisos de «No pudimos leer tu día / tu stock / tu cuaderno» usan la misma pieza `Aviso` en el flujo, arriba. Si C1 debe
  cumplirse también ahí, el cambio es de `Aviso`/`BotonReintentar` (una pieza), no de cada pantalla.
- Dentro de «Ajustes» (bajo el encabezado) el menú no se dibuja mientras no se sepa el rol; vuelve con el reintento.
