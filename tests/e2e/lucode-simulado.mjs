// Un Lucode de mentira para las pruebas e2e (A9). La app le habla como al proveedor de verdad, pero este servidor vive en esta
// máquina, no cobra ni toca SUNAT, y deja que la prueba vea qué le llegó (GET /recibidos): así se prueba «el proveedor lo recibió
// UNA sola vez», no solo lo que muestra la pantalla.
//
//   POST /comprobantes        emitir (Authorization: Bearer …). Un número que ya tiene responde 409, como el proveedor de verdad.
//   GET  /comprobantes/{n}    cómo quedó un número (404 si no lo conoce).
//   POST /sunat               { numero }: SUNAT contestó, lo «enviado» pasa a «aceptado».
//   GET  /recibidos           todos los pedidos que llegaron, uno por intento.
//   GET  /consultas           los números por los que se preguntó (GET /comprobantes/{n}), uno por pregunta.
//   GET  /pdf/{n}, /xml/{n}   el PDF (mínimo, pero abre) y el XML de un comprobante aceptado.
//
// CÓMO SE PORTA depende de la venta, no de un interruptor global (las pruebas de 412 y de 360 px corren a la vez): lo dice una marca
// en el nombre del cliente, «[lucode:modo=rechazado;demora=3000]».
//   modo: aceptado (por defecto) | rechazado | enviado | caido (503) | invalido (200 con basura) | token (401)
//   motivo: «largo» hace que un rechazo traiga un motivo de unas 200 letras, como los de SUNAT (la hoja tiene que seguir cabiendo).
//   demora: milisegundos que tarda en contestar (se guarda el comprobante al llegar el pedido, como el proveedor de verdad: así se
//           prueba la respuesta que se pierde porque la app ya no esperó).
// La forma de la respuesta es nuestra suposición del contrato hasta probar contra el sandbox real (A9.6).
import { createServer } from "node:http";

const puerto = Number(process.env.PUERTO_LUCODE ?? 3200);
const TOKEN = "token-de-prueba";
const EXPIRA_MS = 15 * 60_000;

/** @type {Array<{ recibidoEn: string; pedido: any }>} */
const recibidos = [];
/** @type {string[]} */
const consultas = [];
/** @type {Map<string, { estado: string; base: string; creado: number; mensaje?: string }>} */
const registrados = new Map();

// Un PDF de una página en blanco: el más chico que un lector abre sin quejarse.
const PDF_MINIMO = Buffer.from(
  "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);

const leerCuerpo = (req) =>
  new Promise((resolve) => {
    let texto = "";
    req.on("data", (trozo) => (texto += trozo));
    req.on("end", () => {
      try {
        resolve(texto ? JSON.parse(texto) : {});
      } catch {
        resolve(null);
      }
    });
  });

const responder = (res, estado, cuerpo) => {
  if (res.writableEnded || res.destroyed) return; // la app ya no esperó: se cortó la conexión
  res.writeHead(estado, { "content-type": "application/json" });
  res.end(JSON.stringify(cuerpo));
};

/** «Cliente [lucode:modo=caido;demora=100]» → { base: «Cliente», modo: «caido», demora: 100 } */
function escenarioDe(nombre = "") {
  const m = nombre.match(/\s*\[lucode:([^\]]*)\]\s*$/);
  const base = nombre.replace(/\s*\[lucode:[^\]]*\]\s*$/, "");
  const e = { base, modo: "aceptado", demora: 0, motivo: "" };
  for (const par of (m?.[1] ?? "").split(";")) {
    const [k, v] = par.split("=");
    if (k === "modo" && v) e.modo = v;
    if (k === "demora") e.demora = Number(v) || 0;
    if (k === "motivo" && v) e.motivo = v;
  }
  return e;
}

const MOTIVO_LARGO =
  "El documento del cliente no es válido: el número de RUC 20123456789 no figura como activo en el padrón de SUNAT. Verifica los datos del cliente y vuelve a emitir el comprobante con el documento correcto.";

const numeroDe = (pedido) => `${pedido.serie}-${String(pedido.numero).padStart(8, "0")}`;
const vigente = (clave) => {
  const r = registrados.get(clave);
  return r && Date.now() - r.creado < EXPIRA_MS ? r : undefined;
};
const cuerpoDe = (clave, r) =>
  r.estado === "aceptado"
    ? { estado: "aceptado", pdf_url: `http://127.0.0.1:${puerto}/pdf/${clave}`, xml_url: `http://127.0.0.1:${puerto}/xml/${clave}` }
    : r.estado === "rechazado"
      ? { estado: "rechazado", mensaje: r.mensaje ?? "El RUC del cliente no existe" }
      : { estado: "enviado" };

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://127.0.0.1");

  if (req.method === "GET" && pathname === "/salud") return responder(res, 200, { ok: true });
  if (req.method === "GET" && pathname === "/recibidos") return responder(res, 200, recibidos);
  if (req.method === "GET" && pathname === "/consultas") return responder(res, 200, consultas);
  if (req.method === "GET" && pathname.startsWith("/pdf/")) {
    res.writeHead(200, { "content-type": "application/pdf" });
    return res.end(PDF_MINIMO);
  }
  if (req.method === "GET" && pathname.startsWith("/xml/")) {
    res.writeHead(200, { "content-type": "application/xml" });
    return res.end("<comprobante>de prueba</comprobante>");
  }

  if (req.method === "POST" && pathname === "/sunat") {
    const { numero } = (await leerCuerpo(req)) ?? {};
    const r = vigente(numero);
    if (r?.estado === "enviado") r.estado = "aceptado";
    return responder(res, 200, { ok: Boolean(r) });
  }

  if (req.method === "GET" && pathname.startsWith("/comprobantes/")) {
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return responder(res, 401, { mensaje: "Token no válido" });
    const clave = decodeURIComponent(pathname.slice("/comprobantes/".length));
    consultas.push(clave);
    const r = vigente(clave);
    return r ? responder(res, 200, cuerpoDe(clave, r)) : responder(res, 404, { mensaje: "No conozco ese comprobante" });
  }

  if (req.method === "POST" && pathname === "/comprobantes") {
    const pedido = await leerCuerpo(req);
    if (!pedido) return responder(res, 400, { mensaje: "El cuerpo no es JSON" });
    recibidos.push({ recibidoEn: new Date().toISOString(), pedido });
    const e = escenarioDe(pedido.cliente?.nombre);
    if (e.modo === "token" || req.headers.authorization !== `Bearer ${TOKEN}`) return responder(res, 401, { mensaje: "Token no válido" });
    if (e.modo === "caido") return responder(res, 503, { mensaje: "El servicio no está disponible" });

    const clave = numeroDe(pedido);
    const previo = vigente(clave);
    // Un número que ya tiene (de la misma venta; el mismo nombre sin la marca) es un 409, como el proveedor de verdad. Uno de otra
    // venta es de una corrida anterior (la base se rehízo y los números volvieron a empezar): se olvida.
    if (previo && previo.base === e.base) return responder(res, 409, { mensaje: "El comprobante ya existe" });
    const estado = e.modo === "rechazado" ? "rechazado" : e.modo === "enviado" ? "enviado" : "aceptado";
    registrados.set(clave, { estado, base: e.base, creado: Date.now(), mensaje: e.motivo === "largo" ? MOTIVO_LARGO : undefined });
    if (e.demora > 0) await new Promise((r) => setTimeout(r, e.demora));
    if (e.modo === "invalido") return responder(res, 200, { algo: "raro" });
    return responder(res, 200, cuerpoDe(clave, registrados.get(clave)));
  }

  responder(res, 404, { mensaje: "No existe" });
}).listen(puerto, "127.0.0.1", () => console.log(`Lucode simulado en http://127.0.0.1:${puerto}`));
