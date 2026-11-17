# 2026-11-16 · Las e2e ya no dependen de los avisos de seguridad de npm

- **Qué cambió:** el `pnpm dev` que levanta Playwright corre con `PRUEBAS_E2E=1`, y así `next.config.ts` pone `experimental.agentUpgrade: false`. Ese servidor no consulta los avisos de npm: no pinta la píldora «Insight» ni se cierra si lo corre un agente. Fuera de las e2e, el aviso sigue igual (`next build`, `pnpm dev`). Además, `voz-venta.spec.ts` busca «Verla» con `exact: true`, porque era el único nombre de las e2e contenido en un botón del indicador de desarrollo de Next («Open issues overlay»). Se revisaron todos los `getByRole` de `tests/e2e/` contra las 11 etiquetas del indicador.
- **Por qué:** el 16-11, un aviso publicado ese día contra 16.4.3 rompió 4 e2e sin que cambiara el código (PR 40). Con cada aviso nuevo contra la versión instalada pasaría lo mismo.
- **Cómo se verificó**, con 16.4.3 (la versión con aviso) instalada a propósito y corriendo como agente:
  - sin el arreglo, Next cerró el servidor de las e2e por el aviso y la prueba murió con `ERR_CONNECTION_REFUSED`;
  - con el arreglo, `marco.spec.ts:26`, `voz.spec.ts:276` y `voz-venta.spec.ts:194` y `:211` pasaron a 412 y a 360 px al primer intento, sin una sola línea de aviso en el log; en la captura de «Hoy» a 412 px está la «N» de Next y no hay píldora;
  - con 16.4.6, lo que queda en la rama: `pnpm typecheck`, `pnpm lint` (0 errores), `pnpm test` (908), `pnpm knip` y `pnpm build:local` en orden, y las 4 e2e, 8 de 8 en verde al primer intento.
- **Pendiente:** `pnpm e2e:prod` compila con `next build`, que sigue avisando. Con una versión afectada, a un agente se le detiene la primera vez; se deja así a propósito, porque es el aviso que se quiere ver.
