// Un modelo de mentira para las pruebas e2e. El servidor de la app le pide la estimación de vida útil como a la API de Anthropic
// (VIDA_UTIL_SIMULADOR_URL), pero este vive en esta máquina: no gasta créditos, contesta siempre lo mismo y deja que la prueba vea
// qué se le pidió (GET /recibidos).
//
//   POST /v1/messages  contesta una estimación por cada fruta del pedido. Por defecto, los mismos días que la tabla: así las
//                      demás pruebas de Stock no cambian. La marca va en el nombre de la fruta (su calibre), como en Lucode:
//                        «sim-menos» → un día menos que la tabla      «sim-loco» → 400 días (la app lo mete al margen)
//                        «sim-falla» → 500 para todo el pedido        «sim-rechazo» → el modelo rechaza el pedido
//                      Una fruta que vuelve con evidencia (trae «actual») queda igual, salvo que alguien la haya revisado y
//                      siguiera buena: entonces pide 3 días más, y la app lo deja en el paso de una noche.
//   GET  /recibidos    los pedidos recibidos, en orden.
//   DELETE /recibidos  los olvida.
//   GET  /salud        para que Playwright sepa que ya está arriba.
import { createServer } from "node:http";

const puerto = Number(process.env.PUERTO_SONNET ?? 3500);
/** @type {Array<{ modelo: string; esfuerzo?: string; formato?: string; conClave: boolean; frutas: { id: number; fruta: string; tabla: number; minimo: number; maximo: number; actual?: number; evidencia?: { tipo: string; haceDias: number; gastado: number; cajas?: number }[] }[] }>} */
const recibidos = [];

const responder = (res, estado, cuerpo) => {
  res.writeHead(estado, { "content-type": "application/json" });
  res.end(JSON.stringify(cuerpo));
};

const mensaje = (modelo, extra) => ({
  id: "msg_simulado",
  type: "message",
  role: "assistant",
  model: modelo,
  content: [],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: { input_tokens: 1, output_tokens: 1 },
  ...extra,
});

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://simulado");
  if (pathname === "/salud") return responder(res, 200, { ok: true });
  if (pathname === "/recibidos") {
    if (req.method === "DELETE") recibidos.length = 0;
    return responder(res, 200, req.method === "DELETE" ? [] : recibidos);
  }
  if (pathname !== "/v1/messages" || req.method !== "POST") return responder(res, 404, { type: "error", error: { type: "not_found_error", message: "no existe" } });

  const trozos = [];
  for await (const trozo of req) trozos.push(trozo);
  const pedido = JSON.parse(Buffer.concat(trozos).toString("utf8"));
  const contenido = pedido.messages?.[0]?.content;
  const frutas = JSON.parse(typeof contenido === "string" ? contenido : (contenido?.[0]?.text ?? "{}")).frutas ?? [];
  recibidos.push({ modelo: pedido.model, esfuerzo: pedido.output_config?.effort, formato: pedido.output_config?.format?.type, conClave: Boolean(req.headers["x-api-key"] ?? req.headers.authorization), frutas });

  const tiene = (marca) => frutas.some((f) => f.fruta.includes(marca));
  if (tiene("sim-falla")) return responder(res, 500, { type: "error", error: { type: "api_error", message: "falla simulada" } });
  if (tiene("sim-rechazo")) return responder(res, 200, mensaje(pedido.model, { stop_reason: "refusal" }));

  const estimaciones = frutas.map((f) => {
    if (f.actual !== undefined) {
      const siguioBuena = (f.evidencia ?? []).some((e) => e.tipo === "sigue_buena");
      return { producto_id: f.id, dias: siguioBuena ? f.actual + 3 : f.actual, motivo: siguioBuena ? "Simulado: la revisaron pasada su fecha y seguía buena." : "Simulado: no alcanza para cambiarla." };
    }
    return {
      producto_id: f.id,
      dias: f.fruta.includes("sim-loco") ? 400 : f.fruta.includes("sim-menos") ? f.tabla - 1 : f.tabla,
      motivo: f.fruta.includes("sim-menos") ? "Simulado: llega más madura y se pasa antes." : "Simulado: igual que la tabla.",
    };
  });
  return responder(res, 200, mensaje(pedido.model, { content: [{ type: "text", text: JSON.stringify({ estimaciones }) }] }));
}).listen(puerto, "127.0.0.1", () => console.log(`Sonnet simulado en http://127.0.0.1:${puerto}`));
