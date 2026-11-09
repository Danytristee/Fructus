// Fructus «Bosque» · maqueta navegable del celular. DATOS DE DEMOSTRACIÓN: nada de esto toca la base ni la app real.
// Los datos salen de ../escritorio/datos.js (clientes y frutas del seed, montos inventados que cuadran entre sí).

Object.assign(ICONOS, {
  menu: '<line x1="4" x2="20" y1="7" y2="7"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="17" y2="17"/>',
  atras: '<path d="m15 18-6-6 6-6"/>',
  lapiz: '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  persona: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
  sinred: '<path d="M12 20h.01"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><path d="M5 13a10 10 0 0 1 5.24-2.76"/><line x1="2" x2="22" y1="2" y2="22"/>',
  campana: '<path d="M10.27 21a2 2 0 0 0 3.46 0"/><path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33"/>',
  instalar: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  reintentar: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  manzana: '<path d="M12 6.528V3a1 1 0 0 1 1-1h0"/><path d="M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21"/>',
});
const ondas = '<span class="ondas" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
const mic = `<span class="mic">${icono("micro")}</span>`;

// ── Estado de la maqueta (los controles del visor lo cambian por la URL) ──
const P = new URLSearchParams(location.search);
const ESTADO = P.get("estado") || "normal"; // normal | vacio | cargando | error
const CON_RED = P.get("red") !== "0";
const TARJETA_VOZ = P.get("tarjetaVoz") !== "0";
const RESULTADO_VOZ = P.get("voz") || "ok"; // ok | error | permiso
// Dentro del visor (un iframe) no hay «safe area»: se simula la del iPhone para que la isla no tape la cabecera.
if (P.get("marco") === "1") document.documentElement.style.setProperty("--seguro-arriba", "50px");
const DIGITAL = 2180; // lo que entró por Yape, Plin o transferencia (el cierre lo separa del efectivo)
const LUNES_PASADO_A_ESTA_HORA = 13630;
let ruta = location.hash.slice(1) || "hoy";
let filtroClientes = "deben", filtroStock = "todas", filtroVentas = "todas", periodo = "hoy";
const anuladas = new Set();
let nuevaArriba = false;

const raiz = document.getElementById("app");
const ir = (r) => { location.hash = r; };
addEventListener("hashchange", () => { ruta = location.hash.slice(1) || "hoy"; cerrarHoja(); pintar(); scrollTo(0, 0); });

// ── Piezas ──
const MANGO = `<svg class="mango-cabecera" viewBox="0 0 220 200" aria-hidden="true">
  <defs><radialGradient id="mg" cx="32%" cy="30%" r="80%"><stop offset="0" stop-color="#FFD25A"/><stop offset=".42" stop-color="#F59A3B"/><stop offset=".78" stop-color="#D6453A"/><stop offset="1" stop-color="#9E2A30"/></radialGradient>
  <linearGradient id="hj" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4E9B5E"/><stop offset="1" stop-color="#1F5E3A"/></linearGradient>
  <radialGradient id="vd" cx="80%" cy="20%" r="50%"><stop offset="0" stop-color="#9CC74A" stop-opacity=".9"/><stop offset="1" stop-color="#9CC74A" stop-opacity="0"/></radialGradient></defs>
  <path d="M30 70C55 18 120 2 182 20 140 34 90 60 30 70Z" fill="url(#hj)"/><path d="M30 70C80 50 128 32 182 20" stroke="#174D2F" stroke-width="2" fill="none"/>
  <path d="M96 40C126 6 176 0 214 16 182 34 140 48 96 40Z" fill="#2E7448" opacity=".95"/>
  <path d="M62 92C90 44 176 46 200 104 220 154 178 196 120 194 72 192 40 140 62 92Z" fill="url(#mg)"/>
  <path d="M62 92C90 44 176 46 200 104 220 154 178 196 120 194 72 192 40 140 62 92Z" fill="url(#vd)"/>
  <ellipse cx="102" cy="96" rx="22" ry="12" fill="#fff" opacity=".28" transform="rotate(-30 102 96)"/>
  <circle cx="132" cy="120" r="3.2" fill="#fff" opacity=".7"/><circle cx="150" cy="96" r="2.2" fill="#fff" opacity=".65"/><circle cx="88" cy="132" r="2.6" fill="#fff" opacity=".6"/>
  <circle cx="60" cy="58" r="2.4" fill="#fff" opacity=".55"/></svg>`;

function cabecera({ titulo, sub, grande = false, volver = null }) {
  const menu = `<button class="boton-menu" data-menu aria-label="Menú: cierre del día, ajustes y salir">${icono("menu")}</button>`;
  if (grande) {
    return `<header class="cabecera"><div class="barra"><div class="marca"><img src="logo/icono-192.png" alt=""><div><strong>Fructus</strong><small>VENTA MAYORISTA DE FRUTAS</small></div></div>${menu}</div>
      <div class="titulo"><h1>${titulo}</h1><p>${sub}</p></div>${MANGO}</header>`;
  }
  return `<header class="cabecera compacta">${volver ? `<button class="volver" data-ir="${volver[0]}">${icono("atras")}${volver[1]}</button>` : ""}
    <div class="barra" style="align-items:flex-start"><div class="titulo" style="margin-top:4px;min-width:0"><h1>${titulo}</h1><p>${sub}</p></div>${menu}</div></header>`;
}

function insignia(o) {
  if (anuladas.has(o)) return `<span class="insignia neutra">Anulada</span>`;
  if (o.estado === "pago") return `<span class="insignia positivo">${icono("check")}Pagó${o.medio ? ` · ${o.medio}` : ""}</span>`;
  if (o.estado === "debe") return `<span class="insignia deuda">Lo debe</span>`;
  if (o.estado === "abono") return `<span class="insignia positivo">Abono</span>`;
  if (o.estado === "merma") return `<span class="insignia aviso">Merma</span>`;
  return `<span class="insignia neutra">Gasto</span>`;
}
function iconoDe(o) {
  if (o.fruta) return fruta(o.fruta);
  const [n, t] = o.tipo === "abono" ? ["mano", "positivo"] : o.tipo === "gasto" ? ["billetera", "neutro"] : ["alerta", "aviso"];
  return `<span class="icono-caja ${t}" style="width:40px;height:40px;border-radius:14px">${icono(n)}</span>`;
}
const filaOp = (o, i, nueva) => `<button class="fila-op ${nueva ? "nueva" : ""}" ${o.tipo === "venta" ? `data-venta="${i}"` : ""}>${iconoDe(o)}
  <span class="cuerpo"><strong>${o.quien}</strong><span>${o.hora} · ${o.que}</span></span>
  <span class="der"><span class="cifra" ${anuladas.has(o) ? 'style="text-decoration:line-through;color:var(--texto-2)"' : ""}>${["gasto", "merma"].includes(o.tipo) ? "−" : ""}${S(o.monto)}</span>${insignia(o)}</span></button>`;

function microGrafico() {
  const v = HOY.porHora.map((p) => p.v), max = Math.max(...v), n = v.length;
  const pts = v.map((x, i) => `${(i / (n - 1)) * 100},${30 - (x / max) * 24}`).join(" ");
  return `<svg class="micro" viewBox="0 0 100 32" preserveAspectRatio="none" role="img" aria-label="Ventas por hora: lo más fuerte fue a las 7 a. m.">
    <defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D5F45A" stop-opacity=".75"/><stop offset="1" stop-color="#D5F45A" stop-opacity="0"/></linearGradient></defs>
    <polygon points="0,32 ${pts} 100,32" fill="url(#ar)"/><polyline points="${pts}" fill="none" stroke="#246B45" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}

// ── Pantallas ──
function hoy() {
  const head = cabecera({ titulo: "Hoy", sub: HOY.fecha, grande: true });
  if (ESTADO === "cargando") {
    const e = (h, w = "100%") => `<div class="esqueleto" style="height:${h}px;width:${w}"></div>`;
    return head + `<main class="contenido" aria-busy="true"><div class="tarjeta grande" style="display:grid;gap:12px">${e(18, "40%")}${e(42, "75%")}${e(16, "90%")}${e(54)}</div>
      <div class="tarjeta" style="display:grid;gap:10px">${e(18, "35%")}${e(32, "60%")}${e(1)}${e(18, "35%")}${e(32, "60%")}</div>
      <div class="dos"><div class="tarjeta">${e(70)}</div><div class="tarjeta">${e(70)}</div></div><p class="oculto-lector">Cargando tu día</p></main>`;
  }
  if (ESTADO === "error") {
    return head + `<main class="contenido"><div class="tarjeta grande vacio"><span class="icono-caja deuda">${icono("sinred")}</span>
      <h2 style="font-size:22px">No pudimos leer tu día</h2><p class="t2">Revisa tu señal. Lo que ya guardaste está a salvo.</p>
      <button class="boton" data-recargar>${icono("reintentar")}Volver a intentar</button></div>${TARJETA_VOZ ? tarjetaVoz() : ""}</main>`;
  }
  const vacio = ESTADO === "vacio";
  const vendido = vacio ? 0 : HOY.contado + HOY.credito;
  const comp = Math.round((100 * (vendido - LUNES_PASADO_A_ESTA_HORA)) / LUNES_PASADO_A_ESTA_HORA);
  const ventasCard = vacio
    ? `<section class="tarjeta grande vacio subir"><span class="icono-caja bosque">${icono("tendencia")}</span><h2 style="font-size:22px">Todavía no vendiste hoy</h2>
        <p class="t2">Mantén el micrófono y di la venta, por ejemplo: «10 cajas de mango a don Lucho».</p></section>`
    : `<section class="tarjeta grande ventas-hoy subir" aria-label="Lo vendido hoy">
        <div class="arriba"><span class="icono-caja bosque">${icono("tendencia")}</span><div style="min-width:0"><span class="etiqueta">Vendiste hoy</span>
          <span class="cifra monto" style="display:block">${S(vendido)}</span></div></div>
        <p class="desglose"><b class="cifra">${S(HOY.contado)}</b> al contado y <b class="cifra">${S(HOY.credito)}</b> al crédito</p>
        <div style="margin-top:10px"><span class="comparacion">${icono("tendencia")}${comp >= 0 ? "+" : ""}${comp} % que el lunes pasado a esta hora</span></div>
        ${microGrafico()}
        <div class="separador" style="margin-top:2px"></div>
        <div class="pares"><div class="par"><span class="icono-caja neutro" style="width:44px;height:44px">${icono("stock")}</span><span><b class="cifra">${HOY.cajas}</b><span>cajas vendidas</span></span></div><span class="linea"></span>
        <div class="par"><span class="icono-caja neutro" style="width:44px;height:44px">${icono("recibo")}</span><span><b class="cifra">${HOY.ventas}</b><span>ventas</span></span></div></div></section>`;
  const alertas = STOCK.filter((f) => f.estado === "se-acabo" || f.estado === "reponer");
  const primera = alertas[0];
  return head + `<main class="contenido">
    ${ventasCard}
    <section class="tarjeta dinero subir" style="animation-delay:70ms">
      <div class="fila"><div><span class="etiqueta" style="display:flex;align-items:center;gap:8px"><span class="icono-caja positivo" style="width:34px;height:34px;border-radius:11px">${icono("billetera")}</span>Cobraste</span>
        <span class="cifra grande positivo">${S(vacio ? 0 : HOY.cobrado)}</span><span class="pie"><b class="cifra">${S(vacio ? 0 : HOY.contado)}</b> al contado y <b class="cifra">${S(vacio ? 0 : HOY.abonos)}</b> de abonos</span></div></div>
      <div class="separador"></div>
      <a class="fila tocable" data-ir="clientes"><div><span class="etiqueta" style="display:flex;align-items:center;gap:8px"><span class="icono-caja deuda" style="width:34px;height:34px;border-radius:11px">${icono("mano")}</span>Te deben</span>
        <span class="cifra grande deuda">${S(TE_DEBEN)}</span><span class="pie">${DEUDORES.length} clientes${vacio ? "" : ` · <b class="cifra">${S(HOY.credito)}</b> son de hoy`}</span></div><span class="chev">${icono("flecha")}</span></a>
    </section>
    <div class="dos subir" style="animation-delay:140ms">
      <a class="tarjeta mosaico tocable" data-ir="clientes"><span class="cab"><span class="icono-caja neutro">${icono("clientes")}</span><span class="chev">${icono("flecha")}</span></span>
        <span class="etiqueta">Clientes</span><span class="cifra">${DEUDORES.length}<small>te deben</small></span><span class="t2" style="font-size:15px">${CLIENTES.length - DEUDORES.length} al día</span></a>
      <a class="tarjeta mosaico tocable" data-ir="stock"><span class="cab"><span class="icono-caja neutro">${icono("stock")}</span><span class="chev">${icono("flecha")}</span></span>
        <span class="etiqueta">Stock</span><span class="cifra">${CAJAS_TOTAL}<small>cajas</small></span><span><span class="insignia aviso">${alertas.length} por reponer</span></span></a>
    </div>
    ${primera ? `<div class="tarjeta alerta subir" style="animation-delay:200ms"><span class="icono-caja aviso">${icono("alerta")}</span>
      <span class="cuerpo"><strong>Se acabó ${primera.nombre.toLowerCase()} ${primera.variedad}</strong><span>${alertas.length > 1 ? `y ${alertas.length - 1} ${alertas.length === 2 ? "fruta" : "frutas"} más por reponer` : "Vendes unas " + primera.diarias + " al día"}</span></span>
      <button class="boton lima chico" data-ir="stock">Ver stock</button></div>` : ""}
    ${TARJETA_VOZ ? tarjetaVoz() : ""}
    ${vacio ? "" : `<div class="seccion"><h2>Lo último</h2><a data-ir="ventas">Ver todo</a></div>
    <section class="tarjeta lista">${ULTIMAS.slice(0, 6).map((o, i) => filaOp(o, i, i === 0 && nuevaArriba)).join("")}</section>`}
  </main>`;
}

const tarjetaVoz = () => `<section class="tarjeta-voz subir" data-voz style="animation-delay:240ms" aria-label="Venta por voz: mantén apretado y habla">
  <span class="microfono">${mic}${ondas}</span>
  <span style="min-width:0"><h2>Venta por voz</h2><p>Mantén apretado y di: «12 cajas de piña al paraíso»</p></span>
  <button class="a-mano" data-a-mano>A mano</button>
  <svg class="onda" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><path d="M0 14C14 4 26 18 40 12S66 2 80 10 94 16 100 8V20H0Z" fill="#D5F45A" opacity=".25"/></svg></section>`;

function clientes() {
  const lista = CLIENTES.filter((c) => filtroClientes === "todos" || (filtroClientes === "deben" ? c.saldo > 0 : c.saldo <= 0));
  const mayor = DEUDORES[0];
  return cabecera({ titulo: "Clientes", sub: "Tu cuaderno: quién te debe y cuánto" }) + `<main class="contenido">
    <section class="tarjeta grande resumen subir"><span class="etiqueta">Te deben en total</span><span class="cifra deuda">${S(TE_DEBEN)}</span>
      <p class="t2">entre ${DEUDORES.length} clientes; más que nadie, ${mayor.nombre} (<b class="cifra" style="color:var(--texto)">${S(mayor.saldo)}</b>)</p>
      <div class="acciones"><button class="boton" data-abono>${icono("mano")}Registrar abono</button></div></section>
    <div class="buscar-fila subir" style="animation-delay:60ms"><label class="buscador">${icono("buscar")}<input id="buscar" placeholder="Busca por nombre o apodo" aria-label="Buscar cliente" autocomplete="off"></label>
      <button class="redondo" aria-label="Nuevo cliente" data-aviso="Nuevo cliente: la misma hoja de hoy, con el estilo nuevo.">${icono("persona")}</button></div>
    <div class="filtros subir" style="animation-delay:100ms" role="group" aria-label="Filtrar">${[["deben", "Te deben", DEUDORES.length], ["dia", "Al día", CLIENTES.length - DEUDORES.length], ["todos", "Todos", CLIENTES.length]]
      .map(([k, t, n]) => `<button class="filtro" data-filtro-clientes="${k}" aria-pressed="${filtroClientes === k}">${t}<b>${n}</b></button>`).join("")}</div>
    <section class="tarjeta lista subir" style="animation-delay:140ms" id="lista-clientes">${lista.map((c, i) => `<button class="fila-op" data-ir="cliente-${CLIENTES.indexOf(c)}" data-texto="${(c.nombre + " " + c.apodo).toLowerCase()}">
      <span class="avatar ${"abcd"[i % 4]}">${iniciales(c.nombre)}</span><span class="cuerpo"><strong>${c.nombre}</strong><span>${c.apodo ? `«${c.apodo}»` : c.ultimo}</span></span>
      <span class="der">${c.saldo > 0 ? `<span class="cifra deuda">${S(c.saldo)}</span><small class="deuda">debe</small>` : `<span class="insignia positivo">Al día</span>`}</span><span class="chev">${icono("flecha")}</span></button>`).join("")}
      <p class="vacio t2" id="sin-resultados" hidden>No encontré a nadie con ese nombre. Revisa cómo lo escribiste o créalo con <b>+</b>.</p></section>
  </main>`;
}

function tramosDe(c) {
  const t = [["0 a 7 días", 0], ["8 a 15 días", 0], ["16 a 30 días", 0], ["Más de 30 días", 0]];
  const idx = c.dias <= 7 ? 0 : c.dias <= 15 ? 1 : c.dias <= 30 ? 2 : 3;
  const viejo = idx === 0 ? c.saldo : Math.round(c.saldo * 0.45);
  t[idx][1] += viejo; t[0][1] += c.saldo - viejo;
  return t;
}
function ficha(i) {
  const c = CLIENTES[i];
  const h = historialDe(c);
  let resta = c.saldo;
  return cabecera({ titulo: c.nombre, sub: c.apodo ? `«${c.apodo}»` : c.ultimo, volver: ["clientes", "Clientes"] }) + `<main class="contenido">
    <section class="tarjeta grande resumen subir">${c.saldo > 0 ? `<span class="etiqueta">Te debe</span><span class="cifra deuda" style="font-size:40px">${S(c.saldo)}</span>
      <p class="t2">Lo más antiguo sin pagar es de hace <b style="color:var(--texto)">${c.dias} días</b></p>` : `<span class="insignia positivo" style="font-size:18px;padding:8px 16px">${icono("check")}Al día</span><p class="t2" style="margin-top:8px">${c.ultimo}</p>`}
      <div class="chips">${c.doc ? `<span class="chip">${c.doc}</span>` : ""}${c.tel ? `<span class="chip">${icono("telefono")}${c.tel}</span>` : ""}</div>
      ${c.saldo > 0 ? `<div class="acciones"><button class="boton" data-abono="${i}">${icono("mano")}Registrar abono</button></div>` : ""}
      <div class="acciones" style="margin-top:8px"><button class="boton contorno chico" data-aviso="Abre WhatsApp con el saldo y el detalle, listo para enviar.">${icono("chat")}WhatsApp</button>${c.tel ? `<button class="boton contorno chico" data-aviso="Llama a ${c.tel}.">${icono("telefono")}Llamar</button>` : ""}</div></section>
    ${c.saldo > 0 ? `<section class="tarjeta subir" style="animation-delay:70ms"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 style="font-size:19px">¿Desde cuándo te debe?</h2><span class="insignia lima">Nuevo</span></div>
      <div class="tramos">${tramosDe(c).map(([t, v]) => `<div class="tramo"><span>${t}</span><span class="barra"><span style="width:${(100 * v) / c.saldo}%;${t.startsWith("Más") ? "" : "background:var(--aviso)"};${v ? "" : "width:0"}"></span></span><span class="cifra ${v ? "" : "t2"}">${S(v)}</span></div>`).join("")}</div></section>` : ""}
    <div class="seccion"><h2>Historial</h2><span class="t2" style="font-size:15px">Ventas y abonos</span></div>
    <section class="tarjeta lista subir" style="animation-delay:120ms">${h.map((r) => { const fila = `<div class="fila-op"><span class="icono-caja ${r.monto < 0 ? "positivo" : "deuda"}" style="width:40px;height:40px;border-radius:14px">${icono(r.monto < 0 ? "mano" : "recibo")}</span>
      <span class="cuerpo"><strong>${r.dia}</strong><span>${r.hora} · ${r.que}</span></span><span class="der"><span class="cifra ${r.monto < 0 ? "positivo" : ""}">${r.monto < 0 ? "−" + S(-r.monto) : S(r.monto)}</span><small>le quedaba ${S(Math.max(resta, 0))}</small></span></div>`; resta -= r.monto; return fila; }).join("")}</section>
  </main>`;
}

function stock() {
  const cuenta = (e) => STOCK.filter((f) => e.includes(f.estado)).length;
  const grupos = { todas: null, reponer: ["se-acabo", "reponer"], sobra: ["sobra"], quieta: ["quieta"] };
  const lista = STOCK.filter((f) => !grupos[filtroStock] || grupos[filtroStock].includes(f.estado));
  const color = { "se-acabo": "var(--deuda-relleno)", reponer: "#D9822B", sobra: "var(--bosque-2)", quieta: "var(--borde)", bien: "var(--positivo-relleno)" };
  const tono = { "se-acabo": "deuda", reponer: "aviso", sobra: "positivo", quieta: "neutra", bien: "positivo" };
  const frase = (f) => f.cajas === 0 ? `Compra unas ${f.diarias * 4} para 4 días` : f.diarias === 0 ? "No se vendió esta semana" : `Te alcanza para ${f.dias < 1 ? "menos de un día" : Math.floor(f.dias) === 1 ? "1 día" : Math.floor(f.dias) + " días"}`;
  return cabecera({ titulo: "Stock", sub: "Tus cajas y lo que conviene hacer hoy" }) + `<main class="contenido">
    <section class="tarjeta grande resumen subir"><span class="etiqueta">Tienes en el puesto</span><span class="cifra">${CAJAS_TOTAL} cajas</span><p class="t2">valen unos <b class="cifra" style="color:var(--texto)">${S(VALOR_STOCK)}</b></p>
      <div class="contadores"><div class="contador"><span class="cifra deuda">${cuenta(["se-acabo"])}</span><span>se acabó</span></div><div class="contador"><span class="cifra aviso">${cuenta(["reponer"])}</span><span>por reponer</span></div><div class="contador"><span class="cifra positivo">${cuenta(["sobra"])}</span><span>te sobran</span></div></div>
      <div class="acciones"><button class="boton" data-mover="compra">${icono("camion")}Compra</button><button class="boton contorno" data-mover="merma">${icono("alerta")}Merma</button></div></section>
    <div class="filtros subir" style="animation-delay:60ms">${[["todas", "Todas", STOCK.length], ["reponer", "Reponer", cuenta(["se-acabo", "reponer"])], ["sobra", "Te sobra", cuenta(["sobra"])], ["quieta", "Sin movimiento", cuenta(["quieta"])]]
      .map(([k, t, n]) => `<button class="filtro" data-filtro-stock="${k}" aria-pressed="${filtroStock === k}">${t}<b>${n}</b></button>`).join("")}</div>
    ${lista.map((f, i) => `<section class="tarjeta subir" style="animation-delay:${100 + i * 40}ms"><div class="fruta-fila">${fruta(f.nombre)}
      <span style="min-width:0"><strong style="display:block">${nombreFruta(f)}</strong><span class="t2" style="font-size:15px">${f.diarias ? `Vendes unas ${f.diarias} al día` : "Sin ventas esta semana"}</span></span>
      <span><span class="cifra ${f.cajas === 0 ? "deuda" : ""}">${f.cajas}</span><span class="t2" style="font-size:14px;display:block;text-align:right">cajas</span></span></div>
      <div class="alcance"><span style="width:${f.cajas === 0 ? 100 : Math.min(f.dias / 7, 1) * 100}%;background:${color[f.estado]}"></span></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px"><span class="t2" style="font-size:15px">${frase(f)}</span><span class="insignia ${tono[f.estado]}">${ESTADO_STOCK[f.estado][1]}</span></div></section>`).join("")}
  </main>`;
}

const MAS_VENTAS = [
  { dia: "Ayer · domingo 8", ventas: [{ hora: "11:20", tipo: "venta", quien: "Hostal Libertad", que: "4 cajas de papaya", fruta: "Papaya", monto: 140, estado: "debe" },
    { hora: "9:05", tipo: "venta", quien: "Rosa Quispe", que: "10 cajas de plátano isla", fruta: "Plátano", monto: 280, estado: "pago", medio: "Efectivo" },
    { hora: "7:40", tipo: "venta", quien: "Frutería Los Ángeles", que: "20 cajas de mango Edward", fruta: "Mango", monto: 760, estado: "debe" }] },
  { dia: "Sábado 7", ventas: [{ hora: "8:12", tipo: "venta", quien: "Agroinversiones Moche", que: "50 cajas de mango Kent", fruta: "Mango", monto: 2250, estado: "pago", medio: "Transferencia" },
    { hora: "6:15", tipo: "venta", quien: "Luis Paredes", que: "20 cajas de mango Kent", fruta: "Mango", monto: 900, estado: "debe" }] },
];
function ventas() {
  const hoyV = ULTIMAS.filter((o) => o.tipo === "venta");
  const pasa = (o) => filtroVentas === "todas" || (filtroVentas === "contado" ? o.estado === "pago" : o.estado === "debe");
  const grupos = [{ dia: "Hoy", ventas: hoyV }, ...(periodo === "semana" ? MAS_VENTAS : [])];
  const total = periodo === "hoy" ? HOY.contado + HOY.credito : HOY.semana.reduce((s, d) => s + d.v, 0);
  const todas = grupos.flatMap((g) => g.ventas);
  return cabecera({ titulo: "Ventas", sub: "Lo que vendiste, venta por venta" }) + `<main class="contenido">
    <section class="tarjeta grande resumen subir"><div class="segmento" role="group" aria-label="Período"><button data-periodo="hoy" aria-pressed="${periodo === "hoy"}">Hoy</button><button data-periodo="semana" aria-pressed="${periodo === "semana"}">7 días</button></div>
      <span class="etiqueta" style="display:block;margin-top:14px">${periodo === "hoy" ? "Hoy vendiste" : "En 7 días vendiste"}</span><span class="cifra">${S(total)}</span>
      <p class="t2">${periodo === "hoy" ? `${HOY.ventas} ventas · <b class="cifra deuda">${S(HOY.credito)}</b> al crédito` : "142 ventas · del martes 3 a hoy"}</p></section>
    <div class="filtros subir" style="animation-delay:60ms">${[["todas", "Todas", todas.length], ["contado", "Contado", todas.filter((o) => o.estado === "pago").length], ["credito", "Crédito", todas.filter((o) => o.estado === "debe").length]]
      .map(([k, t, n]) => `<button class="filtro" data-filtro-ventas="${k}" aria-pressed="${filtroVentas === k}">${t}<b>${n}</b></button>`).join("")}</div>
    ${grupos.map((g) => `<p class="dia">${g.dia}</p><section class="tarjeta lista subir">${g.ventas.filter(pasa).map((o) => filaOp(o, ULTIMAS.indexOf(o) >= 0 ? ULTIMAS.indexOf(o) : "x" + todas.indexOf(o))).join("") || '<p class="vacio t2">Nada con este filtro.</p>'}</section>`).join("")}
    <p class="t2" style="text-align:center;font-size:15px">En la maqueta «Hoy» muestra ${hoyV.length} de las ${HOY.ventas} ventas.</p>
  </main>`;
}

function cierre() {
  const efectivo = HOY.cobrado - DIGITAL - HOY.gastos;
  const fila = (t, v, c = "") => `<div style="display:flex;justify-content:space-between;align-items:center;min-height:48px;border-bottom:1px solid var(--borde)"><span>${t}</span><span class="cifra ${c}">${v}</span></div>`;
  return cabecera({ titulo: "Cierre del día", sub: HOY.fecha, volver: ["hoy", "Hoy"] }) + `<main class="contenido">
    <section class="tarjeta grande resumen subir"><span class="etiqueta">Debería haber en tu caja</span><span class="cifra" style="font-size:42px;color:var(--bosque)">${S(efectivo)}</span>
      <p class="t2">en efectivo. Cuenta tu caja y compara: si no cuadra, revisa los gastos del día.</p>
      <p class="t2" style="margin-top:6px">Además entraron <b class="cifra" style="color:var(--texto)">${S(DIGITAL)}</b> por Yape, Plin o transferencia.</p></section>
    <section class="tarjeta subir" style="animation-delay:70ms"><h2 style="font-size:19px;margin-bottom:4px">De dónde sale</h2>
      ${fila("Vendiste", S(HOY.contado + HOY.credito))}${fila("· al contado", S(HOY.contado), "positivo")}${fila("· al crédito", S(HOY.credito), "deuda")}${fila("Abonos que cobraste", S(HOY.abonos), "positivo")}${fila("Gastos", "−" + S(HOY.gastos))}${fila("Compras", S(0))}</section>
    <div style="display:grid;gap:8px" class="subir"><button class="boton lima" data-aviso="Abre WhatsApp con el resumen del día, listo para enviar.">${icono("chat")}Enviar por WhatsApp</button>
      <button class="boton contorno" data-aviso="Baja el mes en Excel para el contador.">${icono("bajar")}Exportar el mes en Excel</button></div>
  </main>`;
}

function ajustes() {
  return cabecera({ titulo: "Ajustes", sub: "Tu catálogo y tu equipo", volver: ["hoy", "Hoy"] }) + `<main class="contenido">
    <div class="seccion" style="margin-top:0"><h2>Tus frutas</h2></div>
    <section class="tarjeta lista">${STOCK.map((f) => `<div class="fila-op">${fruta(f.nombre)}<span class="cuerpo"><strong>${nombreFruta(f)}</strong><span>Precio de referencia por caja</span></span><span class="cifra">${S(f.precio)}</span></div>`).join("")}</section>
    <div class="seccion"><h2>Tu equipo</h2></div>
    <section class="tarjeta lista">${[["Dueño de prueba", "Dueño"], ["Administrador de prueba", "Administrador"], ["Ayudante de prueba", "Ayudante"], ["Contador de prueba", "Contador"]].map(([n, r], i) => `<div class="fila-op"><span class="avatar ${"abcd"[i]}">${iniciales(n)}</span><span class="cuerpo"><strong>${n}</strong></span><span class="t2">${r}</span></div>`).join("")}</section>
  </main>`;
}

function login() {
  return `<div class="login"><div class="arriba subir"><img src="logo/icono-192.png" alt=""><strong>Fructus</strong><p>Tus ventas, deudas y stock, por voz.</p></div>
    <form class="tarjeta grande subir" style="animation-delay:100ms" onsubmit="event.preventDefault();location.hash='hoy'">
      <div class="campo"><label for="correo">Correo</label><input id="correo" type="email" autocomplete="username" placeholder="tu@correo.com"></div>
      <div class="campo"><label for="clave">Clave</label><input id="clave" type="password" autocomplete="current-password" placeholder="••••••••"></div>
      <button class="boton lima confirmar" type="submit">Entrar</button>
      <p class="t2" style="font-size:15px;text-align:center">¿No tienes cuenta? Pídele al dueño un enlace de invitación.</p></form></div>`;
}

// ── Marco: barra de abajo y franja sin señal ──
const destinos = [["hoy", "Hoy", "casa"], ["clientes", "Clientes", "clientes"], null, ["stock", "Stock", "stock"], ["ventas", "Ventas", "ventas"]];
function nav() {
  const actual = ruta.startsWith("cliente") ? "clientes" : ruta;
  return `<nav class="nav" aria-label="Principal">${destinos.map((d) => d === null
    ? `<button class="orbe" data-voz data-estado="listo" aria-label="Mantén para hablar">${mic}${ondas}<span class="halo"></span></button>`
    : `<a href="#${d[0]}" ${actual === d[0] ? 'aria-current="page"' : ""}>${icono(d[2])}${d[1]}</a>`).join("")}</nav>
    <p class="etiqueta-voz" id="etiqueta-voz" role="status" aria-live="polite" hidden></p>`;
}

function pintar() {
  if (ruta === "login") { raiz.innerHTML = login(); return; }
  const pantalla = ruta === "hoy" ? hoy() : ruta === "clientes" ? clientes() : ruta.startsWith("cliente-") ? ficha(+ruta.split("-")[1])
    : ruta === "stock" ? stock() : ruta === "ventas" ? ventas() : ruta === "cierre" ? cierre() : ruta === "ajustes" ? ajustes() : hoy();
  raiz.innerHTML = (CON_RED ? "" : `<div class="sin-red" role="status">${icono("sinred")}Sin señal. Lo que ya guardaste está a salvo.</div>`) + pantalla + nav();
  nuevaArriba = false;
  const buscar = document.getElementById("buscar");
  if (buscar) buscar.addEventListener("input", () => {
    const q = buscar.value.trim().toLowerCase(); let n = 0;
    document.querySelectorAll("#lista-clientes [data-texto]").forEach((f) => { const ve = f.dataset.texto.includes(q); f.hidden = !ve; n += ve; });
    document.getElementById("sin-resultados").hidden = n > 0;
  });
}

// ── Hoja ──
const velo = document.getElementById("velo"), hoja = document.getElementById("hoja");
function abrirHoja(html, etiqueta) {
  hoja.onclick = null;
  hoja.innerHTML = `<div class="asa"></div><div class="cascada" style="display:grid;gap:12px">${html}</div>`;
  hoja.setAttribute("aria-label", etiqueta); velo.classList.add("abierto"); hoja.classList.add("abierta");
  setTimeout(() => hoja.querySelector("[data-foco]")?.focus(), 350);
}
function cerrarHoja() { velo.classList.remove("abierto"); hoja.classList.remove("abierta"); }
velo.addEventListener("click", cerrarHoja);
addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarHoja(); });
const vibrar = () => navigator.vibrate?.(30);
function mostrarSello(titulo, frase, despues) {
  vibrar();
  hoja.querySelector(".cascada").innerHTML = `<div class="sello" role="status"><span class="circulo">${icono("check")}</span><strong>${titulo}</strong><span class="t2">${frase}</span></div>`;
  setTimeout(() => { cerrarHoja(); despues?.(); }, 1500);
}
// Nada optimista en dinero: el sello sale cuando «la base respondió» (aquí, 600 ms).
function guardar(boton, alTerminar) { boton.disabled = true; boton.textContent = "Guardando…"; setTimeout(alTerminar, 600); }

// ── La voz: mantener → hablar → soltar → tarjeta → Confirmar ──
let grabando = false, inicio = 0;
const etiquetaVoz = (t) => { const e = document.getElementById("etiqueta-voz"); if (!e) return; e.textContent = t; e.hidden = !t; };
const ponerEstado = (e) => document.querySelectorAll("[data-voz]").forEach((o) => (o.dataset.estado = e));
function empezar() {
  if (grabando || hoja.classList.contains("abierta")) return;
  if (!CON_RED) { etiquetaVoz("Sin señal: no puedo enviar. Tu audio se guarda."); setTimeout(() => etiquetaVoz(""), 2600); return; }
  if (RESULTADO_VOZ === "permiso") { hojaPermiso(); return; }
  grabando = true; inicio = Date.now(); vibrar(); ponerEstado("escuchando"); etiquetaVoz("Te escucho… suelta para enviar");
}
function terminar() {
  if (!grabando) return; grabando = false;
  if (Date.now() - inicio < 350) { ponerEstado("listo"); etiquetaVoz("Mantén apretado mientras hablas"); setTimeout(() => etiquetaVoz(""), 2200); return; }
  ponerEstado("entendiendo"); etiquetaVoz("Entendiendo…");
  setTimeout(() => { ponerEstado("listo"); etiquetaVoz(""); RESULTADO_VOZ === "error" ? hojaError() : tarjetaVenta(); }, 1000);
}
document.addEventListener("pointerdown", (e) => { if (e.target.closest("[data-voz]") && !e.target.closest("[data-a-mano]")) { e.preventDefault(); empezar(); } });
document.addEventListener("pointerup", terminar);
document.addEventListener("pointercancel", terminar);
document.addEventListener("keydown", (e) => { if (e.code === "Space" && !e.repeat && !/INPUT/.test(document.activeElement.tagName)) { e.preventDefault(); empezar(); } });
document.addEventListener("keyup", (e) => { if (e.code === "Space") terminar(); });
document.addEventListener("contextmenu", (e) => { if (e.target.closest("[data-voz]")) e.preventDefault(); });

function hojaError() {
  abrirHoja(`<div class="vacio" style="padding-bottom:4px"><span class="icono-caja deuda">${icono("micro")}</span><h2>No te entendí</h2>
    <p class="t2">Inténtalo otra vez, más cerca del celular. Tu audio quedó guardado: no se perdió nada.</p></div>
    <button class="boton confirmar" data-foco data-reenviar>${icono("reintentar")}Volver a enviar el audio</button>
    <button class="boton contorno" data-venta-mano>Registrar a mano</button>`, "No te entendí");
}
function hojaPermiso() {
  abrirHoja(`<div class="vacio" style="padding-bottom:4px"><span class="icono-caja aviso">${icono("micro")}</span><h2>Necesito el micrófono</h2>
    <p class="t2">Dale permiso en el candado de arriba, junto a la dirección, y vuelve a intentarlo.</p></div>
    <button class="boton confirmar" data-foco data-cerrar>Ya le di permiso</button><button class="boton contorno" data-venta-mano>Registrar a mano</button>`, "Falta permiso del micrófono");
}

// La tarjeta: muestra lo entendido, cada dato se toca para corregirlo y nada se guarda sin «Pagó / Lo debe» y Confirmar.
const OPC_CLIENTES = ["Juguería El Paraíso", "Frutería Los Ángeles", "Restaurante Mochica"];
function tarjetaVenta(manual = false) {
  const t = { cliente: manual ? null : "Juguería El Paraíso", fruta: manual ? null : STOCK.find((f) => f.nombre === "Piña"), cajas: manual ? 1 : 12, cond: null, medio: "Efectivo" };
  const total = () => (t.fruta ? t.fruta.precio * t.cajas : 0);
  function html() {
    return `<div style="display:flex;align-items:center;gap:8px"><span class="insignia lima">Venta</span><span class="t2">${manual ? "Registrar a mano" : "Esto entendí"}</span></div>
    <div class="entendido">
      <button class="dato" data-campo="cliente"><span class="avatar c">${t.cliente ? iniciales(t.cliente) : "?"}</span><span><span class="q">Cliente</span><span class="v">${t.cliente ?? "Toca para elegir"}</span></span><span class="lapiz">${icono("lapiz")}</span></button>
      <div id="op-cliente" hidden style="display:grid;gap:6px;padding-left:8px">${(manual ? CLIENTES.slice(0, 5).map((c) => c.nombre) : OPC_CLIENTES).map((n) => `<button class="filtro" style="justify-content:flex-start" data-elegir-cliente="${n}">${n}</button>`).join("")}</div>
      <button class="dato" data-campo="fruta">${t.fruta ? fruta(t.fruta.nombre) : `<span class="avatar">?</span>`}<span><span class="q">Fruta</span><span class="v">${t.fruta ? nombreFruta(t.fruta) : "Toca para elegir"}</span></span><span class="lapiz">${icono("lapiz")}</span></button>
      <div id="op-fruta" hidden style="display:flex;flex-wrap:wrap;gap:6px;padding-left:8px">${STOCK.filter((f) => f.cajas > 0).map((f) => `<button class="filtro" data-elegir-fruta="${STOCK.indexOf(f)}">${nombreFruta(f)}</button>`).join("")}</div>
      <div class="dos" style="gap:8px"><div class="dato" style="justify-content:space-between"><span><span class="q">Cajas</span><span class="v cifra">${t.cajas}</span></span>
        <span style="display:flex;gap:6px"><button class="redondo" style="width:48px;height:48px" data-cajas="-1" aria-label="Una caja menos">−</button><button class="redondo" style="width:48px;height:48px" data-cajas="1" aria-label="Una caja más">+</button></span></div>
        <button class="dato" data-aviso="Aquí se corrige el precio con el teclado de números."><span><span class="q">Precio por caja</span><span class="v cifra">${t.fruta ? S(t.fruta.precio) : "—"}</span>${t.fruta ? '<span class="insignia aviso" style="font-size:12px;margin-top:2px">sugerido</span>' : ""}</span></button></div>
    </div>
    ${t.fruta && !manual ? `<p class="duda">${icono("info")}No dijiste el precio: puse el último que le cobraste.</p>` : ""}
    <div class="total-fila"><span class="etiqueta">Total</span><span class="cifra">${S(total())}</span></div>
    <div><p class="etiqueta" style="margin:0 0 6px 4px">¿Pagó o lo debe?</p>
      <div class="pildora" data-valor="${t.cond ?? ""}"><span class="fondo"></span><button data-v="pago" aria-pressed="${t.cond === "pago"}">Pagó</button><button data-v="debe" aria-pressed="${t.cond === "debe"}">Lo debe</button></div></div>
    ${t.cond === "pago" ? `<div class="medios">${["Efectivo", "Yape", "Plin", "Transferencia"].map((m) => `<button class="filtro" data-medio="${m}" aria-pressed="${t.medio === m}">${m}</button>`).join("")}</div>` : ""}
    <button class="boton confirmar" data-confirmar ${t.cond && t.cliente && t.fruta ? "" : "disabled"}>Confirmar</button>
    <button class="boton contorno chico" data-cerrar style="justify-self:center">Cancelar</button>`;
  }
  abrirHoja(html(), "Confirmar venta");
  const repintar = () => { hoja.querySelector(".cascada").innerHTML = html(); hoja.querySelectorAll(".cascada > *").forEach((x) => (x.style.animation = "none")); };
  hoja.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.campo) { const op = document.getElementById("op-" + b.dataset.campo); op.hidden = !op.hidden; return; }
    if (b.dataset.elegirCliente) { t.cliente = b.dataset.elegirCliente; return repintar(); }
    if (b.dataset.elegirFruta) { t.fruta = STOCK[+b.dataset.elegirFruta]; return repintar(); }
    if (b.dataset.cajas) { t.cajas = Math.max(1, t.cajas + +b.dataset.cajas); return repintar(); }
    if (b.dataset.v) { t.cond = b.dataset.v; return repintar(); }
    if (b.dataset.medio) { t.medio = b.dataset.medio; return repintar(); }
    if (b.dataset.confirmar !== undefined) {
      guardar(b, () => {
        const venta = { hora: "12:44", tipo: "venta", quien: t.cliente, que: `${t.cajas} cajas de ${nombreFruta(t.fruta).toLowerCase()}`, fruta: t.fruta.nombre, monto: total(), estado: t.cond, medio: t.cond === "pago" ? t.medio : undefined };
        mostrarSello("Guardado", t.cond === "debe" ? `${t.cliente} te debe ${S(total())} más` : `${t.cliente} pagó ${S(total())} · ${t.medio}`, () => {
          ULTIMAS.unshift(venta); HOY.ventas++; HOY.cajas += t.cajas;
          if (t.cond === "debe") { HOY.credito += total(); const c = CLIENTES.find((x) => x.nombre === t.cliente); if (c) c.saldo += total(); } else { HOY.contado += total(); HOY.cobrado += total(); }
          nuevaArriba = true; pintar();
        });
      });
    }
  };
}

function hojaAbono(i) {
  const c = i === undefined || i === "" ? null : CLIENTES[+i];
  const quien = c ?? DEUDORES[0];
  let medio = "Efectivo";
  abrirHoja(`<h2>Abono de ${quien.nombre}</h2><p class="t2" style="margin-top:-8px">Te debe <b class="cifra deuda">${S(quien.saldo)}</b></p>
    ${c ? "" : `<p class="t2" style="font-size:15px;margin-top:-6px">En la app, primero eliges al cliente; aquí la maqueta trae al primero.</p>`}
    <label class="campo-monto"><span>S/</span><input data-foco id="monto" inputmode="decimal" placeholder="0.00" aria-label="Monto del abono"></label>
    <div class="medios">${[100, 500].map((m) => `<button class="filtro" data-rapido="${m}">${S(m)}</button>`).join("")}<button class="filtro" data-rapido="${quien.saldo}">Todo · ${S(quien.saldo)}</button></div>
    <div class="medios" role="group" aria-label="Cómo pagó">${["Efectivo", "Yape", "Plin"].map((m) => `<button class="filtro" data-medio-abono="${m}" aria-pressed="${m === medio}">${m}</button>`).join("")}</div>
    <p class="duda" id="queda" hidden></p>
    <button class="boton confirmar" id="ok-abono" disabled>Confirmar abono</button>`, "Registrar abono");
  const monto = document.getElementById("monto"), ok = document.getElementById("ok-abono"), queda = document.getElementById("queda");
  const leer = () => Number(monto.value.replace(",", ".")) || 0;
  const revisar = () => { const v = leer(); ok.disabled = v <= 0; queda.hidden = v <= 0; queda.innerHTML = `${icono("info")}${v > quien.saldo ? `Le quedará <b>${S(v - quien.saldo)}</b> a favor` : `Le quedará debiendo <b>${S(quien.saldo - v)}</b>`}`; };
  monto.addEventListener("input", revisar);
  hoja.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.rapido) { monto.value = Number(b.dataset.rapido).toFixed(2); revisar(); }
    if (b.dataset.medioAbono) { medio = b.dataset.medioAbono; hoja.querySelectorAll("[data-medio-abono]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }
    if (b.id === "ok-abono") { const v = leer(); guardar(b, () => mostrarSello("Abono guardado", `A ${quien.nombre} le queda ${S(Math.max(quien.saldo - v, 0))}`, () => {
      quien.saldo -= v; HOY.abonos += v; HOY.cobrado += v;
      ULTIMAS.unshift({ hora: "12:46", tipo: "abono", quien: quien.nombre, que: `Abono en ${medio.toLowerCase()}`, monto: v, estado: "abono" }); nuevaArriba = true; pintar(); })); }
  };
}

function hojaMovimiento(tipo) {
  let elegida = null, cajas = 1;
  const html = () => `<h2>${tipo === "merma" ? "¿Qué se malogró?" : "¿Qué compraste?"}</h2>
    ${tipo === "compra" ? `<div class="medios">${["Transportes Piura Norte", "Agrícola Chao"].map((p, i) => `<button class="filtro" aria-pressed="${i === 0}">${p}</button>`).join("")}</div>` : ""}
    <div class="medios">${STOCK.filter((f) => tipo === "compra" || f.cajas > 0).map((f) => `<button class="filtro" data-elegida="${STOCK.indexOf(f)}" aria-pressed="${elegida === f}">${nombreFruta(f)}</button>`).join("")}</div>
    <div class="paso" style="justify-content:center"><button data-paso="-1" aria-label="Una caja menos">−</button><span class="cifra">${cajas}</span><button data-paso="1" aria-label="Una caja más">+</button></div>
    <p class="t2" style="text-align:center;margin-top:-6px">cajas${elegida && tipo === "merma" ? ` · tienes ${elegida.cajas}` : ""}</p>
    <button class="boton confirmar" data-ok ${elegida ? "" : "disabled"}>${tipo === "merma" ? "Confirmar merma" : "Confirmar compra"}</button>`;
  abrirHoja(html(), tipo);
  hoja.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.elegida) { elegida = STOCK[+b.dataset.elegida]; }
    if (b.dataset.paso) { cajas = Math.max(1, Math.min(tipo === "merma" && elegida ? elegida.cajas : 999, cajas + +b.dataset.paso)); }
    if (b.dataset.ok !== undefined) {
      return guardar(b, () => {
        const quedan = elegida.cajas + (tipo === "merma" ? -cajas : cajas);
        sello(tipo === "merma" ? "Merma guardada" : "Compra guardada", `Quedan ${quedan} cajas de ${nombreFruta(elegida).toLowerCase()}`, () => { elegida.cajas = quedan; pintar(); });
      });
    }
    if (b.dataset.elegida || b.dataset.paso) { hoja.querySelector(".cascada").innerHTML = html(); hoja.querySelectorAll(".cascada > *").forEach((x) => (x.style.animation = "none")); }
  };
}

function hojaVenta(ref) {
  const o = typeof ref === "string" && ref.startsWith("x") ? MAS_VENTAS.flatMap((g) => g.ventas)[+ref.slice(1)] : ULTIMAS[+ref];
  if (!o) return;
  const cli = CLIENTES.find((c) => c.nombre === o.quien);
  const tipoComp = cli?.doc?.startsWith("RUC") ? "factura" : "boleta";
  const cajas = parseInt(o.que, 10) || 1;
  abrirHoja(`<h2>Venta a ${o.quien}</h2><p class="t2" style="margin-top:-8px">Hoy ${o.hora} · la registró Dueño de prueba</p>
    <div class="tarjeta" style="padding:14px"><div class="fruta-fila">${fruta(o.fruta)}<span><strong style="display:block">${o.que}</strong><span class="t2 cifra" style="font-size:15px;font-weight:600">${cajas} × ${S(o.monto / cajas)}</span></span><span class="cifra" style="font-size:20px">${S(o.monto)}</span></div></div>
    <div class="total-fila"><span class="etiqueta">Total</span><span class="cifra" ${anuladas.has(o) ? 'style="text-decoration:line-through"' : ""}>${S(o.monto)}</span></div>
    <div>${insignia(o)}</div>
    ${anuladas.has(o) ? `<p class="t2">Se anuló. El stock volvió${o.estado === "debe" ? " y la deuda bajó" : ""}.</p>` : `
    <button class="boton contorno" data-aviso="Se emite en el sandbox de Lucode: correlativo, pendiente, enviado.">${icono("recibo")}Hacer ${tipoComp}</button>
    <button class="boton peligro" data-anular>${icono("basura")}Anular venta</button>`}`, "Detalle de la venta");
  hoja.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.anular !== undefined) {
      hoja.querySelector(".cascada").innerHTML = `<h2>¿Por qué la anulas?</h2><p class="t2" style="margin-top:-8px">No se borra: queda anulada, el stock vuelve${o.estado === "debe" ? " y la deuda baja" : ""}.</p>
        <div style="display:grid;gap:8px">${["Me equivoqué de cliente", "Me equivoqué de cantidad o precio", "El cliente devolvió la fruta", "Otro motivo"].map((m) => `<button class="filtro" style="justify-content:flex-start" data-motivo>${m}</button>`).join("")}</div>
        <button class="boton peligro confirmar" data-si-anular disabled>Anular venta de ${S(o.monto)}</button>`;
    }
    if (b.dataset.motivo !== undefined) { hoja.querySelectorAll("[data-motivo]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); hoja.querySelector("[data-si-anular]").disabled = false; }
    if (b.dataset.siAnular !== undefined) guardar(b, () => mostrarSello("Venta anulada", `Volvieron ${cajas} cajas al stock`, () => { anuladas.add(o); pintar(); }));
  };
}

function hojaAMano() {
  const op = [["venta", "Venta", "recibo"], ["abono", "Abono", "mano"], ["compra", "Compra", "camion"], ["merma", "Merma", "alerta"], ["gasto", "Gasto", "billetera"]];
  abrirHoja(`<h2>¿Qué quieres registrar?</h2><div style="display:grid;gap:8px">${op.map(([k, t, i]) => `<button class="fila-menu" data-registrar="${k}"><span class="icono-caja neutro">${icono(i)}</span>${t}<span class="chev">${icono("flecha")}</span></button>`).join("")}</div>`, "Registrar a mano");
  hoja.onclick = (e) => {
    const b = e.target.closest("[data-registrar]"); if (!b) return;
    const k = b.dataset.registrar;
    k === "venta" ? tarjetaVenta(true) : k === "abono" ? hojaAbono() : k === "gasto" ? avisoMaqueta("Gasto: monto, motivo (estiba, bolsas, pasaje) y Confirmar.") : hojaMovimiento(k);
  };
}

function hojaMenu() {
  abrirHoja(`<h2>Más</h2><p class="t2" style="margin-top:-8px">Entraste como <b style="color:var(--texto)">Dueño de prueba</b> (Dueño)</p>
    <p><span class="insignia lima">Maqueta · datos de demostración</span></p>
    <div style="display:grid;gap:8px">
      <button class="fila-menu" data-ir="cierre"><span class="icono-caja positivo">${icono("cierre")}</span>Cierre del día<span class="chev">${icono("flecha")}</span></button>
      <button class="fila-menu" data-ir="ajustes"><span class="icono-caja neutro">${icono("ajustes")}</span>Ajustes<span class="chev">${icono("flecha")}</span></button>
      <button class="fila-menu" data-aviso="Te llega un aviso cada noche con el resumen del día."><span class="icono-caja bosque">${icono("campana")}</span>Aviso del día<span class="insignia positivo">Prendido</span></button>
      <button class="fila-menu" data-aviso="Así queda en tu pantalla de inicio: mira logo.html."><span class="icono-caja bosque">${icono("instalar")}</span>Instalar Fructus<span class="chev">${icono("flecha")}</span></button>
      <button class="fila-menu" data-ir="login"><span class="icono-caja deuda">${icono("salir")}</span>Salir<span></span></button></div>`, "Más opciones");
  hoja.onclick = null;
}

function avisoMaqueta(texto) {
  abrirHoja(`<div class="vacio"><span class="icono-caja bosque">${icono("info")}</span><h2 style="font-size:20px">En la maqueta</h2><p class="t2">${texto}</p></div><button class="boton" data-cerrar data-foco>Entendido</button>`, "Aviso de la maqueta");
}

// ── Toques (delegados) ──
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-ir],[data-menu],[data-abono],[data-mover],[data-venta],[data-filtro-clientes],[data-filtro-stock],[data-filtro-ventas],[data-periodo],[data-a-mano],[data-aviso],[data-cerrar],[data-recargar],[data-reenviar],[data-venta-mano]");
  if (!t) return;
  const d = t.dataset;
  if (d.ir !== undefined) { cerrarHoja(); ir(d.ir); }
  else if (d.menu !== undefined) hojaMenu();
  else if (d.abono !== undefined) hojaAbono(d.abono);
  else if (d.mover) hojaMovimiento(d.mover);
  else if (d.venta !== undefined) hojaVenta(d.venta);
  else if (d.filtroClientes) { filtroClientes = d.filtroClientes; pintar(); }
  else if (d.filtroStock) { filtroStock = d.filtroStock; pintar(); }
  else if (d.filtroVentas) { filtroVentas = d.filtroVentas; pintar(); }
  else if (d.periodo) { periodo = d.periodo === "hoy" ? "hoy" : "semana"; pintar(); }
  else if (d.aMano !== undefined) hojaAMano();
  else if (d.aviso) avisoMaqueta(d.aviso);
  else if (d.cerrar !== undefined) cerrarHoja();
  else if (d.recargar !== undefined) location.search = location.search.replace(/estado=error/, "estado=normal");
  else if (d.reenviar !== undefined) { cerrarHoja(); ponerEstado("entendiendo"); etiquetaVoz("Entendiendo…"); setTimeout(() => { ponerEstado("listo"); etiquetaVoz(""); tarjetaVenta(); }, 900); }
  else if (d.ventaMano !== undefined) tarjetaVenta(true);
});

pintar();
