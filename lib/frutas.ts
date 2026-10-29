// Las frutas que tienen ilustración propia en public/frutas/ (ADR-0007). Las demás se dibujan cuando entre su producto.
export const frutasIlustradas = ["manzana", "pera", "kiwi", "uva", "naranja", "pina", "mango", "platano"] as const;
export type FrutaIlustrada = (typeof frutasIlustradas)[number];

const porNombre: Record<string, FrutaIlustrada> = {
  manzana: "manzana",
  pera: "pera",
  kiwi: "kiwi",
  uva: "uva",
  tangelo: "naranja",
  mango: "mango",
  platano: "platano",
  pina: "pina",
  naranja: "naranja",
  mandarina: "naranja",
};

/** La ilustración que le toca a un producto por su nombre («Plátano» → platano), o null si no tiene. */
export function frutaIlustrada(nombreProducto: string): FrutaIlustrada | null {
  const clave = nombreProducto.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").split(" ")[0] ?? "";
  return porNombre[clave] ?? null;
}
