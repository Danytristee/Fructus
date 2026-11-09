# /formidable (rápido) · «Aviso del día» en el menú y «Enviar por WhatsApp» en el cierre · 2026-11-08

**Para quién:** el dueño y el ayudante en el celular (activan el aviso una vez y mandan el cierre cada noche), y el contador, que también ve el cierre. **Pasada rápida:** solo mide (a 412 y 360 px) y mira las capturas; no corrió la prueba a ciegas ni el escéptico.
**Qué se mira:** la fila «Aviso del día» de la hoja «Más» en sus cuatro estados (apagado, activado con su mensaje, bloqueado, iPhone sin instalar) y el botón «Enviar por WhatsApp» al final de «Cierre del día». Capturas en `docs/formidable/capturas/aviso-del-dia-*` y `cierre-whatsapp-*`.

## Medido

| | 412 | 360 |
|---|---|---|
| Alto de la fila «Aviso del día» (apagado / activado / bloqueado / iPhone) | 101 / 77 / 77 / 77 px | 101 / 101 / 101 / 101 px |
| Controles menores de 48 px en la fila | 0 | 0 |
| La fila se sale por la derecha | no (16 → 396) | no (16 → 344) |
| Desborde horizontal de la página con la hoja abierta | 0 | 0 |
| Título / subtítulo de la fila | 18 / 17 px | 18 / 17 px |
| Contraste del título / del subtítulo | 18.3 / 9.0 | 18.3 / 9.0 |
| Botón «Enviar por WhatsApp»: alto, texto, margen | 56 px, 18 px, 16 → 396 | 56 px, 18 px, 16 → 344 |
| Botón «Enviar por WhatsApp»: distancia al borde de abajo | 112 px (sobre la barra de abajo) | 112 px |

- **Lo que se corrigió al mirar las capturas:** a 360 px el subtítulo se parte en tres líneas y «Aviso del día» quedaba pegado al borde de arriba de la tarjeta (la fila no tenía relleno vertical); ahora tiene `py-3`. El subtítulo «Lo vendido y lo que te deben, como a las 7 p. m.» se acortó a «Lo que vendiste, como a las 7 p. m.» (de tres líneas a dos). En iPhone, el mensaje repetía lo que ya decía la fila; ahora dice solo qué hacer («Toca “Instalar la app” aquí abajo»).
- **Color como única señal:** no. El interruptor cambia de posición y el subtítulo dice «Activado»; el mensaje de éxito, el de error y el de bloqueado llevan icono y texto.
- **Tamaño del control:** la fila entera es el interruptor (64 px o más), no solo la perilla.
- **Orden de lo que se lee:** al activar, el mensaje («Aviso activado · Te mandamos uno de prueba») sale justo debajo de la fila, no al final de la hoja.
- **Toques:** Hoy → Menú → Aviso del día: 2. Se hace una sola vez. El botón de WhatsApp está a 2 toques de «Hoy» (Menú → Cierre del día) y es lo último de la pantalla, donde termina de bajar el pulgar.
- **No medido:** una persona real, el diálogo de permiso del teléfono (lo pone el sistema), el aviso en la pantalla de bloqueo, el teclado (no lleva campos), y cómo abre WhatsApp la app instalada (sí se comprueba que el enlace abre `wa.me` en otra pestaña con `noopener`).

## Lo que se ve (Observado, por mí; sin prueba a ciegas)

- Una fila con una campana, «Aviso del día», una frase de lo que hace y un interruptor. Al tocarlo, el teléfono pregunta si permite notificaciones (diálogo del sistema); al aceptar, el interruptor se pone verde, la frase pasa a «Activado, como a las 7 p. m.» y aparece un mensaje verde. Poco después llega al teléfono un aviso de prueba.
- Si la persona dijo «No permitir», la fila ya no es un interruptor: dice «Bloqueado en tu teléfono» y un mensaje explica dónde cambiarlo (en los ajustes del navegador; la app no puede hacerlo por ella).
- En iPhone con la app sin instalar no hay interruptor: dice que primero hay que instalarla (Safari solo manda avisos a la app instalada) y apunta a «Instalar la app», que está justo debajo.
- El botón de WhatsApp es un botón de vidrio (secundario) al final de «Cierre del día», con el texto «Enviar por WhatsApp». No compite con el protagonista de la pantalla (el efectivo en la caja).

## Lo que no se hizo
- **Prueba a ciegas** con alguien que no conozca la app, en un teléfono real: queda para la demo. Lo que más conviene ver: si «Aviso del día» se entiende sin leer la frase de abajo, y si «Lo que vendiste, como a las 7 p. m.» alcanza para saber qué va a llegar.
- **Nota:** no se califica sin la prueba a ciegas (la skill pide evidencia para cada nota).
