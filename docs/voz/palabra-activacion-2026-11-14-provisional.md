# «Hola Fructus»: modelo provisional (2026-11-14)

**Para qué:** construir y probar la escucha dentro de la app (actividades 5b a 5e) sin esperar las grabaciones del puesto. **No es la
prueba de viabilidad**: esa se hace con voces reales, el audífono que se va a comprar y el ruido del puesto (`scripts/voz/palabra-activacion/README.md`).

**Cómo se entrenó** (todo en esta computadora, sin los datos no comerciales de openWakeWord):
- **Positivos:** 3,000 «Hola Fructus» con 6 voces de Piper.
- **Negativos:**
  - frases parecidas;
  - 1,500 frases del puesto, solas y mezcladas con ruido;
  - 1,000 clips de AudioSet en la ronda 1, más 2,000 en las rondas 2 y 3.
- **Medición:** con una séptima voz que nunca oyó (`es_MX-ald-medium`):
  - 200 «Hola Fructus»;
  - 0.96 h de ruido aparte, entre AudioSet y frases del puesto;
  - 400 frases parecidas, con «fruta».

## Tres rondas, con umbral 0.9 y 3 cuadros seguidos (240 ms)

| Ronda | Qué cambió | Detecta (limpia) | Con ruido 10 dB | Falsas por hora | Despiertan las parecidas |
|---|---|---|---|---|---|
| **1 (elegida)** | Receta de openWakeWord: 3,000 frases parecidas sin «fruta», 50 por lote | **90.0 %** | 63.0 % | **1.04** | 10.8 % |
| 2 | +4,000 frases con «fruta», 100 por lote, +2,000 clips de AudioSet | 46.5 % | 33.5 % | 1.04 | 2.2 % |
| 3 | Igual que la 2, con 25 por lote | 18.0 % | 11.0 % | 0.00 | 1.0 % |

**Lo que se aprendió:**
- **Lo que más engaña es «fruta».** «Con fruta», «tus frutas», «hola, ¿hay fruta?»: alrededor del 11 % de esas frases lo despiertan.
- **Enseñarle a rechazarlas le quita detección.** Con voces sintéticas, «hola, frutas» y «hola Fructus» casi no se distinguen. Por eso esas
  frases quedaron como opción (`generar_clips.py --con-fruta`), para probarlas con grabaciones reales.
- **La paciencia es la que más ayuda.** Pedir 3 cuadros seguidos sobre el umbral baja las falsas por ruido de 10 a 1 por hora, a cambio de
  unos 5 puntos de detección.
- **La detección con ruido a 10 y 5 dB sale baja** (63 % y 53 %). Ese ruido es AudioSet (música, motores, multitudes) mezclado fuerte, sin
  audífono. Con el micrófono del audífono pegado a la boca, la voz llega muy por encima del ruido: se confirma con las grabaciones reales.

**Lo que usa la app:**
- el modelo de la ronda 1;
- umbral 0.9;
- 3 cuadros seguidos;
- 2 s sin volver a despertar.

## Ronda 1: tabla completa

| Umbral | Cuadros seguidos | Detección limpia | Detección ruido 10 dB | Detección ruido 5 dB | Falsas por hora | Despiertan las parecidas | ¿Cumple? |
|---|---|---|---|---|---|---|---|
| 0.5 | 1 | 96.5% | 79.0% | 71.0% | 17.65 | 19.2% | no |
| 0.5 | 2 | 93.5% | 73.5% | 65.0% | 7.27 | 17.0% | no |
| 0.5 | 3 | 90.5% | 67.5% | 58.0% | 3.12 | 13.0% | no |
| 0.5 | 4 | 87.0% | 60.5% | 50.5% | 1.04 | 7.0% | no |
| 0.6 | 1 | 96.5% | 77.5% | 70.0% | 16.61 | 18.8% | no |
| 0.6 | 2 | 93.5% | 72.5% | 64.5% | 5.19 | 16.5% | no |
| 0.6 | 3 | 90.0% | 66.5% | 58.0% | 3.12 | 12.8% | no |
| 0.6 | 4 | 86.5% | 60.0% | 49.0% | 1.04 | 6.8% | no |
| 0.7 | 1 | 96.0% | 76.0% | 69.0% | 14.54 | 18.2% | no |
| 0.7 | 2 | 92.5% | 71.0% | 63.0% | 4.15 | 16.5% | no |
| 0.7 | 3 | 90.0% | 66.0% | 57.0% | 3.12 | 11.8% | no |
| 0.7 | 4 | 86.5% | 58.5% | 48.5% | 1.04 | 6.5% | no |
| 0.8 | 1 | 95.5% | 75.5% | 68.0% | 12.46 | 18.2% | no |
| 0.8 | 2 | 92.0% | 70.5% | 61.5% | 4.15 | 15.8% | no |
| 0.8 | 3 | 90.0% | 65.0% | 56.0% | 2.08 | 10.8% | no |
| 0.8 | 4 | 86.5% | 58.5% | 47.5% | 1.04 | 6.2% | no |
| 0.9 | 1 | 94.5% | 74.5% | 66.5% | 10.38 | 18.0% | no |
| 0.9 | 2 | 91.0% | 69.5% | 57.5% | 3.12 | 15.8% | no |
| 0.9 | 3 | 90.0% | 63.0% | 53.0% | 1.04 | 10.8% | no |
| 0.9 | 4 | 84.5% | 55.0% | 44.5% | 0.00 | 6.2% | no |

**Veredicto:** no pasa con ningún umbral ni paciencia.

**Contra la meta de viabilidad** (90 % de detección también con ruido, y 1 falsa por hora o menos), el modelo provisional no pasa.
**Como modelo para construir y probar la app, sirve.** La decisión de seguir o no con «Hola Fructus» sale de la medición con grabaciones reales.

**Licencias:** se entrenó con voces de Piper, de licencias distintas, y con AudioSet, que es audio de YouTube. Es solo para la demo.
