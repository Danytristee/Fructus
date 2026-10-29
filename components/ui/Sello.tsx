// El cierre de todo guardado (ADR-0007): un círculo verde que se estampa, el visto que se dibuja y chispas que estallan.
// Se muestra recién cuando la base respondió: nunca es optimista. Decorativo; el texto de al lado dice qué se guardó.

// Los colores de las chispas son los de la fruta del puesto, en tokens (globals.css).
const CHISPAS = ["var(--color-acento)", "var(--color-exito)", "var(--color-deuda)", "var(--color-acento-texto)"];

export function Sello() {
  return (
    <span aria-hidden className="relative mx-auto block size-24">
      <svg viewBox="0 0 52 52" className="size-24">
        <circle cx="26" cy="26" r="24" className="origin-center animate-sellar fill-exito [transform-box:fill-box]" />
        <path
          d="M15 27l7 7 15-16"
          className="animate-trazo fill-none stroke-superficie [stroke-dasharray:40] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:5]"
        />
      </svg>
      {Array.from({ length: 14 }, (_, n) => (
        <i
          key={n}
          style={
            {
              "--angulo": `${n * (360 / 14)}deg`,
              "--distancia": `${60 + ((n * 7) % 24)}px`,
              background: CHISPAS[n % CHISPAS.length],
              transform: "translate(-50%, -50%) rotate(var(--angulo))",
            } as React.CSSProperties
          }
          className="absolute top-1/2 left-1/2 size-2.5 animate-estallar rounded-full"
        />
      ))}
    </span>
  );
}
