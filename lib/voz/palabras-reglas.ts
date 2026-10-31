// Los números dichos como se dicen en el puesto, para responder hablando (speechSynthesis): «S/ 2,472.00» leído por el
// celular suena a «ese barra dos coma cuatro siete dos punto cero cero». Aquí sale «dos mil cuatrocientos setenta y dos
// soles». Lógica pura.

const UNIDADES = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const DIEZ_A_VEINTINUEVE = [
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
  "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function hastaCien(n: number): string {
  if (n < 10) return UNIDADES[n]!;
  if (n < 30) return DIEZ_A_VEINTINUEVE[n - 10]!;
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? DECENAS[d]! : `${DECENAS[d]} y ${UNIDADES[u]}`;
}

function hastaMil(n: number): string {
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c === 0) return hastaCien(resto);
  return resto === 0 ? CENTENAS[c]! : `${CENTENAS[c]} ${hastaCien(resto)}`;
}

/** «uno» se acorta delante de un sustantivo: «veintiún mil», «un sol», «treinta y un soles». */
const acortar = (palabras: string) => palabras.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");

/** Un entero de 0 a 999 999 999 en palabras. */
export function numeroEnPalabras(n: number): string {
  const entero = Math.floor(Math.abs(n));
  if (entero === 0) return "cero";
  const millones = Math.floor(entero / 1_000_000);
  const miles = Math.floor((entero % 1_000_000) / 1000);
  const resto = entero % 1000;
  const partes: string[] = [];
  if (millones > 0) partes.push(millones === 1 ? "un millón" : `${acortar(hastaMil(millones))} millones`);
  if (miles > 0) partes.push(miles === 1 ? "mil" : `${acortar(hastaMil(miles))} mil`);
  if (resto > 0) partes.push(hastaMil(resto));
  return partes.join(" ");
}

/** «dos mil cuatrocientos setenta y dos soles con cincuenta céntimos», redondeado al céntimo. */
export function solesEnPalabras(monto: number): string {
  const centimos = Math.round(Math.abs(monto) * 100);
  const soles = Math.floor(centimos / 100);
  const cent = centimos % 100;
  const enSoles = soles === 1 ? "un sol" : `${acortar(numeroEnPalabras(soles))} soles`;
  const enCentimos = cent === 1 ? "un céntimo" : `${acortar(numeroEnPalabras(cent))} céntimos`;
  if (cent === 0) return enSoles;
  if (soles === 0) return enCentimos;
  return `${enSoles} con ${enCentimos}`;
}

/** «una caja», «doce cajas», «dos cajas y media». Lo que no es entero ni media caja va en cifras: no se inventa una fracción. */
export function cajasEnPalabras(cantidad: number): string {
  const entero = Math.floor(cantidad);
  const fraccion = Math.round((cantidad - entero) * 100);
  // «una»: caja es femenino («veintiuna cajas»).
  const cuantas = (n: number) => numeroEnPalabras(n).replace(/uno$/, "una");
  if (fraccion === 50) return entero === 0 ? "media caja" : `${cuantas(entero)} ${entero === 1 ? "caja" : "cajas"} y media`;
  if (fraccion !== 0) return `${cantidad} cajas`;
  if (entero === 0) return "ninguna caja";
  return entero === 1 ? "una caja" : `${cuantas(entero)} cajas`;
}
