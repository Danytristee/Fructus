# 2026-10-28 · El enlace de invitación ya no lo gasta la vista previa de WhatsApp

**Qué cambió:**
- `/auth/confirmar` dejó de ser una ruta que canjea el enlace al abrirse. Ahora es una página con un botón, «Elegir mi clave», y el
  enlace se canjea con una server action recién al tocarlo.
- ADR-0009 queda al día.

**Por qué:** los registros de Auth del proyecto mostraron que el enlace de Nicole se canjeó con éxito 36 s antes de que ella lo
abriera. Fue la vista previa de WhatsApp, que abre los enlaces sola. Lo más probable es que al primer enlace le haya pasado lo mismo.

**Cómo se verificó:** `tests/e2e/invitacion.spec.ts`, 4 pruebas en verde a 412 y 360 px:
- abrir el enlace primero como vista previa no lo gasta;
- el botón entra;
- un segundo canje lleva a «enlace vencido»;
- un enlace inventado tampoco entra.

**Pendiente:** generar un enlace nuevo para Nicole cuando esto esté publicado.
