# 2026-11-16 · Stock «Qué hacer» en dos grupos, y la migración que quedó fuera de main

- **Qué cambió:** de la maqueta `docs/maquetas/frescura/numero-y-filtros.html` se eligió la variante C. «Qué hacer» ya no lleva número en la pestaña ni filtros: los avisos van en «Para hoy» y «Puede esperar» (plegado tras «Ver N avisos»). La regla es `porUrgencia` en `lib/inventario-reglas.ts`.
- **Cómo se verificó:** Vitest, e2e de Stock a 412 y 360 px (53 en verde), medida en el navegador (primer aviso al 23 % y 30 % de la pantalla, 0 controles chicos, 0 desborde) y una prueba a ciegas: contar lo que pide hoy subió de 3 a 5; lo demás quedó igual (`docs/formidable/frescura-2026-11-14.md`, sección 7).
- **`temperaturas_solo_agregar` no llegó a `main`:** el PR 36 apuntaba a la rama del PR 35 y se fusionó 19 segundos después de que el 35 entrara a `main`. Su commit quedó en `claude/frescura-seguimiento`. Esta rama lo trae. **La migración sigue solo en local: falta el OK para aplicarla al proyecto.**
- **Pendiente:**
  - Los 3 cambios que propone la sección 7 esperan OK («Te sobran» fuera de «Para hoy», la cuenta de «Compra unas N cajas», «Ver N avisos» con pista).
  - La corrida completa de los 70 casos de voz no se hizo antes de fusionar el PR 35 (cupo de Groq: una por día).
  - Un PR apilado se abre contra `main`, no contra la rama de otro PR, para que no vuelva a quedar huérfano.
