# 2026-10-28 · Todas las pantallas con datos y el dashboard de inventario

**Qué cambió (pedido para las capturas del informe):**
- **Stock: dashboard inteligente de inventario** (`lib/inventario-reglas.ts`, lógica pura con su prueba). Para cada fruta mira la
  demanda de 7 días, cuántos días le alcanza, y la edad del lote más viejo (primero que entra, primero que sale) contra su vida útil.
  Alerta y recomienda:
  - **por malograrse:** el lote ya gastó el 85 % de su vida útil, véndelo hoy;
  - **por reponer:** alcanza para menos de 2 días, compra para 4;
  - **sobrestock:** al ritmo de venta, parte se malogra antes de venderse;
  - **sin movimiento:** no se vendió en 7 días.

  Tiene un anillo de salud del inventario, filtros por tipo de alerta y frutas que se despliegan con su frescura.
- **Clientes:** el cuaderno con el total que te deben, buscador, filtro «te deben / al día» y fichas desplegables.
- **Ventas:** la semana agrupada por día, con días que se abren y filtro contado / crédito.
- **Cierre:** el efectivo que debería haber en la caja, un anillo contado / crédito y lo que entró y salió por medio de pago
  (`lib/cierre-reglas.ts`).
- **Ajustes:** el catálogo con buscador y el equipo.
- **Hoy:** un aviso que lleva a Stock con lo más urgente.
- **Piezas nuevas:** `Filtros`, `Desplegable`, `IconoFruta` y `BuscadorCatalogo`. Animaciones nuevas en tokens (barras que se
  llenan, anillos que se dibujan, pulso de la alerta urgente), todas apagadas con «reducir movimiento».
- **`scripts/demo/historia-demo.sql`:** 13 días de demo con lotes armados para que aparezca cada alerta. Las compras de demo se
  pagan por transferencia.

**Cómo se verificó:**
- `pnpm test` (50), Knip y las 58 pruebas e2e a 412 y 360 px, en verde.
- Las 5 pantallas a 412 y 360 px: sin scroll horizontal, sin controles de menos de 48 px y sin errores en consola.
- Las pantallas responden en menos de 0.12 s en caliente.

**Pendiente:**
- **La vida útil de cada fruta** es un valor de referencia en `lib/inventario-reglas.ts`. Hay que confirmarla con el dueño (con o
  sin cámara de frío) y, si cambia seguido, pasarla a una columna de productos.
- **El cierre todavía no tiene el fondo de caja inicial.**
- **Las suites e2e** tardan y fallan de a ratos cuando en la misma máquina corren los Supabase de otros proyectos (`docker stats`).
