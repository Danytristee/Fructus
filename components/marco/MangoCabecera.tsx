import Image from "next/image";

// El mango de la cabecera de «Hoy» (ADR-0014): ilustración propia en public/ilustraciones/, de unos 2 KB, en vez de una foto que pesaría en
// 4G. Decorativo: asoma a la derecha, detrás del título y debajo de la primera tarjeta. Quieto, como todo el fondo.
export function MangoCabecera() {
  return (
    <Image
      src="/ilustraciones/mango-cabecera.svg"
      alt=""
      width={176}
      height={160}
      unoptimized
      priority
      className="absolute top-[calc(48px+max(14px,env(safe-area-inset-top)))] -right-6"
    />
  );
}
