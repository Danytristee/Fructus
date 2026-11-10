# ADR-0015 — Escritorio con panel lateral (dirección A, con las tablas de B)

**Fecha:** 2026-11-09 · **Estado:** aceptado

## Contexto

En escritorio, la app era la columna del celular centrada: a 1280 px quedaban dos tercios de la pantalla vacíos. El escritorio es para quien
revisa: el administrador y el contador (CLAUDE.md, «Para quién es»). Se compararon tres direcciones como maquetas tocables, en Bosque, en
`docs/maquetas/escritorio/`: A, panel lateral; B, barra arriba y tablas; C, riel y mostrador. Quien dirige el proyecto eligió **la A, con
las tablas de la B en Clientes y Ventas**.

## Decisión

- **Desde 1024 px** (el `lg` de Tailwind) la app usa el marco de escritorio. Por debajo de ese ancho, celular y tablet no cambian.
- **Panel lateral verde a la izquierda** (`components/marco/PanelLateral.tsx`):
  - lleva el ícono, los cuatro destinos (Hoy, Clientes, Stock, Ventas) y, separados, Cierre del día y Ajustes, según el rol;
  - abajo, quién entró y «Más», que es el mismo menú del celular, con el aviso del día, instalar la app y salir;
  - reemplaza a la barra de abajo y al botón de tres rayas de la cabecera, que en escritorio no se dibujan.
- **La cabecera** de cada pantalla pierde el verde en escritorio, porque el verde ya es el panel. Queda el título con su barra lima, sobre el marfil.
- **El contenido** mide hasta 1240 px, a la derecha del panel. Las píldoras flotantes y el orbe se centran en ese espacio, no en la ventana.
- **La voz sigue solo en «Hoy»,** con el orbe abajo y al centro del contenido. Llevarla al panel es la idea «voz en todas las pantallas»,
  que sigue esperando su OK.
- **Clientes y Ventas usan tablas** en escritorio (la parte de la B que se tomó), y las demás pantallas van a dos columnas. Cada una entra en
  su propia actividad.
- **Las hojas** (`components/ui/Hoja.tsx`) ya se ven centradas desde 768 px y no cambian.

## Consecuencias

- La regla 5 de «Celular primero» en CLAUDE.md suma el panel lateral en escritorio.
- Hay pruebas a 1280 px: `tests/e2e/escritorio.spec.ts` (navegación, rol y menú) y la auditoría visual a ese ancho. Corren una sola vez, en
  el proyecto `s25-412`, con el viewport cambiado.
- Una pantalla nueva tiene que verse en los dos marcos: a 412 y 360 px con la barra de abajo, y a 1280 px con el panel.
