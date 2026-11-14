// Fructus · maqueta del aviso de frescura («tiene que salir ya»). DATOS DE DEMOSTRACIÓN: nada toca la base ni la app real.
// Muestra lo que CAMBIA en pantallas que ya existen (Hoy, Stock, la compra, el aviso de la noche); lo demás queda como está.
// Las piezas (iconos, frutas, S/) salen de ../escritorio/datos.js; las llegadas y la regla del calor, de ./datos.js.

Object.assign(ICONOS, {
  menu: '<line x1="4" x2="20" y1="7" y2="7"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="17" y2="17"/>',
  abajo: '<path d="m6 9 6 6 6-6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  termometro: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
  bombilla: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  chispa: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  altavoz: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
  carrito: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
});
const ondas = '<span class="ondas" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
const mic = `<span class="mic">${icono("micro")}</span>`;
const ICONO_APP = "../../../public/icons/icon-192.png";

// ── Estado de la maqueta (el visor lo cambia por la URL) ──
const P = new URLSearchParams(location.search);
const ESTADO = P.get("estado") || "normal"; // normal | sin-temp | sin-ia | en-orden
const DICTA = P.get("voz") || "temp"; // temp | compra | consulta
if (P.get("marco") === "1") document.documentElement.style.setProperty("--seguro-arriba", "50px");
const temps = [...(ESTADO === "en-orden" ? SEMANA_FRESCA : SEMANA_DE_CALOR)];
const AYER = temps[HOY_I - 1];
let tempAnotada = ESTADO !== "sin-temp";
if (!tempAnotada) temps[HOY_I] = AYER; // sin la de hoy, se usa la de ayer y se dice
// En la semana fresca la papaya ya se vendió: así se ve «todo en orden».
let llegadas = LLEGADAS.filter((l) => ESTADO !== "en-orden" || l.nombre !== "Papaya").map((l) => ({ ...l }));
let ruta = location.hash.slice(1) || "hoy";

const raiz = document.getElementById("app"), velo = document.getElementById("velo"), hoja = document.getElementById("hoja");
const plural = (n, una, varias) => `${n} ${n === 1 ? una : varias}`;
const cajasTxt = (n) => plural(n, "caja", "cajas");
const minus = (s) => s[0].toLowerCase() + s.slice(1);
const enumerar = (a) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} y ${a.at(-1)}`);
const cuandoLlego = (i) => (i === HOY_I ? "hoy" : i === HOY_I - 1 ? "ayer" : `el ${SEMANA[i][0]}`);
const deCuando = (i) => (i === HOY_I ? "de hoy" : i === HOY_I - 1 ? "de ayer" : `del ${SEMANA[i][0]}`);
const hastaCuando = (i) => (i === HOY_I ? "hoy" : i === HOY_I + 1 ? "mañana" : `el ${SEMANA[i][0]} ${SEMANA[i][2]}`);
const tonoDe = (restan) => (restan === 0 ? "hoy" : restan === 1 ? "manana" : "bien");
const cortoDe = (restan) => (restan === 0 ? "Sale hoy" : restan === 1 ? "Sale mañana" : `${restan} días`);
const lotes = () => llegadas.map((l) => ({ l, i: llegadas.indexOf(l), e: estimarLlegada(l, temps) }));
const como = (l) => (l.estado ? COMO_LLEGO[l.estado][1] : "");

/** Las llegadas juntas por fruta, como la lista de Stock. `peor` es lo que le queda a la llegada más vieja. */
function productos() {
  const mapa = new Map();
  for (const x of lotes()) {
    const p = mapa.get(x.l.nombre) ?? { nombre: x.l.nombre, fruta: x.l.fruta, grupo: x.l.grupo, titulo: x.l.titulo, lotes: [] };
    p.lotes.push(x);
    mapa.set(x.l.nombre, p);
  }
  return [...mapa.values()].map((p) => ({ ...p, cajas: p.lotes.reduce((s, x) => s + x.l.cajas, 0), peor: Math.min(...p.lotes.map((x) => x.e.restan)) }));
}

/** El título de un aviso: una fruta por su nombre; varias, por cuántas son. */
function tituloAviso(grupo, urgente) {
  const nombres = [...new Set(grupo.map((x) => x.l.nombre))];
  return nombres.length === 1 ? `${nombres[0]} ${urgente ? "tiene que salir hoy" : "sale mañana"}` : `${nombres.length} frutas ${urgente ? "tienen que salir hoy" : "salen mañana"}`;
}

// ── Piezas ──
// `extra` va junto al menú (el botón de la temperatura); `subAbajo` saca el subtítulo de esa fila para que quepa a lo ancho.
function cabecera({ titulo, sub, grande = false, extra = "", subAbajo = false }) {
  const menu = `<button class="boton-menu" data-aviso="El menú sigue igual: cierre del día, ajustes y salir." aria-label="Menú">${icono("menu")}</button>`;
  return grande
    ? `<header class="cabecera"><div class="barra"><div class="marca"><img src="${ICONO_APP}" alt=""><div><strong>Fructus</strong><small>VENTA MAYORISTA DE FRUTAS</small></div></div>${menu}</div>
        <div class="titulo"><h1>${titulo}</h1><p>${sub}</p></div></header>`
    : `<header class="cabecera compacta"><div class="barra" style="align-items:${subAbajo ? "center" : "flex-start"}"><div class="titulo" style="margin-top:4px;min-width:0;flex:1"><h1>${titulo}</h1>${subAbajo ? "" : `<p>${sub}</p>`}</div>${extra}${menu}</div>
        ${subAbajo ? `<p class="sub-cabecera">${sub}</p>` : ""}</header>`;
}
const filaLote = (x, conFruta) => `<button class="lote" data-lote="${x.i}">${conFruta ? fruta(x.l.fruta) : ""}
  <span class="cuerpo"><strong>${conFruta ? x.l.nombre : `${cajasTxt(x.l.cajas)} ${deCuando(x.l.llego)}`}</strong>
  <span>${conFruta ? `${cajasTxt(x.l.cajas)} ${deCuando(x.l.llego)}${x.l.estado ? ` · ${como(x.l)}` : ""}` : x.l.estado ? `Llegaron ${como(x.l)}` : `Llegaron ${cuandoLlego(x.l.llego)}`}</span></span>
  ${conFruta ? "" : `<span class="etiqueta-dia ${tonoDe(x.e.restan)}">${cortoDe(x.e.restan)}</span>`}<span class="chev">${icono("flecha")}</span></button>`;
const consejo = (texto) => `<p class="consejo">${icono("bombilla")}<span>${texto}</span></p>`;

// ── Hoy: el aviso vive donde ya está el de inventario; solo cambia lo que dice ──
function avisoHoy() {
  const ls = lotes(), deHoy = ls.filter((x) => x.e.restan === 0), grupo = deHoy.length ? deHoy : ls.filter((x) => x.e.restan === 1);
  if (!grupo.length) return "";
  const nombres = [...new Set(grupo.map((x) => x.l.nombre))], cajas = grupo.reduce((s, x) => s + x.l.cajas, 0);
  const linea = nombres.length === 1 ? `${cajasTxt(cajas)} ${deCuando(grupo[0].l.llego)}` : `${enumerar(nombres.map((n, i) => (i ? minus(n) : n)))} · ${cajasTxt(cajas)}`;
  return `<a class="tarjeta aviso-frescura tocable subir" href="#stock" style="animation-delay:70ms"><span class="icono-caja ${deHoy.length ? "deuda" : "aviso"} punto">${icono("alerta")}</span>
    <span class="cuerpo"><strong>${tituloAviso(grupo, deHoy.length > 0)}</strong><span>${linea}</span><b>Ver qué hacer</b></span><span class="chev">${icono("flecha")}</span></a>`;
}
function hoy() {
  return cabecera({ titulo: "Hoy", sub: "sábado 14 de noviembre", grande: true }) + `<main class="contenido">
    <section class="tarjeta grande ventas-hoy subir" aria-label="Lo vendido hoy"><div class="arriba"><span class="icono-caja bosque">${icono("tendencia")}</span><div style="min-width:0"><span class="etiqueta">Vendiste hoy</span>
      <span class="cifra monto" style="display:block">${S(HOY.contado + HOY.credito)}</span></div></div>
      <p class="desglose"><b class="cifra">${S(HOY.contado)}</b> al contado y <b class="cifra">${S(HOY.credito)}</b> al crédito</p></section>
    ${avisoHoy()}
    ${tempAnotada ? "" : `<section class="tarjeta alerta subir" style="animation-delay:120ms"><span class="icono-caja aviso">${icono("termometro")}</span>
      <span class="cuerpo"><strong>¿Cuánto marca el termómetro?</strong><span>Falta la temperatura de hoy</span></span><button class="boton lima chico" data-temp>Anotar</button></section>`}
    <section class="tarjeta dinero subir" style="animation-delay:160ms"><div class="fila"><div><span class="etiqueta">Cobraste</span><span class="cifra grande positivo">${S(HOY.cobrado)}</span></div></div>
      <div class="separador"></div><div class="fila"><div><span class="etiqueta">Te deben</span><span class="cifra grande deuda">${S(TE_DEBEN)}</span><span class="pie">${DEUDORES.length} clientes</span></div></div></section>
  </main>`;
}

// ── El aviso de la noche anterior (sale con el resumen del día, como a las 7 p. m.): por eso dice «mañana» ──
function avisoNoche() {
  const ls = lotes().filter((x) => x.e.restan === 0), cajas = ls.reduce((s, x) => s + x.l.cajas, 0);
  const nota = (titulo, cuerpo, extra = "") => `<span class="cuerpo"><span class="app">Fructus · ahora</span><strong>${titulo}</strong><span>${cuerpo}</span></span>${extra}`;
  return `<div class="bloqueo"><p class="reloj cifra">7:02<small> p. m.</small></p><p class="fecha">viernes 13 de noviembre</p>
    ${ls.length ? `<a class="notificacion subir" href="#stock"><img src="${ICONO_APP}" alt="">${nota(`Mañana ${cajas === 1 ? "tiene que salir 1 caja" : `tienen que salir ${cajas} cajas`}`, `${enumerar(ls.map((x, i) => `${i ? minus(x.l.nombre) : x.l.nombre} (${x.l.cajas})`))}. Hoy hizo ${AYER}°.`)}</a>` : ""}
    <div class="notificacion vieja"><img src="${ICONO_APP}" alt="">${nota(`Vendiste ${S(HOY.contado + HOY.credito)} hoy`, `${HOY.ventas} ventas, ${HOY.cajas} cajas · Cobraste ${S(HOY.cobrado)}`)}</div>
    <p class="pista">${ls.length ? "Toca el aviso de arriba para ver qué hacer" : "Sin fruta por salir no llega aviso de frescura: solo el resumen de siempre."}</p></div>`;
}

const destinos = [["hoy", "Hoy", "casa"], ["clientes", "Clientes", "clientes"], null, ["stock", "Stock", "stock"], ["ventas", "Ventas", "ventas"]];
// Como en la app: el micrófono vive en «Hoy»; en Stock flotan «Compra» y «Merma» sobre la barra, al alcance del pulgar.
const nav = () => { const enStock = ruta === "stock";
  return `${enStock ? `<div class="flotante"><button class="boton" data-compra>${icono("camion")}Compra</button><button class="boton" data-aviso="Merma: eliges la fruta y cuántas cajas, igual que hoy.">${icono("alerta")}Merma</button></div>` : ""}
  <nav class="nav ${enStock ? "cuatro" : ""}" aria-label="Principal">${destinos.filter((d) => d || !enStock).map((d) => d === null
  ? `<button class="orbe" data-voz data-estado="listo" aria-label="Toca o mantén para hablar">${mic}${ondas}<span class="halo"></span></button>`
  : d[0] === "hoy" || d[0] === "stock" ? `<a href="#${d[0]}" ${ruta === d[0] ? 'aria-current="page"' : ""}>${icono(d[2])}${d[1]}</a>` : `<a href="#${ruta}" data-aviso="${d[1]} no cambia con esta propuesta.">${icono(d[2])}${d[1]}</a>`).join("")}</nav>
  <p class="etiqueta-voz" id="etiqueta-voz" role="status" aria-live="polite" hidden></p>`; };

function pintar() {
  raiz.innerHTML = ruta === "aviso" ? avisoNoche() : (ruta === "stock" ? stock() : hoy()) + nav();
}
addEventListener("hashchange", () => { ruta = location.hash.slice(1) || "hoy"; cerrarHoja(); pintar(); scrollTo(0, 0); });

// ── Hoja (sube desde abajo), sello y guardado ──
function abrirHoja(html, etiqueta) {
  hoja.onclick = null;
  hoja.innerHTML = `<div class="asa"></div><div class="cascada" style="display:grid;gap:12px">${html}</div>`;
  hoja.setAttribute("aria-label", etiqueta); velo.classList.add("abierto"); hoja.classList.add("abierta"); hoja.scrollTop = 0;
}
function cerrarHoja() { velo.classList.remove("abierto"); hoja.classList.remove("abierta"); }
const repintarHoja = (html) => { hoja.querySelector(".cascada").innerHTML = html; hoja.querySelectorAll(".cascada > *").forEach((x) => (x.style.animation = "none")); };
velo.addEventListener("click", cerrarHoja);
addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarHoja(); });
const vibrar = () => navigator.vibrate?.(30);
function mostrarSello(titulo, frase, despues) {
  vibrar();
  hoja.querySelector(".cascada").innerHTML = `<div class="sello" role="status"><span class="circulo">${icono("check")}</span><strong>${titulo}</strong><span class="t2">${frase}</span></div>`;
  setTimeout(() => { cerrarHoja(); despues?.(); }, 1700);
}
// Nada optimista: el sello sale cuando «la base respondió» (aquí, 600 ms).
function guardar(boton, alTerminar) { boton.disabled = true; boton.textContent = "Guardando…"; setTimeout(alTerminar, 600); }
function avisoMaqueta(texto) {
  abrirHoja(`<div class="vacio"><span class="icono-caja bosque">${icono("info")}</span><h2 style="font-size:20px">En la maqueta</h2><p class="t2">${texto}</p></div><button class="boton" data-cerrar>Entendido</button>`, "Aviso de la maqueta");
}

// ── ¿Por qué sale hoy? La explicación, a un toque: qué parte de su vida gastó cada día ──
function hojaPorQue(i) {
  const l = llegadas[i]; if (!l) return;
  const e = estimarLlegada(l, temps), tono = tonoDe(e.restan), queda = 1 - e.dias.reduce((s, d) => s + d.g, 0);
  const tonoDia = (t) => (t >= 30 ? "fuerte" : t >= 27 ? "calor" : "fresco");
  const titulo = e.restan === 0 ? "Tiene que salir hoy" : e.restan === 1 ? "Sale mañana" : `Le quedan ${e.restan} días`;
  const sub = e.restan === 0 ? "Hoy es su último día bueno." : e.restan === 1 ? "Mañana es su último día bueno." : `Aguanta hasta ${hastaCuando(e.fin)}.`;
  abrirHoja(`<div class="cab-lote">${fruta(l.fruta)}<span><h2>${l.nombre}</h2><span class="t2">${cajasTxt(l.cajas)} · llegaron ${cuandoLlego(l.llego)}${l.estado ? `, ${como(l)}` : ""}</span></span></div>
    <p class="veredicto ${tono}">${icono(tono === "bien" ? "check" : "alerta")}<span><b>${titulo}</b>${sub}</span></p>
    <section class="tarjeta vida"><h3>Lo que gastó cada día</h3>
      <div class="vida-barra" aria-hidden="true">${e.dias.map((d) => `<span class="tramo ${tonoDia(d.t)}" style="flex-grow:${d.g}"></span>`).join("")}${queda > 0.02 ? `<span class="tramo" style="flex-grow:${queda}"></span>` : ""}</div>
      <div class="vida-dias">${e.dias.map((d) => `<span style="flex-grow:${d.g}"><b>${d.t}°</b><small>${d.d === HOY_I ? "hoy" : SEMANA[d.d][1]}</small></span>`).join("")}${queda > 0.02 ? `<span style="flex-grow:${queda}"><b>&nbsp;</b><small>le queda</small></span>` : ""}</div>
      <p>${e.perdidos > 0 ? `A ${T_NORMAL}° aguantaba hasta ${hastaCuando(e.finNormal)}. <b>El calor le quitó ${plural(e.perdidos, "día", "días")}.</b>` : `Con este clima aguanta lo de siempre: hasta ${hastaCuando(e.fin)}.`}</p></section>
    ${e.restan <= 1 ? consejo(e.restan === 0 ? "Véndelo hoy, antes que lo nuevo. Si no sale, ofrécelo con rebaja." : "Ponlo adelante y véndelo primero.") : ""}
    <div class="calibrar"><p class="etiqueta">¿Cómo la ves?</p><div class="${e.restan <= 1 ? "dos" : ""}"><button class="boton contorno" data-malogro>Se malogró</button>${e.restan <= 1 ? `<button class="boton contorno" data-buena>Sigue buena</button>` : ""}</div></div>
    <p class="duda">${icono("chispa")}<span>Es un cálculo aproximado, hecho con IA. Lo que marques aquí lo afina para la próxima.</span></p>`, `Por qué ${minus(titulo)}`);
  hoja.onclick = (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    if (b.dataset.malogro !== undefined) hojaMerma(i);
    if (b.dataset.buena !== undefined) guardar(b, () => mostrarSello("Anotado", `A ${minus(l.nombre)} ${deCuando(l.llego)} le doy un día más`, () => {
      while (estimarLlegada(l, temps).restan <= e.restan) l.vida += 0.5;
      pintar();
    }));
  };
}

function hojaMerma(i) {
  const l = llegadas[i]; if (!l) return;
  let n = l.cajas;
  const total = llegadas.filter((x) => x.nombre === l.nombre).reduce((s, x) => s + x.cajas, 0);
  const html = () => `<h2>¿Cuántas se malograron?</h2><p class="t2" style="margin-top:-8px">${l.nombre} · ${cajasTxt(l.cajas)} ${deCuando(l.llego)}</p>
    <div class="paso" style="justify-content:center"><button data-paso="-1" aria-label="Una caja menos">−</button><span class="cifra">${n}</span><button data-paso="1" aria-label="Una caja más">+</button></div>
    <p class="t2" style="text-align:center;margin-top:-6px">${n === 1 ? "caja" : "cajas"}</p>
    <p class="duda">${icono("chispa")}<span>Con esta merma, el cálculo de ${minus(l.nombre)} se acorta para la próxima.</span></p>
    <button class="boton confirmar" data-ok>Confirmar merma</button>`;
  abrirHoja(html(), "Registrar merma");
  hoja.onclick = (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    if (b.dataset.paso) { n = Math.max(1, Math.min(l.cajas, n + +b.dataset.paso)); repintarHoja(html()); }
    if (b.dataset.ok !== undefined) guardar(b, () => mostrarSello("Merma guardada", `Quedan ${cajasTxt(total - n)} de ${minus(l.nombre)}`, () => {
      l.cajas -= n; if (l.cajas <= 0) llegadas = llegadas.filter((x) => x !== l);
      pintar();
    }));
  };
}

// ── La temperatura: dictada («hoy hizo 29 grados») o a mano. Una cifra, dos botones grandes y Confirmar ──
function hojaTemp(deVoz, dictada) {
  let t = dictada ?? temps[HOY_I];
  const html = () => `<div class="cab-voz"><span class="insignia lima">Temperatura</span><span class="t2">${deVoz ? "Esto entendí" : "Anótala a mano"}</span></div>
    <h2>${deVoz ? "En el puesto hoy hace" : "¿Cuánto marca el termómetro?"}</h2>
    <div class="paso paso-temp"><button data-paso="-1" aria-label="Un grado menos">−</button><span class="cifra">${t}°</span><button data-paso="1" aria-label="Un grado más">+</button></div>
    <p class="duda">${icono("info")}<span>Ayer anotaste ${AYER}°.${Math.abs(t - AYER) >= 6 ? " <b>Es mucha diferencia:</b> mira otra vez el termómetro." : ""}</span></p>
    ${deVoz ? "" : `<section class="tarjeta semana-temp"><h3>Esta semana</h3>${barrasTemp(t, true)}</section>`}
    <button class="boton confirmar" data-ok>Confirmar</button><button class="boton contorno chico" data-cerrar style="justify-self:center">Cancelar</button>`;
  abrirHoja(html(), "Temperatura de hoy");
  hoja.onclick = (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    if (b.dataset.paso) { t = Math.max(5, Math.min(45, t + +b.dataset.paso)); repintarHoja(html()); }
    if (b.dataset.ok !== undefined) guardar(b, () => {
      temps[HOY_I] = t; tempAnotada = true;
      const n = productos().filter((p) => p.peor === 0).length;
      mostrarSello("Anotado", `Hoy hace ${t}°. ${n ? `${n === 1 ? "1 fruta tiene" : `${n} frutas tienen`} que salir hoy.` : "Nada tiene que salir hoy."}`, pintar);
    });
  };
}

// ── La compra: un dato nuevo, «¿Cómo llegó?», y al toque cuánto va a aguantar ──
function tarjetaCompra(deVoz) {
  const c = { nombre: "Mango Kent", fruta: "Mango", grupo: "Mango", titulo: "Kent", cajas: 30, costo: 32, estado: deVoz ? "verde" : null, cond: null };
  const html = () => {
    const estado = c.estado ?? "pinton", e = estimarLlegada({ llego: HOY_I, vida: vidaDe(c.nombre, estado) }, temps);
    return `<div class="cab-voz"><span class="insignia lima">Compra</span><span class="t2">${deVoz ? "Esto entendí" : "Registrar a mano"}</span></div>
    <div class="entendido"><div class="dato"><span class="icono-caja neutro">${icono("camion")}</span><span><span class="q">Proveedor</span><span class="v">Agrícola Chao</span></span></div>
      <div class="dato">${fruta(c.fruta)}<span><span class="q">Fruta</span><span class="v">${c.nombre}</span></span></div>
      <div class="dos" style="gap:8px"><div class="dato" style="justify-content:space-between;padding-right:8px"><span><span class="q">Cajas</span><span class="v cifra">${c.cajas}</span></span>
        <span style="display:flex;gap:4px"><button class="redondo" style="width:48px;height:48px" data-cajas="-1" aria-label="Una caja menos">−</button><button class="redondo" style="width:48px;height:48px" data-cajas="1" aria-label="Una caja más">+</button></span></div>
        <div class="dato"><span><span class="q">Costo de la caja</span><span class="v cifra">${S(c.costo)}</span></span></div></div></div>
    <div class="como-llego"><p class="etiqueta">¿Cómo llegó? <span class="insignia lima">Nuevo</span></p>
      <div class="segmento tres" role="group" aria-label="Cómo llegó la fruta">${Object.entries(COMO_LLEGO).map(([k, [t]]) => `<button data-estado="${k}" aria-pressed="${c.estado === k}">${t}</button>`).join("")}</div>
      <p class="duda">${icono("chispa")}<span>${c.estado ? "" : deVoz ? "No lo dijiste: calculo como pintón. " : "Si no eliges, calculo como pintón. "}Con este calor aguanta <b>${plural(e.restan + 1, "día", "días")}</b>, hasta ${hastaCuando(e.fin)}.</span></p></div>
    <div class="total-fila"><span class="etiqueta">Total</span><span class="cifra">${S(c.cajas * c.costo)}</span></div>
    <div><p class="etiqueta" style="margin:0 0 6px 4px">¿La pagaste o la debes?</p>
      <div class="pildora" data-valor="${c.cond ?? ""}"><span class="fondo"></span><button data-v="pago" aria-pressed="${c.cond === "pago"}">Pagué</button><button data-v="debe" aria-pressed="${c.cond === "debe"}">La debo</button></div></div>
    <button class="boton confirmar" data-ok ${c.cond ? "" : "disabled"}>Confirmar</button>`;
  };
  abrirHoja(html(), "Confirmar compra");
  hoja.onclick = (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    if (b.dataset.cajas) { c.cajas = Math.max(1, c.cajas + +b.dataset.cajas); repintarHoja(html()); }
    if (b.dataset.estado) { c.estado = b.dataset.estado; repintarHoja(html()); }
    if (b.dataset.v) { c.cond = b.dataset.v; repintarHoja(html()); }
    if (b.dataset.ok !== undefined) guardar(b, () => {
      const nueva = { fruta: c.fruta, grupo: c.grupo, titulo: c.titulo, nombre: c.nombre, cajas: c.cajas, llego: HOY_I, estado: c.estado ?? "pinton", vida: vidaDe(c.nombre, c.estado ?? "pinton") };
      mostrarSello("Compra guardada", `${cajasTxt(c.cajas)} de ${minus(c.nombre)}: aguantan hasta ${hastaCuando(estimarLlegada(nueva, temps).fin)}`, () => { llegadas.splice(2, 0, nueva); pintar(); });
    });
  };
}

// ── La consulta: «¿qué tiene que salir hoy?» ──
function tarjetaConsulta() {
  const ls = lotes(), deHoy = ls.filter((x) => x.e.restan === 0), deManana = ls.filter((x) => x.e.restan === 1);
  const cajas = deHoy.reduce((s, x) => s + x.l.cajas, 0), suma = (g) => enumerar(g.map((x) => `${x.l.cajas} de ${minus(x.l.nombre)}`));
  const dicho = `${deHoy.length ? `Hoy ${cajas === 1 ? "tiene que salir 1 caja" : `tienen que salir ${cajas} cajas`}: ${suma(deHoy)}.` : "Hoy no tiene que salir nada."}${deManana.length ? ` Mañana, ${suma(deManana)}.` : ""}`;
  abrirHoja(`<div class="cab-lote"><span class="icono-caja bosque">${icono("chispa")}</span><h2>Qué tiene que salir</h2></div>
    <div><p class="t2">${deHoy.length ? "Hoy tienen que salir" : "Hoy no tiene que salir"}</p><p class="cifra respuesta">${deHoy.length ? cajasTxt(cajas) : "nada"}</p></div>
    ${deHoy.length ? `<div class="lotes">${deHoy.map((x) => `<div class="lote">${fruta(x.l.fruta)}<span class="cuerpo"><strong>${x.l.nombre}</strong><span>${cajasTxt(x.l.cajas)} ${deCuando(x.l.llego)}</span></span></div>`).join("")}</div>` : ""}
    ${deManana.length ? `<p><b>Mañana:</b> ${suma(deManana)}.</p>` : ""}
    <a class="enlace-fila" href="#stock" data-cerrar>Ver todo el stock ${icono("flecha")}</a>
    <div class="dos"><button class="boton contorno" data-escuchar>${icono("altavoz")}Escuchar</button><button class="boton" data-cerrar>Listo</button></div>`, "Qué tiene que salir hoy");
  hoja.onclick = (ev) => {
    if (!ev.target.closest("[data-escuchar]") || !("speechSynthesis" in window)) return;
    const voz = new SpeechSynthesisUtterance(dicho); voz.lang = "es-US"; speechSynthesis.cancel(); speechSynthesis.speak(voz);
  };
}

// ── La voz: mantener y soltar, o un toque para dejarla escuchando y otro para enviar (ADR-0018) ──
let escuchando = false, fija = false, inicio = 0;
const etiquetaVoz = (t) => { const e = document.getElementById("etiqueta-voz"); if (!e) return; e.textContent = t; e.hidden = !t; };
const ponerEstado = (e) => document.querySelectorAll("[data-voz]").forEach((o) => (o.dataset.estado = e));
function empezar() { if (hoja.classList.contains("abierta")) return; escuchando = true; fija = false; inicio = Date.now(); vibrar(); ponerEstado("escuchando"); etiquetaVoz("Te escucho… suelta para enviar"); }
function enviar() {
  escuchando = false; fija = false; ponerEstado("entendiendo"); etiquetaVoz("Entendiendo…");
  setTimeout(() => { ponerEstado("listo"); etiquetaVoz(""); DICTA === "compra" ? tarjetaCompra(true) : DICTA === "consulta" ? tarjetaConsulta() : hojaTemp(true, 29); }, 900);
}
function soltar() {
  if (!escuchando || fija) return;
  if (Date.now() - inicio < 350) { fija = true; etiquetaVoz("Te escucho… toca otra vez para enviar"); return; }
  enviar();
}
document.addEventListener("pointerdown", (e) => { if (!e.target.closest("[data-voz]")) return; e.preventDefault(); fija ? enviar() : empezar(); });
document.addEventListener("pointerup", soltar);
document.addEventListener("pointercancel", soltar);
document.addEventListener("contextmenu", (e) => { if (e.target.closest("[data-voz]")) e.preventDefault(); });

// ── Toques (delegados). Dentro de una hoja manda la hoja: aquí solo se cierra ──
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-lote],[data-merma],[data-temp],[data-compra],[data-aviso],[data-cerrar],[data-pestana]");
  if (!t) return;
  const d = t.dataset;
  if (d.cerrar !== undefined) return cerrarHoja();
  if (hoja.contains(t)) return;
  if (d.aviso) { e.preventDefault(); avisoMaqueta(d.aviso); }
  else if (d.pestana) { pestana = d.pestana; pintar(); }
  else if (d.lote !== undefined) hojaPorQue(+d.lote);
  else if (d.merma !== undefined) hojaMerma(+d.merma);
  else if (d.temp !== undefined) hojaTemp(false);
  else if (d.compra !== undefined) tarjetaCompra(false);
});

pintar();
// Para capturas y para el visor: ?abrir=lote-0 | merma-0 | temp | compra | consulta abre esa hoja al cargar.
const [abrir, cual] = (P.get("abrir") || "").split("-");
if (abrir === "lote") hojaPorQue(+cual); else if (abrir === "merma") hojaMerma(+cual); else if (abrir === "temp") hojaTemp(DICTA === "temp" && P.has("dictada"), P.has("dictada") ? +P.get("dictada") : undefined);
else if (abrir === "compra") tarjetaCompra(P.has("dictada")); else if (abrir === "consulta") tarjetaConsulta();
