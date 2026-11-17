// Las acciones de una pantalla que flotan sobre su contenido, en el tercio de abajo y sobre la barra, que es donde alcanza el
// pulgar (CLAUDE.md, regla 1). Junta una o dos píldoras (Stock tiene «Compra» y «Merma») y deja un espacio al final para que el
// último renglón no quede debajo. En escritorio (ADR-0015) no hay pulgar que cuidar y, flotando sobre una pantalla ancha, tapaban filas al
// deslizar (/formidable 2026-11-09): van arriba, a la derecha del título, y se desplazan con la página.
export function BarraFlotante({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div aria-hidden className="h-16 lg:hidden" />
      <div data-con-teclado="oculto" className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-xl lg:absolute lg:inset-x-auto lg:top-8 lg:right-10 lg:bottom-auto lg:mx-0 lg:max-w-none lg:justify-end lg:px-0 flex-wrap justify-center gap-2 px-4">
        {children}
      </div>
    </>
  );
}
