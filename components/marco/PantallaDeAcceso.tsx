import Image from "next/image";

type Props = {
  titulo: string;
  subtitulo: string;
  /** Lo que va entre el título y la tarjeta: un aviso («Ese enlace ya no sirve»). */
  aviso?: React.ReactNode;
  /** La tarjeta con el formulario. */
  children: React.ReactNode;
  /** Una línea debajo de la tarjeta («¿No tienes cuenta?…»). */
  pie?: React.ReactNode;
};

// Entrar, elegir la clave y abrir una invitación (ADR-0014): verde bosque de lado a lado con el ícono de la app arriba, como la pantalla de
// arranque de la app instalada, así no hay salto de color al abrirla. El formulario va en una tarjeta marfil.
export function PantallaDeAcceso({ titulo, subtitulo, aviso, children, pie }: Props) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(120%_70%_at_80%_0%,var(--bosque-2),var(--acento)_50%,var(--profundo))] text-sobre-acento">
      <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 px-4 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
        <header className="grid animate-subir justify-items-center gap-3 text-center">
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={104}
            height={104}
            priority
            className="rounded-[24px] shadow-[0_0_0_1px_color-mix(in_srgb,var(--sobre-acento)_14%,transparent),0_18px_40px_rgb(var(--sombra-color)/0.5)]"
          />
          <h1 className="text-[36px] leading-tight font-extrabold tracking-tight">{titulo}</h1>
          <p className="text-sobre-acento/80">{subtitulo}</p>
        </header>
        {aviso}
        <div className="animate-subir rounded-protagonista bg-vidrio p-[18px] text-texto shadow-[0_18px_40px_rgb(var(--sombra-color)/0.45)] [animation-delay:80ms]">
          {children}
        </div>
        {pie && <p className="animate-subir text-center text-sobre-acento/80 [animation-delay:160ms]">{pie}</p>}
      </main>
    </div>
  );
}
