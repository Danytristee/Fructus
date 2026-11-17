// Al tocar un monto o un precio, el número queda seleccionado: lo que se escribe lo reemplaza, sin borrar con el dedo cifra por cifra
// (con una mano y al sol, borrar «45.00» para poner «47» eran cinco toques). Se usa en los campos de dinero (`inputmode="decimal"`).
//
// El navegador pone el cursor al soltar el dedo (mouseup) y eso deshacía la selección hecha al enfocar: ese primer mouseup se cancela.

type Eventos = {
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLInputElement>) => void;
};

export const seleccionarAlEnfocar: Eventos = {
  onFocus: (e) => {
    e.currentTarget.dataset.recienEnfocado = "";
    e.currentTarget.select();
  },
  onMouseUp: (e) => {
    if (e.currentTarget.dataset.recienEnfocado === undefined) return;
    delete e.currentTarget.dataset.recienEnfocado;
    e.preventDefault();
  },
};
