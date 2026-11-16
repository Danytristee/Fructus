// Fructus · maqueta de frescura: tres maneras de ordenar Stock. Solo funciones: usan las piezas de app.js cuando se las llama.
//
// El problema (quien dirige el proyecto, 2026-11-14): lo principal, qué tiene que salir hoy, quedaba abajo; primero salían el anillo,
// los tres recuadros, la temperatura y «Compra», todo acumulado. En las tres propuestas:
//   · lo que tiene que salir hoy es lo primero que se ve;
//   · «Compra» y «Merma» flotan abajo, sobre la barra, como en la app (components/ui/BarraFlotante.tsx);
//   · el anillo y los tres recuadros se van: decían con cuatro piezas lo que ahora dice una.
// Cambia DÓNDE vive cada cosa:
//   A · «Lo urgente arriba»: una sola página. La temperatura es un botón chico en la cabecera; los totales, el subtítulo.
//   B · «Dos pestañas»: «Qué hacer» (avisos y clima) y «Tu stock» (totales y lista), cada una con lo suyo.
//   C · «En orden de salida»: una sola lista por día (hoy, mañana, en 3 días…). La temperatura va en el renglón de «Hoy».
// ELEGIDA: la B (2026-11-14). A y C quedan para ver por qué se descartaron: la A es la página más larga y la C parte una fruta con
// dos llegadas en dos días distintos.

const ORDEN = new URLSearchParams(location.search).get("orden") || "b"; // b (elegida) | a | c
let pestana = "hacer"; // solo en B: hacer | stock

// ── Piezas que comparten ──
const cajasDe = (grupo) => grupo.reduce((s, x) => s + x.l.cajas, 0);
const totales = (ps) => ({ cajas: ps.reduce((s, p) => s + p.cajas, 0), valor: ps.reduce((s, p) => s + p.cajas * PRODUCTOS[p.nombre][0], 0) });
const consejoHoy = (grupo) => consejo(new Set(grupo.map((x) => x.l.nombre)).size > 1 ? "Véndelas hoy, antes que lo nuevo. Si no salen, ofrécelas con rebaja." : "Véndelo hoy, antes que lo nuevo. Si no sale, ofrécelo con rebaja.");
const otrosAvisos = () => `<button class="boton contorno ancho" data-aviso="Reponer y Te sobra siguen igual que hoy: este cambio solo toca lo que está por malograrse.">Ver 2 avisos más ${icono("abajo")}</button>`;
const notaSinIa = () => (ESTADO === "sin-ia" ? `<p class="duda nota-ia">${icono("info")}<span>Hoy no pude afinar el cálculo. Sigo con el último: revisa la fruta a ojo.</span></p>` : "");
const pedirTemp = () => `<section class="tarjeta alerta subir"><span class="icono-caja aviso">${icono("termometro")}</span>
  <span class="cuerpo"><strong>¿Cuánto marca el termómetro?</strong><span>Falta la de hoy: uso la de ayer (${AYER}°)</span></span><button class="boton lima chico" data-temp>Anotar</button></section>`;

/** La temperatura de la semana, en barras. `deHoy` deja ver un valor que todavía no se confirmó (la hoja de corregir). */
function barrasTemp(deHoy = temps[HOY_I], anotada = tempAnotada) {
  const col = (v, i) => { const t = i === HOY_I ? deHoy : v, falta = i === HOY_I && !anotada;
    return `<span class="col ${t >= 30 ? "fuerte" : t >= 27 ? "calor" : "fresco"} ${i === HOY_I ? "es-hoy" : ""} ${falta ? "falta" : ""}"><b>${falta ? "?" : t + "°"}</b><i class="palo" style="height:${Math.max(10, 14 + (t - 20) * 4)}px"></i><small>${i === HOY_I ? "hoy" : SEMANA[i][1]}</small></span>`; };
  return `<div class="barras-temp" role="img" aria-label="Temperatura de los últimos días: ${temps.map((v, i) => `${SEMANA[i][0]} ${i === HOY_I ? deHoy : v} grados`).join(", ")}">${temps.map(col).join("")}</div>`;
}
/** La temperatura de hoy en un botón chico: sobre la cabecera verde (A) o sobre el marfil (C). Sin anotar, se pone lima y la pide. */
const chipTemp = (claro) => `<button class="chip-temp ${claro ? "claro" : ""} ${tempAnotada ? "" : "falta"}" data-temp aria-label="${tempAnotada ? `Hoy hace ${temps[HOY_I]} grados en el puesto. Corregir` : "Anotar la temperatura de hoy"}">${icono("termometro")}${tempAnotada ? temps[HOY_I] + "°" : "Anotar"}</button>`;

/** El clima del puesto en una tarjeta completa (B): la cifra, el veredicto y la semana. */
function clima() {
  const t = temps[HOY_I], calor = t >= 30 ? ["Calor fuerte", "la fruta dura bastante menos."] : t >= 27 ? ["Hace calor", "la fruta dura menos."] : t >= 22 ? ["Clima normal", "la fruta aguanta lo de siempre."] : ["Está fresco", "la fruta aguanta más."];
  return `<section class="tarjeta clima subir" aria-label="La temperatura del puesto">
    <div class="clima-cab"><span class="icono-caja aviso">${icono("termometro")}</span><span><span class="etiqueta">En el puesto hoy</span><span class="cifra ${tempAnotada ? "" : "sin"}">${tempAnotada ? t + "°" : "Sin anotar"}</span></span>
      <button class="boton ${tempAnotada ? "contorno" : "lima"} chico" data-temp>${tempAnotada ? "Corregir" : "Anotar"}</button></div>
    <p class="clima-veredicto">${tempAnotada ? `<b>${calor[0]}:</b> ${calor[1]}` : `Mientras tanto uso la de ayer (<b>${AYER}°</b>).`}</p>${barrasTemp()}${notaSinIa()}</section>`;
}
/** Un aviso como los de hoy en la app: qué pasa, las llegadas y qué hacer (B). */
function tarjetaAviso(grupo, urgente, n) {
  return `<li class="tarjeta alerta-stock subir" style="animation-delay:${60 + n * 50}ms"><div class="cab"><span class="icono-redondo ${urgente ? "deuda" : "aviso"}">${icono("alerta")}</span>
    <strong>${tituloAviso(grupo, urgente)}</strong><span class="etiqueta-dia ${urgente ? "hoy" : "manana"}">${urgente ? "Hoy" : "Mañana"}</span></div>
    <div class="lotes">${grupo.map((x) => filaLote(x, true)).join("")}</div>
    ${urgente ? consejoHoy(grupo) : consejo(new Set(grupo.map((x) => x.l.nombre)).size > 1 ? "Ponlas adelante y véndelas primero." : "Ponlo adelante y véndelo primero.")}</li>`;
}
/** Una fruta en «Tu stock»: la barra con su frase y, al tocarla, cada llegada. */
function filaProducto(p) {
  const viejo = p.lotes.reduce((a, b) => (b.e.restan < a.e.restan ? b : a)), tono = tonoDe(p.peor), [, diarias] = PRODUCTOS[p.nombre];
  const frase = p.lotes.length === 1 ? (p.peor > 1 ? `Le quedan ${p.peor} días` : cortoDe(p.peor))
    : p.lotes.map((x) => `${x.l.cajas} ${x.e.restan === 0 ? (x.l.cajas === 1 ? "sale hoy" : "salen hoy") : x.e.restan === 1 ? (x.l.cajas === 1 ? "sale mañana" : "salen mañana") : `aguantan ${x.e.restan} días`}`).join(" · ");
  return `<details class="fila-stock"><summary>${fruta(p.fruta)}<span class="cuerpo"><strong>${p.titulo}</strong>
      <span class="barra-frescura" aria-hidden="true"><i class="${tono}" style="width:${Math.max(6, Math.round((1 - viejo.e.gastado) * 100))}%"></i></span><span class="frase ${tono}">${frase}</span></span>
      <span class="der"><span class="cifra">${p.cajas}</span><span>${p.cajas === 1 ? "caja" : "cajas"}</span></span><span class="chev">${icono("abajo")}</span></summary>
    <div class="detalle"><div class="lotes">${p.lotes.map((x) => filaLote(x, false)).join("")}</div>
      <dl class="datos"><div><dt>Alcanza para</dt><dd>${Math.round((p.cajas / diarias) * 10) / 10} días</dd></div><div><dt>Vendes al día</dt><dd>${diarias} cajas</dd></div></dl>
      <button class="boton contorno chico" data-merma="${viejo.i}">${icono("alerta")}Se malogró</button></div></details>`;
}
const listaStock = (ps) => [...new Set(ps.map((p) => p.grupo))].map((g) => { const lista = ps.filter((p) => p.grupo === g);
  return `<section><h3 class="grupo-fruta"><span>${g}</span><span class="cifra">${cajasTxt(lista.reduce((s, p) => s + p.cajas, 0))}</span></h3><div class="tarjeta lista-stock">${lista.map(filaProducto).join("")}</div></section>`; }).join("");

// ── A · Lo urgente arriba: una sola página, y lo de hoy es la tarjeta grande ──
function stockA() {
  const ps = productos(), ls = lotes(), deHoy = ls.filter((x) => x.e.restan === 0), deManana = ls.filter((x) => x.e.restan === 1), { cajas, valor } = totales(ps);
  const cab = (tono, ic, titulo, cifra = "") => `<div class="salida-cab"><span class="icono-redondo ${tono}">${icono(ic)}</span><h2>${titulo}</h2>${cifra}</div>`;
  return cabecera({ titulo: "Stock", sub: `${cajasTxt(cajas)} · valen unos ${S(valor)}`, extra: chipTemp(false), subAbajo: true }) + `<main class="contenido con-flotante">
    ${deHoy.length ? `<section class="tarjeta grande salida subir" aria-label="Lo que tiene que salir hoy">${cab("deuda", "alerta", "Tiene que salir hoy")}
        <p class="cifra salida-cifra deuda">${cajasTxt(cajasDe(deHoy))}</p><div class="lotes">${deHoy.map((x) => filaLote(x, true)).join("")}</div>${consejoHoy(deHoy)}</section>`
      : `<section class="tarjeta grande salida subir">${cab("positivo", "check", "Hoy no tiene que salir nada")}<p class="t2">${deManana.length ? "Lo de mañana está aquí abajo." : `Lo primero sale ${hastaCuando(Math.min(...ls.map((x) => x.e.fin)))}.`}</p></section>`}
    ${notaSinIa()}
    ${deManana.length ? `<section class="tarjeta salida subir" style="animation-delay:70ms" aria-label="Lo que sale mañana">${cab("aviso", "alerta", "Sale mañana", `<span class="cifra">${cajasTxt(cajasDe(deManana))}</span>`)}
      <div class="lotes">${deManana.map((x) => filaLote(x, true)).join("")}</div></section>` : ""}
    ${otrosAvisos()}
    <div class="seccion"><h2>Tu stock</h2></div>${listaStock(ps)}
  </main>`;
}

// ── B · Dos pestañas: «Qué hacer» y «Tu stock», cada una con lo suyo ──
function stockB() {
  const ps = productos(), ls = lotes(), deHoy = ls.filter((x) => x.e.restan === 0), deManana = ls.filter((x) => x.e.restan === 1), { cajas, valor } = totales(ps);
  const porSalir = ps.filter((p) => p.peor <= 1).length;
  const boton = (k, t, n) => `<button role="tab" data-pestana="${k}" aria-selected="${pestana === k}" aria-pressed="${pestana === k}">${t}${n ? `<b>${n}</b>` : ""}</button>`;
  // Si falta la temperatura, se pide DESPUÉS de los avisos: lo que tiene que salir sigue siendo lo primero.
  const hacer = `${deHoy.length + deManana.length ? `<ul class="avisos">${deHoy.length ? tarjetaAviso(deHoy, true, 0) : ""}${deManana.length ? tarjetaAviso(deManana, false, 1) : ""}</ul>`
      : `<div class="tarjeta vacio subir"><span class="icono-caja positivo">${icono("check")}</span><h3>Todo en orden</h3><p class="t2">Ninguna fruta tiene que salir hoy ni mañana.</p></div>`}
    ${tempAnotada ? "" : pedirTemp()}${otrosAvisos()}<div class="seccion"><h2>El clima del puesto</h2></div>${clima()}`;
  const tuStock = `<section class="tarjeta resumen-llano subir"><span class="etiqueta">Tienes en el puesto</span><span class="cifra">${cajasTxt(cajas)}</span><span class="t2">valen unos <b class="cifra">${S(valor)}</b></span></section>${listaStock(ps)}`;
  return cabecera({ titulo: "Stock", sub: "Qué hacer hoy y lo que tienes" }) + `<main class="contenido con-flotante">
    <div class="segmento pestanas" role="tablist" aria-label="Qué ver">${boton("hacer", "Qué hacer", porSalir)}${boton("stock", "Tu stock")}</div>${pestana === "hacer" ? hacer : tuStock}</main>`;
}

// ── C · En orden de salida: una sola lista, por el día en que sale cada llegada ──
function stockC() {
  const ps = productos(), ls = lotes().sort((a, b) => a.e.restan - b.e.restan || a.l.llego - b.l.llego), { cajas, valor } = totales(ps);
  const fila = (x) => `<button class="lote" data-lote="${x.i}">${fruta(x.l.fruta)}<span class="cuerpo"><strong>${x.l.nombre}</strong><span>${deCuando(x.l.llego)}${x.l.estado ? ` · ${como(x.l)}` : ""}</span></span>
    <span class="der-cajas"><b class="cifra">${x.l.cajas}</b><small>${x.l.cajas === 1 ? "caja" : "cajas"}</small></span><span class="chev">${icono("flecha")}</span></button>`;
  const renglon = (r, texto) => `<div class="dia-salida"><span class="etiqueta-dia ${tonoDe(r)}">${r === 0 ? "Hoy" : r === 1 ? "Mañana" : `En ${r} días`}</span><span class="cuando">${texto}</span>${r === 0 ? chipTemp(true) : ""}</div>`;
  const bloque = (r, n) => { const g = ls.filter((x) => x.e.restan === r), d = SEMANA[HOY_I + r];
    // Hoy va en tarjeta (es lo principal y sube sobre la cabecera); los demás días, sueltos y más livianos.
    return `<section class="${r === 0 ? "tarjeta grande" : ""} salida-dia subir" style="animation-delay:${n * 50}ms">${renglon(r, `${d[0]} ${d[2]} · ${cajasTxt(cajasDe(g))}`)}<div class="lotes ${r === 0 ? "" : "suelta"}">${g.map(fila).join("")}</div>${r === 0 ? consejoHoy(g) + notaSinIa() : ""}</section>`; };
  const dias = [...new Set(ls.map((x) => x.e.restan))];
  return cabecera({ titulo: "Stock", sub: "Ordenado por lo que sale primero" }) + `<main class="contenido con-flotante">
    ${dias.includes(0) ? "" : `<section class="tarjeta salida-dia subir">${renglon(0, "sábado 14 · no sale nada")}${notaSinIa()}</section>`}
    ${dias.map(bloque).join("")}
    <p class="total-stock">En total tienes <b class="cifra">${cajasTxt(cajas)}</b>, que valen unos <b class="cifra">${S(valor)}</b>.</p>${otrosAvisos()}
  </main>`;
}

function stock() { return ORDEN === "a" ? stockA() : ORDEN === "c" ? stockC() : stockB(); }
