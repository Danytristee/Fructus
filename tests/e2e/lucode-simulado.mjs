// Un Lucode de mentira para las pruebas e2e (A9). La app le habla como al proveedor de verdad (POST /comprobantes con
// `Authorization: Bearer …`), pero este servidor vive en esta máquina, no cobra ni toca SUNAT, y deja que la prueba vea:
//   · qué le llegó (GET /recibidos): así se prueba «el proveedor lo recibió UNA sola vez», no solo lo que muestra la pantalla;
//   · y cómo se porta (POST /control): demora la respuesta para que dos pedidos se solapen.
// Playwright lo arranca junto a `pnpm dev` (playwright.config.ts). La forma de la respuesta es nuestra suposición del contrato
// hasta probar contra el sandbox real (A9.6).
import { createServer } from "node:http";

const puerto = Number(process.env.PUERTO_LUCODE ?? 3200);
const TOKEN = "token-de-prueba";

/** @type {Array<{ recibidoEn: string; pedido: any }>} */
let recibidos = [];
const control = { demoraMs: 0 };

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
  res.writeHead(estado, { "content-type": "application/json" });
  res.end(JSON.stringify(cuerpo));
};

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://127.0.0.1");

  if (req.method === "GET" && pathname === "/salud") return responder(res, 200, { ok: true });
  if (req.method === "GET" && pathname === "/recibidos") return responder(res, 200, recibidos);

  if (req.method === "POST" && pathname === "/control") {
    const cambios = (await leerCuerpo(req)) ?? {};
    if (cambios.limpiar) recibidos = [];
    if (typeof cambios.demoraMs === "number") control.demoraMs = cambios.demoraMs;
    return responder(res, 200, control);
  }

  if (req.method === "POST" && pathname === "/comprobantes") {
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return responder(res, 401, { mensaje: "Token no válido" });
    const pedido = await leerCuerpo(req);
    if (!pedido) return responder(res, 400, { mensaje: "El cuerpo no es JSON" });
    recibidos.push({ recibidoEn: new Date().toISOString(), pedido });
    if (control.demoraMs > 0) await new Promise((r) => setTimeout(r, control.demoraMs));
    const numero = `${pedido.serie}-${String(pedido.numero).padStart(8, "0")}`;
    return responder(res, 200, {
      estado: "aceptado",
      pdf_url: `http://127.0.0.1:${puerto}/pdf/${numero}`,
      xml_url: `http://127.0.0.1:${puerto}/xml/${numero}`,
    });
  }

  responder(res, 404, { mensaje: "No existe" });
}).listen(puerto, "127.0.0.1", () => console.log(`Lucode simulado en http://127.0.0.1:${puerto}`));
