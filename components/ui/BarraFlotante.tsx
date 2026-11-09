// Las acciones de una pantalla que flotan sobre su contenido, en el tercio de abajo y sobre la barra, que es donde alcanza el
// pulgar (CLAUDE.md, regla 1). Junta una o dos píldoras (Stock tiene «Compra» y «Merma») y deja un espacio al final para que el
// último renglón no quede debajo.
export function BarraFlotante({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div aria-hidden className="h-16" />
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-xl lg:bottom-8 lg:left-[264px] flex-wrap justify-center gap-2 px-4">
        {children}
      </div>
    </>
  );
}
