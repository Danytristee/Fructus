// Las frutas que tienen ilustración propia en public/frutas/ (ADR-0014), dibujadas con scripts/frutas/ (`pnpm frutas`). Cubren el catálogo
// real del puesto (ADR-0016) y el de demo. Cada una se dibujó mirando cómo se vende en un mercado mayorista peruano: el mango Kent es
// redondo y verdoso con rubor vino; el Edward, alargado y dorado; el plátano de isla, grueso y manchado; el bizcocho, chiquito y
// rechoncho; la papaya va cortada, con sus pepas negras; el pepino dulce, crema con rayas moradas; la tuna, con sus aréolas.
export const frutasIlustradas = [
  "albaricoque",
  "caqui",
  "cereza",
  "chirimoya",
  "ciruela",
  "cocona",
  "durazno",
  "granadilla",
  "kiwi",
  "lima",
  "limon",
  "mandarina",
  "mango-edward",
  "mango-kent",
  "manzana",
  "manzana-verde",
  "membrillo",
  "naranja",
  "nispero",
  "palta",
  "papaya",
  "pepino",
  "pera",
  "pina",
  "platano-bizcocho",
  "platano-isla",
  "platano-seda",
  "tumbo",
  "tuna",
  "uva",
] as const;
export type FrutaIlustrada = (typeof frutasIlustradas)[number];

// Primero lo más específico (fruta y variedad), después la fruta sola. Sin variedad, el mango es Kent (el 90 % del mango peruano) y el
// plátano es de seda (el de todos los días). La «Bomba» del catálogo no tiene dibujo hasta saber qué fruta es: sale con su inicial.
const reglas: [palabras: string[], fruta: FrutaIlustrada][] = [
  [["mango", "edward"], "mango-edward"],
  [["mango"], "mango-kent"],
  [["platano", "isla"], "platano-isla"],
  [["platano", "bizcocho"], "platano-bizcocho"],
  [["bizcocho"], "platano-bizcocho"],
  [["platano"], "platano-seda"],
  [["manzana", "verde"], "manzana-verde"],
  [["manzana"], "manzana"],
  [["papaya"], "papaya"],
  [["pina"], "pina"],
  [["mandarina"], "mandarina"],
  [["tangerina"], "mandarina"],
  [["tangelo"], "naranja"],
  [["naranja"], "naranja"],
  [["uva"], "uva"],
  [["palta"], "palta"],
  [["limon"], "limon"],
  [["lima"], "lima"],
  [["pera"], "pera"],
  [["kiwi"], "kiwi"],
  [["albaricoque"], "albaricoque"],
  [["damasco"], "albaricoque"],
  [["durazno"], "durazno"],
  [["melocoton"], "durazno"],
  [["ciruela"], "ciruela"],
  [["cereza"], "cereza"],
  [["caqui"], "caqui"],
  [["chirimoya"], "chirimoya"],
  [["cocona"], "cocona"],
  [["granadilla"], "granadilla"],
  [["membrillo"], "membrillo"],
  [["nispero"], "nispero"],
  [["pepino"], "pepino"],
  [["tumbo"], "tumbo"],
  [["tuna"], "tuna"],
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
 * platano-isla; «Plátano» → platano-seda; «Manzana Verde Premium» → manzana-verde), o null si no tiene.
 */
export function frutaIlustrada(nombreProducto: string): FrutaIlustrada | null {
  const palabras = palabrasDe(nombreProducto);
  return reglas.find(([buscadas]) => buscadas.every((p) => palabras.includes(p)))?.[1] ?? null;
}
