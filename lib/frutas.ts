// Las frutas que tienen ilustración propia en public/frutas/ (ADR-0014). Las del catálogo del puesto se dibujaron mirando cómo se venden en
// un mercado mayorista peruano (docs/maquetas/frutas/): el mango Kent es redondo y verdoso con rubor vino; el Edward, alargado y dorado;
// el plátano de isla, rechoncho y manchado; la papaya criolla va cortada, con sus semillas negras; la palta fuerte, verde y lisa.
export const frutasIlustradas = [
  "mango-kent",
  "mango-edward",
  "platano-seda",
  "platano-isla",
  "papaya",
  "pina",
  "mandarina",
  "uva",
  "palta",
  "limon",
  "manzana",
  "pera",
  "kiwi",
  "naranja",
] as const;
export type FrutaIlustrada = (typeof frutasIlustradas)[number];

// Primero lo más específico (fruta y variedad), después la fruta sola. Sin variedad, el mango es Kent (el 90 % del mango peruano) y el
// plátano es de seda (el de todos los días).
const reglas: [palabras: string[], fruta: FrutaIlustrada][] = [
  [["mango", "edward"], "mango-edward"],
  [["mango"], "mango-kent"],
  [["platano", "isla"], "platano-isla"],
  [["platano"], "platano-seda"],
  [["papaya"], "papaya"],
  [["pina"], "pina"],
  [["mandarina"], "mandarina"],
  [["tangerina"], "mandarina"],
  [["tangelo"], "naranja"],
  [["naranja"], "naranja"],
  [["uva"], "uva"],
  [["palta"], "palta"],
  [["limon"], "limon"],
  [["manzana"], "manzana"],
  [["pera"], "pera"],
  [["kiwi"], "kiwi"],
];

const palabrasDe = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-z]+/)
    .filter(Boolean);

/**
 * La ilustración que le toca a un producto por su nombre, con la variedad si viene («Mango Edward» → mango-edward; «Plátano de isla» →
 * platano-isla; «Plátano» → platano-seda), o null si no tiene.
 */
export function frutaIlustrada(nombreProducto: string): FrutaIlustrada | null {
  const palabras = palabrasDe(nombreProducto);
  return reglas.find(([buscadas]) => buscadas.every((p) => palabras.includes(p)))?.[1] ?? null;
}
