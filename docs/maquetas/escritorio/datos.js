// Fructus · maquetas de escritorio: los datos de un lunes del puesto y las piezas que comparten las tres direcciones.
// Clientes, frutas y precios del seed (supabase/seed.sql); los montos son inventados pero cuadran entre sí.

const soles = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const S = (n) => soles.format(n).replace(/\s+/, "\u00a0");
// Para capturas: ?captura apaga la coreografía de entrada.
if (location.search.includes("captura")) document.documentElement.classList.add("sin-animar");
const iniciales = (n) => n.split(" ").filter((p) => /^[A-ZÁÉÍÓÚÑ]/.test(p)).slice(0, 2).map((p) => p[0]).join("");

// Iconos de lucide (los mismos que usa la app), en línea para no depender de nada.
const ICONOS = {
  casa: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  clientes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  stock: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/>',
  ventas: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  cierre: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  ajustes: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  micro: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
  billetera: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  mano: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  flecha: '<path d="m9 18 6-6-6-6"/>',
  buscar: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  mas: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  bajar: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  camion: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  telefono: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  basura: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  recibo: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  tendencia: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
};
const icono = (n, clase = "i") => `<svg class="${clase}" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[n]}</svg>`;

const FRUTAS = { "Mango": "mango", "Plátano": "platano", "Piña": "pina", "Mandarina": "naranja", "Uva": "uva", "Palta": "pera", "Papaya": "naranja", "Limón": "kiwi" };
const fruta = (nombre) => `<img class="fruta" alt="" src="../../../public/frutas/${FRUTAS[nombre] ?? "mango"}.svg">`;

const HOY = {
  fecha: "lunes 9 de noviembre",
  ventas: 34,
  cajas: 318,
  contado: 9420,
  credito: 5440,
  abonos: 1350,
  gastos: 180,
  // De 5 a. m. a 12 m.: el puesto vende de madrugada.
  porHora: [
    { h: "5 a. m.", v: 1240 }, { h: "6", v: 3180 }, { h: "7", v: 3950 }, { h: "8", v: 2610 },
    { h: "9", v: 1720 }, { h: "10", v: 1180 }, { h: "11", v: 620 }, { h: "12 m.", v: 360 },
  ],
  semana: [
    { d: "mar 3", v: 12980 }, { d: "mié 4", v: 13420 }, { d: "jue 5", v: 11870 }, { d: "vie 6", v: 15210 },
    { d: "sáb 7", v: 17640 }, { d: "dom 8", v: 9310 }, { d: "hoy", v: 14860 },
  ],
};
HOY.vendido = HOY.contado + HOY.credito;
HOY.cobrado = HOY.contado + HOY.abonos;
HOY.caja = HOY.cobrado - HOY.gastos;

const ULTIMAS = [
  { hora: "12:41", tipo: "venta", quien: "Rosa Quispe", que: "8 cajas de plátano de seda", fruta: "Plátano", monto: 256, estado: "pago", medio: "Yape" },
  { hora: "12:20", tipo: "abono", quien: "Luis Paredes", que: "Abono en efectivo", monto: 500, estado: "abono" },
  { hora: "11:58", tipo: "venta", quien: "Juguería El Paraíso", que: "12 cajas de piña golden", fruta: "Piña", monto: 480, estado: "debe" },
  { hora: "11:32", tipo: "merma", quien: "Se malogró", que: "2 cajas de papaya", fruta: "Papaya", monto: 70, estado: "merma" },
  { hora: "11:05", tipo: "venta", quien: "Restaurante Mochica", que: "6 cajas de palta fuerte", fruta: "Palta", monto: 420, estado: "pago", medio: "Efectivo" },
  { hora: "10:47", tipo: "venta", quien: "Carlos Mendoza", que: "10 cajas de mango Kent", fruta: "Mango", monto: 450, estado: "debe" },
  { hora: "10:12", tipo: "gasto", quien: "Estiba", que: "Descarga del camión de Chao", monto: 180, estado: "gasto" },
  { hora: "9:48", tipo: "venta", quien: "Bodega Santa Ana", que: "15 cajas de mango Edward", fruta: "Mango", monto: 570, estado: "debe" },
];

// dias = días desde la venta al crédito más antigua sin pagar (lo que la app llamaría «antigüedad»).
const CLIENTES = [
  { nombre: "Luis Paredes", apodo: "don lucho", doc: "DNI 40123456", tel: "949 123 456", saldo: 3380, dias: 18, ultimo: "Abonó S/ 500.00 hoy" },
  { nombre: "Bodega Santa Ana", apodo: "santa ana", doc: "RUC 10456789012", tel: "044 281 330", saldo: 2602, dias: 34, ultimo: "Compró 15 cajas hoy" },
  { nombre: "Juguería El Paraíso", apodo: "el paraíso", doc: "RUC 20601234567", tel: "", saldo: 2240, dias: 9, ultimo: "Compró 12 cajas hoy" },
  { nombre: "Restaurante Mochica", apodo: "el mochica", doc: "RUC 20609876543", tel: "044 205 118", saldo: 1960, dias: 22, ultimo: "Pagó S/ 420.00 hoy" },
  { nombre: "Marta Vásquez", apodo: "doña marta", doc: "", tel: "951 604 227", saldo: 1850, dias: 41, ultimo: "Abonó S/ 300.00 el 30 oct" },
  { nombre: "Frutería Los Ángeles", apodo: "los ángeles", doc: "RUC 10471122334", tel: "", saldo: 1525, dias: 6, ultimo: "Compró 20 cajas el sábado" },
  { nombre: "Carlos Mendoza", apodo: "el flaco", doc: "", tel: "", saldo: 1310, dias: 12, ultimo: "Compró 10 cajas hoy" },
  { nombre: "Jorge Rodríguez", apodo: "el chino", doc: "DNI 41887210", tel: "968 330 112", saldo: 1140, dias: 27, ultimo: "Abonó S/ 200.00 el 2 nov" },
  { nombre: "Rosa Quispe", apodo: "la señora rosa", doc: "", tel: "", saldo: 980, dias: 4, ultimo: "Pagó S/ 256.00 hoy" },
  { nombre: "Ana Torres", apodo: "puesto 8", doc: "", tel: "944 018 765", saldo: 765, dias: 15, ultimo: "Compró 6 cajas el viernes" },
  { nombre: "Hostal Libertad", apodo: "el hostal", doc: "RUC 20482219085", tel: "", saldo: 703, dias: 52, ultimo: "Compró 4 cajas el 18 sep" },
  { nombre: "Wilmer Sánchez", apodo: "wilmer", doc: "", tel: "", saldo: 630, dias: 3, ultimo: "Compró 7 cajas el sábado" },
  { nombre: "Pedro Alayo", apodo: "", doc: "", tel: "", saldo: 0, dias: 0, ultimo: "Pagó S/ 380.00 el jueves" },
  { nombre: "Lucía Cueva", apodo: "la profe", doc: "", tel: "", saldo: 0, dias: 0, ultimo: "Pagó S/ 150.00 el viernes" },
  { nombre: "Agroinversiones Moche", apodo: "moche", doc: "RUC 20539871100", tel: "", saldo: 0, dias: 0, ultimo: "Pagó S/ 2,100.00 el sábado" },
];
const TE_DEBEN = CLIENTES.reduce((s, c) => s + c.saldo, 0);
const DEUDORES = CLIENTES.filter((c) => c.saldo > 0);

// El historial de la ficha. Para la maqueta, Luis Paredes trae el suyo y los demás uno genérico que cuadra con su saldo.
function historialDe(c) {
  if (c.nombre === "Luis Paredes") {
    return [
      { dia: "Hoy", hora: "12:20", tipo: "abono", que: "Abono en efectivo", monto: -500 },
      { dia: "Sáb 7 nov", hora: "6:15", tipo: "venta", que: "20 cajas de mango Kent", monto: 900 },
      { dia: "Jue 5 nov", hora: "7:02", tipo: "venta", que: "15 cajas de plátano isla", monto: 420 },
      { dia: "Mar 3 nov", hora: "8:40", tipo: "abono", que: "Abono por Yape", monto: -800 },
      { dia: "Lun 2 nov", hora: "6:31", tipo: "venta", que: "30 cajas de mango Edward", monto: 1140 },
      { dia: "Jue 22 oct", hora: "5:55", tipo: "venta", que: "20 cajas de palta fuerte", monto: 1400 },
      { dia: "Mié 21 oct", hora: "6:10", tipo: "venta", que: "Saldo anterior del cuaderno", monto: 820 },
    ];
  }
  if (c.saldo === 0) return [{ dia: "Reciente", hora: "7:10", tipo: "venta", que: c.ultimo, monto: 0 }];
  const a = Math.round(c.saldo * 0.55), b = c.saldo - a;
  return [
    { dia: "Esta semana", hora: "6:48", tipo: "venta", que: "Cajas surtidas al crédito", monto: a },
    { dia: `Hace ${c.dias} días`, hora: "7:20", tipo: "venta", que: "Cajas surtidas al crédito", monto: b + 300 },
    { dia: `Hace ${c.dias - 2 > 0 ? c.dias - 2 : 1} días`, hora: "9:05", tipo: "abono", que: "Abono en efectivo", monto: -300 },
  ];
}

const STOCK = [
  { nombre: "Mango", variedad: "Kent", cajas: 0, diarias: 22, precio: 45 },
  { nombre: "Piña", variedad: "golden", cajas: 11, diarias: 12, precio: 40 },
  { nombre: "Papaya", variedad: "", cajas: 22, diarias: 15, precio: 35 },
  { nombre: "Uva", variedad: "red globe", cajas: 24, diarias: 6, precio: 60 },
  { nombre: "Palta", variedad: "fuerte", cajas: 33, diarias: 8, precio: 70 },
  { nombre: "Limón", variedad: "", cajas: 33, diarias: 5, precio: 50 },
  { nombre: "Mandarina", variedad: "", cajas: 38, diarias: 0, precio: 30 },
  { nombre: "Plátano", variedad: "de seda", cajas: 46, diarias: 14, precio: 32 },
  { nombre: "Mango", variedad: "Edward", cajas: 155, diarias: 18, precio: 38 },
  { nombre: "Plátano", variedad: "isla", cajas: 160, diarias: 16, precio: 28 },
];
for (const f of STOCK) {
  f.dias = f.diarias ? f.cajas / f.diarias : Infinity;
  f.estado = f.cajas === 0 ? "se-acabo" : f.dias < 2 ? "reponer" : f.diarias === 0 ? "quieta" : f.dias > 8 ? "sobra" : "bien";
}
const ESTADO_STOCK = {
  "se-acabo": ["deuda", "Se acabó"], reponer: ["sol", "Reponer"], sobra: ["acento", "Te sobra"], quieta: ["neutra", "Sin movimiento"], bien: ["exito", "Bien"],
};
const CAJAS_TOTAL = STOCK.reduce((s, f) => s + f.cajas, 0);
const VALOR_STOCK = STOCK.reduce((s, f) => s + f.cajas * f.precio, 0);
const nombreFruta = (f) => [f.nombre, f.variedad].filter(Boolean).join(" ");

// Gráfico del día: barras por hora (SVG estático; en la app las barras crecen una vez al entrar).
function graficoHoras(alto = 150) {
  const max = Math.max(...HOY.porHora.map((p) => p.v));
  const ancho = 100 / HOY.porHora.length;
  const barras = HOY.porHora.map((p, i) => {
    const h = (p.v / max) * (alto - 26);
    const x = i * ancho + ancho * 0.18;
    return `<g><rect x="${x}%" y="${alto - 22 - h}" width="${ancho * 0.64}%" height="${h}" rx="8" fill="var(--acento)" opacity="${i === 2 ? 1 : 0.32}"><title>${p.h}: ${S(p.v)}</title></rect>
      <text x="${x + ancho * 0.32}%" y="${alto - 4}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--texto-suave)">${p.h}</text></g>`;
  }).join("");
  return `<svg width="100%" height="${alto}" role="img" aria-label="Ventas por hora: lo más fuerte fue a las 7 a. m., ${S(3950)}">${barras}</svg>`;
}

function graficoSemana(alto = 120) {
  const max = Math.max(...HOY.semana.map((p) => p.v));
  const n = HOY.semana.length;
  const pts = HOY.semana.map((p, i) => [(i / (n - 1)) * 100, 8 + (1 - p.v / max) * (alto - 40)]);
  const linea = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const etiquetas = HOY.semana.map((p, i) => `<text x="${(i / (n - 1)) * 100}%" y="${alto - 4}" text-anchor="${i === 0 ? "start" : i === n - 1 ? "end" : "middle"}" font-size="12" font-weight="700" fill="var(--texto-suave)">${p.d}</text>`).join("");
  return `<svg width="100%" height="${alto}" role="img" aria-label="Ventas de los últimos 7 días"><svg viewBox="0 0 100 ${alto}" preserveAspectRatio="none" width="100%" height="${alto}">
    <polyline points="0,${alto - 26} ${linea} 100,${alto - 26}" fill="color-mix(in srgb, var(--acento) 10%, transparent)" stroke="none"/>
    <polyline points="${linea}" fill="none" stroke="var(--acento)" stroke-width="2.4" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>
    <circle cx="100%" cy="${pts[n - 1][1]}" r="5" fill="var(--acento)" transform="translate(-5 0)"/>${etiquetas}</svg>`;
}

// Fila de una operación, como FilaOperacion.tsx.
function insigniaOp(o) {
  if (o.estado === "pago") return `<span class="insignia exito">${icono("check")}Pagó${o.medio ? ` · ${o.medio}` : ""}</span>`;
  if (o.estado === "debe") return `<span class="insignia deuda">Lo debe</span>`;
  if (o.estado === "abono") return `<span class="insignia exito">Abono</span>`;
  if (o.estado === "merma") return `<span class="insignia sol">Merma</span>`;
  return `<span class="insignia neutra">Gasto</span>`;
}
function iconoOp(o) {
  if (o.fruta) return fruta(o.fruta);
  const n = o.tipo === "abono" ? "mano" : o.tipo === "gasto" ? "billetera" : "alerta";
  const tono = o.tipo === "abono" ? "exito" : o.tipo === "gasto" ? "acento" : "sol";
  return `<span class="caja-icono ${tono}" style="width:36px;height:36px;border-radius:12px">${icono(n)}</span>`;
}

// La venta que «se dicta» en la maqueta: crédito con precio sugerido (principios 1 y 2).
const DICTADO = {
  dijo: "«Doce cajas de piña golden para el paraíso»",
  cliente: "Juguería El Paraíso", fruta: "Piña", que: "Piña golden", cajas: 12, precio: 40,
};
function tarjetaEntendida() {
  return `<div class="entendido">
    <p class="etiqueta" style="margin-bottom:6px">Venta · esto entendí</p>
    <div class="fila"><span class="avatar c">JP</span><span style="display:grid"><span class="que">Cliente</span><span class="valor">${DICTADO.cliente}</span></span></div>
    <div class="fila">${fruta(DICTADO.fruta)}<span style="display:grid;flex:1"><span class="que">Fruta</span><span class="valor">${DICTADO.cajas} cajas de ${DICTADO.que.toLowerCase()}</span></span>
      <span style="display:grid;text-align:right"><span class="que">Precio</span><span class="valor cifra">${S(DICTADO.precio)} <span class="insignia sol" style="font-size:12px">sugerido</span></span></span></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:14px 4px 10px"><span class="etiqueta">Total</span><span class="cifra grande">${S(DICTADO.cajas * DICTADO.precio)}</span></div>
    <p class="etiqueta" style="margin:0 0 6px 4px">¿Pagó o lo debe?</p>
    <div class="pildora" data-pildora><button type="button" class="pago" aria-pressed="false">Pagó</button><button type="button" class="debe" aria-pressed="false">Lo debe</button></div>
    <button type="button" class="boton" data-confirmar style="width:100%;margin-top:14px;min-height:56px;font-size:18px" disabled>Confirmar</button>
    <p class="suave" style="font-size:14px;text-align:center;margin-top:8px">Dijiste ${DICTADO.dijo}. <kbd>Esc</kbd> para cancelar</p>
  </div>`;
}
const sello = (debe) => `<div class="sello"><span class="circulo">${icono("check")}</span><strong style="font-size:20px">Guardado</strong><span class="suave">${debe ? "Juguería El Paraíso te debe S/ 480.00 más" : "Juguería El Paraíso pagó S/ 480.00"}</span></div>`;

// Simula la voz: mantener el orbe (o la barra espaciadora) → escuchando → soltar → entendiendo → tarjeta.
function conectarVoz({ orbes, alEstado, alTarjeta }) {
  let grabando = false;
  const set = (e) => { orbes().forEach((o) => (o.dataset.estado = e)); alEstado(e); };
  const empezar = () => { if (grabando) return; grabando = true; set("escuchando"); };
  const terminar = () => {
    if (!grabando) return; grabando = false; set("entendiendo");
    setTimeout(() => { set("listo"); alTarjeta(); }, 900);
  };
  document.addEventListener("pointerdown", (e) => { if (e.target.closest("[data-orbe]")) { e.preventDefault(); empezar(); } });
  document.addEventListener("pointerup", terminar);
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.repeat && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !document.querySelector(".velo.abierto")) { e.preventDefault(); empezar(); }
  });
  document.addEventListener("keyup", (e) => { if (e.code === "Space") terminar(); });
}

// Conecta la píldora y el Confirmar de una tarjeta ya pintada dentro de `raiz`.
function conectarTarjeta(raiz, alConfirmar) {
  const confirmar = raiz.querySelector("[data-confirmar]");
  raiz.querySelectorAll("[data-pildora] button").forEach((b) => b.addEventListener("click", () => {
    raiz.querySelectorAll("[data-pildora] button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    confirmar.disabled = false;
  }));
  confirmar.addEventListener("click", () => { navigator.vibrate?.(30); alConfirmar(!!raiz.querySelector('.debe[aria-pressed="true"]')); });
}
