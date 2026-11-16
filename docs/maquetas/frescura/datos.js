// Fructus · maqueta del aviso de frescura. DATOS DE DEMOSTRACIÓN de un sábado de calor en el puesto: nada toca la base ni la app.
//
// El problema: hoy Stock avisa «por malograrse» con una tabla fija («el mango dura 7 días»). La misma caja dura menos una semana de
// 31° que una de 24°, y un mango que llegó maduro dura la mitad que uno verde: la tabla avisa tarde justo cuando más calor hace.
// Cómo se reparte el trabajo en la propuesta:
//   · La IA (Claude) estima `VIDA`: cuántos días aguanta la caja a 24°, según la fruta y cómo llegó. Se corrige con las mermas.
//   · Una regla fija lleva la cuenta: cada día gasta una parte de esa vida, y con calor gasta más (el doble cada 10 grados).
// Así el aviso da siempre el mismo resultado y sigue funcionando si la IA no responde.

// El día de la demostración es el sábado 14 de noviembre (índice 5). Los que siguen sirven para decir «aguantaba hasta el lunes».
const SEMANA = [
  ["lunes", "lun", 9], ["martes", "mar", 10], ["miércoles", "mié", 11], ["jueves", "jue", 12], ["viernes", "vie", 13], ["sábado", "sáb", 14],
  ["domingo", "dom", 15], ["lunes", "lun", 16], ["martes", "mar", 17], ["miércoles", "mié", 18], ["jueves", "jue", 19], ["viernes", "vie", 20],
  ["sábado", "sáb", 21], ["domingo", "dom", 22], ["lunes", "lun", 23], ["martes", "mar", 24], ["miércoles", "mié", 25], ["jueves", "jue", 26],
];
const HOY_I = 5;
const T_NORMAL = 24;
const SEMANA_DE_CALOR = [27, 29, 31, 30, 30, 29];
const SEMANA_FRESCA = [23, 24, 24, 23, 25, 24];

// Lo que estima la IA: días que aguanta a 24°. Las frutas que maduran en la caja dependen de cómo llegaron; las demás, no.
const VIDA = {
  "Mango Kent": { verde: 11, pinton: 8, maduro: 4 },
  "Papaya": { verde: 9, pinton: 7, maduro: 5 },
  "Plátano de seda": { verde: 8, pinton: 5, maduro: 3 },
  "Palta fuerte": { verde: 12, pinton: 7, maduro: 3 },
  "Piña golden": 7,
  "Uva red globe": 10,
  "Limón": 15,
  "Mandarina": 14,
};
const COMO_LLEGO = { verde: ["Verde", "verdes"], pinton: ["Pintón", "pintonas"], maduro: ["Maduro", "maduras"] };
const vidaDe = (nombre, estado) => (typeof VIDA[nombre] === "number" ? VIDA[nombre] : VIDA[nombre][estado ?? "pinton"]);

// Cada llegada: qué fruta, cuántas cajas quedan de ella, qué día llegó y cómo. `fruta` elige el dibujo; `titulo` es la fila en Stock.
const LLEGADAS = [
  { fruta: "Mango", grupo: "Mango", titulo: "Kent", nombre: "Mango Kent", cajas: 12, llego: 0, estado: "pinton" },
  { fruta: "Mango", grupo: "Mango", titulo: "Kent", nombre: "Mango Kent", cajas: 30, llego: 3, estado: "verde" },
  { fruta: "Papaya", grupo: "Papaya", titulo: "Papaya", nombre: "Papaya", cajas: 6, llego: 2, estado: "maduro" },
  { fruta: "Plátano", grupo: "Plátano", titulo: "De seda", nombre: "Plátano de seda", cajas: 20, llego: 3, estado: "pinton" },
  { fruta: "Piña", grupo: "Piña", titulo: "Golden", nombre: "Piña golden", cajas: 18, llego: 4, estado: null },
  { fruta: "Palta", grupo: "Palta", titulo: "Fuerte", nombre: "Palta fuerte", cajas: 33, llego: 1, estado: "verde" },
  { fruta: "Uva", grupo: "Uva", titulo: "Red globe", nombre: "Uva red globe", cajas: 24, llego: 2, estado: null },
  { fruta: "Limón", grupo: "Limón", titulo: "Limón", nombre: "Limón", cajas: 33, llego: 0, estado: null },
  { fruta: "Mandarina", grupo: "Mandarina", titulo: "Mandarina", nombre: "Mandarina", cajas: 38, llego: 1, estado: null },
].map((l) => ({ ...l, vida: vidaDe(l.nombre, l.estado) }));

// Precio de referencia y cajas que se venden al día (para «valen unos» y «alcanza para»).
const PRODUCTOS = {
  "Mango Kent": [45, 9], "Papaya": [35, 5], "Plátano de seda": [32, 8], "Piña golden": [40, 6],
  "Palta fuerte": [70, 8], "Uva red globe": [60, 6], "Limón": [50, 5], "Mandarina": [30, 4],
};

// ── La regla fija ──
/** Cuánto más rápido se gasta la fruta a `t` grados que a 24°: el doble cada 10 grados. */
const factorCalor = (t) => Math.pow(2, (t - T_NORMAL) / 10);

/**
 * Lleva la cuenta de una llegada: qué parte de su vida gastó cada día y cuál es su último día bueno.
 * `restan` = días que aguanta después de hoy (0: sale hoy; 1: sale mañana). Los días que faltan se calculan con la temperatura de hoy.
 */
function estimarLlegada(l, temps) {
  const dias = [];
  let gastado = 0;
  for (let d = l.llego; d <= HOY_I; d++) {
    const g = factorCalor(temps[d]) / l.vida;
    dias.push({ d, t: temps[d], g });
    gastado += g;
  }
  const porDia = factorCalor(temps[HOY_I]) / l.vida;
  let restan = 0;
  for (let a = gastado; a < 0.999 && restan < 30; a += porDia) restan++;
  const fin = HOY_I + restan;
  const finNormal = Math.max(fin, l.llego + Math.ceil(l.vida) - 1);
  return { dias, gastado: Math.min(1, gastado), restan, fin, finNormal, perdidos: finNormal - fin };
}

if (typeof module !== "undefined") module.exports = { LLEGADAS, SEMANA_DE_CALOR, SEMANA_FRESCA, estimarLlegada, SEMANA, vidaDe, factorCalor, HOY_I };
