// El fondo de Aurora: cuatro luces suaves, quietas. Quietas a propósito: el vidrio de encima desenfoca lo que hay
// detrás, y un fondo en movimiento obliga a recalcular ese desenfoque en cada cuadro en un Android de gama media (ADR-0007).
const luces = [
  "-top-[40vmax] -left-[35vmax] bg-[radial-gradient(closest-side,var(--luz-1),transparent)]",
  "-top-[10vmax] -right-[50vmax] bg-[radial-gradient(closest-side,var(--luz-2),transparent)]",
  "-bottom-[45vmax] -left-[30vmax] bg-[radial-gradient(closest-side,var(--luz-3),transparent)]",
  "-bottom-[30vmax] -right-[45vmax] bg-[radial-gradient(closest-side,var(--luz-4),transparent)]",
];

export function FondoAurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-fondo">
      {luces.map((clase) => (
        <span key={clase} className={`absolute size-[90vmax] rounded-full opacity-90 ${clase}`} />
      ))}
    </div>
  );
}
