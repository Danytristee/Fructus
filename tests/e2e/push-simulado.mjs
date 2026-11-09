// Un servicio de avisos (Web Push) de mentira para las pruebas e2e. El servidor de la app le manda el aviso como al de Google, Apple o
// Mozilla (PUSH_SIMULADOR_URL), pero este vive en esta máquina, y deja que la prueba vea qué le llegó (GET /recibidos), cifrado tal
// cual salió: así se prueba que el aviso salió una vez, con su tema y su vencimiento, y que el teléfono lo puede descifrar.
//
//   POST /…            un aviso (la dirección del teléfono viene en la cabecera X-Push-Endpoint).
//                      Contesta 201, salvo que la dirección traiga la palabra «gone» → 410, «no-existe» → 404 o «falla» → 503.
//   GET  /recibidos    todo lo recibido, en orden.
//   DELETE /recibidos  lo olvida.
//   GET  /salud        para que Playwright sepa que ya está arriba.
import { createServer } from "node:http";

const puerto = Number(process.env.PUERTO_PUSH ?? 3300);
/** @type {Array<{ endpoint: string; ttl?: string; topic?: string; urgency?: string; contentEncoding?: string; autorizacion?: string; cuerpo: string }>} */
const recibidos = [];

const responder = (res, estado, cuerpo) => {
  res.writeHead(estado, { "content-type": "application/json" });
  res.end(JSON.stringify(cuerpo));
};

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://simulado");
  if (pathname === "/salud") return responder(res, 200, { ok: true });
  if (pathname === "/recibidos") {
    if (req.method === "DELETE") recibidos.length = 0;
    return responder(res, 200, req.method === "DELETE" ? [] : recibidos);
  }

  const trozos = [];
  for await (const trozo of req) trozos.push(trozo);
  const endpoint = String(req.headers["x-push-endpoint"] ?? "");
  recibidos.push({
    endpoint,
    ttl: req.headers.ttl,
    topic: req.headers.topic,
    urgency: req.headers.urgency,
    contentEncoding: req.headers["content-encoding"],
    autorizacion: req.headers.authorization,
    cuerpo: Buffer.concat(trozos).toString("base64"),
  });
  const estado = endpoint.includes("gone") ? 410 : endpoint.includes("no-existe") ? 404 : endpoint.includes("falla") ? 503 : 201;
  responder(res, estado, {});
}).listen(puerto, "127.0.0.1", () => console.log(`Servicio de avisos simulado en http://127.0.0.1:${puerto}`));
