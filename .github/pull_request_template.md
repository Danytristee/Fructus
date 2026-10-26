## Qué cambia y por qué

<!-- 2 a 5 líneas en lenguaje de negocio: qué puede hacer ahora el dueño o el ayudante. -->

## Cómo se verificó

<!-- Comandos y lo que dieron. Si cambia una pantalla: captura a 412 px (y a 360 px si es nueva). -->

- [ ] **Pruebas en verde:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm knip`.
- [ ] **Si toca `supabase/`:** `supabase db reset`, `supabase test db` y `scripts/invariantes.sql` limpios. Cada migración nueva trae su prueba pgTAP (caso feliz, rechazo por rol y caso borde).
- [ ] **Si cambia o agrega una pantalla u hoja:**
  - captura a **412 px** adjunta;
  - controles de 48 px o más;
  - acción principal en el tercio de abajo;
  - sin scroll horizontal;
  - solo tokens de `globals.css` (nada de hex, `rgba()` ni `bg-white`);
  - `/formidable` corrido, o el cuerpo dice por qué no aplica.
- [ ] **Si la pantalla u hoja guarda:** `/chaos` corrido, sin hallazgos de gravedad 1 o 2 abiertos. Una pantalla de solo lectura lo declara.
- [ ] **Si toca la voz** (`lib/voz/`, `docs/interprete-voz.md`, `tests/interprete/`): `/voz-precision` antes y después, sin bajar ningún porcentaje.
- [ ] **Si hubo una decisión estructural:** ADR en `docs/adr/`.
- [ ] **Bitácora del día** en `docs/bitacora/`.

## Migraciones

<!-- Si el PR trae archivos nuevos en supabase/migrations/, marca uno. Si no trae, borra esta sección. -->

- [ ] **Ya aplicada al proyecto** con `apply_migration`, y el archivo tiene la versión real de `list_migrations`.
- [ ] **Por aplicar:** se aplica después de fusionar, con el OK de quien dirige el proyecto.
