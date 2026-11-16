import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { RespuestaDelModelo, type FrutaPorEstimar } from "../vida-estimada-reglas";

// La llamada al modelo que estima cuánto aguanta cada fruta (ADR-0021). Solo corre en el servidor: la clave de Anthropic vive
// aquí y nunca va al navegador ni a un log (CLAUDE.md, «Seguridad y claves»).
// Al modelo solo le llegan nombres de fruta y números de días: nada de clientes, precios ni ventas.

/** El modelo que estima. Queda guardado junto a cada estimación (`vida_util_estimada.modelo`). */
export const MODELO_DE_FRESCURA = "claude-sonnet-5-5";

/** Tope de espera de la llamada: el cron de la noche tiene 60 s en total y esto no puede comérselos (CLAUDE.md, principio 8). */
const TOPE_MS = 45_000;

const INSTRUCCIONES = `Eres quien cuida la frescura en un puesto mayorista de frutas del mercado La Hermelinda, en Trujillo (Perú). La fruta se vende por cajas, en un puesto abierto, a la sombra y sin cámara de frío.

Para cada fruta de la lista, estima cuántos días aguanta una caja en buen estado para venderse, contados desde el día en que llega al puesto, con estas condiciones fijas:
- A 24 °C. No ajustes por el calor: otra regla del sistema ya cuenta la temperatura de cada día.
- Si llegó pintona (a medio madurar). No ajustes por si llega verde o madura: otra regla ya lo hace.

Fíjate en lo que distingue a esa fruta de otras de su familia: la variedad, la selección (una de segunda o tercera suele llegar más golpeada o más madura que una Premium), el calibre y el origen.

"tabla" es el número de días que el sistema usa hoy para esa familia de fruta. Devuelve ese mismo número si no tienes una razón concreta para cambiarlo. Si lo cambias, que sea por algo propio de esa fruta.

Para cada fruta devuelve:
- "producto_id": el mismo id que recibiste.
- "dias": un número entero de días.
- "motivo": una sola frase corta, en español peruano neutro y de tú, que el dueño del puesto entienda sin explicación. Máximo 120 caracteres. No pongas números de días ni nombres técnicos. Ejemplos: «La Fuji es más firme que otras manzanas y aguanta más.» / «De tercera suele llegar más madura: se pasa antes.» / «No veo nada que la distinga de otras de su tipo: queda como en la tabla.»

Cada fruta trae "minimo" y "maximo": tu número tiene que quedar entre los dos.

Algunas frutas ya tienen una estimación tuya y vuelven porque el puesto juntó evidencia. Esas traen además:
- "actual": los días que rigen hoy.
- "evidencia": lo que pasó con llegadas de esa fruta, de lo más nuevo a lo más viejo. "haceDias" es hace cuántos días pasó. "gastado" es qué parte de la vida calculada con "actual" llevaba gastada esa llegada en ese momento, con el calor de cada día y cómo llegó ya contados (1 = justo su último día bueno).
  - "merma": se malograron "cajas" cajas. Con "gastado" cerca de 1 o más es lo esperado y no dice nada. Con "gastado" claramente menor que 1 (por ejemplo 0.6) esa fruta se malogró antes de lo calculado: aguanta menos.
  - "sigue_buena": alguien miró una llegada que ya había pasado su último día bueno y seguía vendible. Con "gastado" 1.3 aguantó un 30 % más de lo calculado: aguanta más.
Para esas frutas decide si "actual" sube, baja o se queda. Sé prudente: una sola observación mueve poco o nada (una caja se puede malograr por un golpe, y una fruta puede seguir «buena» ya al límite); varias en el mismo sentido pesan más; si se contradicen, quédate con "actual". Avisar un día antes cuesta menos que avisar un día tarde. En "motivo" di qué viste, en palabras del puesto: «Dos veces se malogró antes de tiempo esta semana: le quito un día.» / «La revisaron pasada su fecha y seguía buena: le doy un día más.» / «Una sola merma no alcanza para cambiarla.»

Devuelve una estimación por cada fruta recibida y ninguna más.`;

class ErrorDeEstimacion extends Error {
  constructor(codigo: "rechazo" | "cortada" | "sin-formato") {
    super(`vida estimada: el modelo no dio una respuesta que sirva (${codigo})`);
    this.name = `modelo:${codigo}`;
  }
}

/** Un modelo de mentira en esta misma máquina, solo para las pruebas (tests/e2e). Cualquier otra dirección se ignora. */
function simuladorLocal(direccion: string | undefined): string | undefined {
  if (!direccion) return undefined;
  try {
    const { hostname } = new URL(direccion);
    return hostname === "127.0.0.1" || hostname === "localhost" ? direccion : undefined;
  } catch {
    return undefined;
  }
}

/**
 * La función que le pregunta al modelo, o null si este servidor no tiene la clave (`ANTHROPIC_API_KEY`): entonces no se
 * estima y Stock sigue con lo que tenía. Lanza si el modelo no responde a tiempo, rechaza el pedido o corta la respuesta;
 * quien la llama lo convierte en «sigue la tabla» (lib/vida-estimada/estimar-del-dia.ts).
 */
export function crearEstimadorConSonnet(): ((frutas: FrutaPorEstimar[]) => Promise<RespuestaDelModelo>) | null {
  const clave = process.env.ANTHROPIC_API_KEY;
  if (!clave) return null;
  const cliente = new Anthropic({ apiKey: clave, baseURL: simuladorLocal(process.env.VIDA_UTIL_SIMULADOR_URL), timeout: TOPE_MS, maxRetries: 1 });

  return async (frutas) => {
    const respuesta = await cliente.messages.parse({
      model: MODELO_DE_FRESCURA,
      max_tokens: 16_000,
      system: INSTRUCCIONES,
      messages: [{ role: "user", content: JSON.stringify({ frutas }) }],
      // Esfuerzo bajo: es recordar y comparar, no un problema de varios pasos; así la respuesta llega dentro del tope.
      output_config: { effort: "low", format: zodOutputFormat(RespuestaDelModelo) },
    });
    if (respuesta.stop_reason === "refusal") throw new ErrorDeEstimacion("rechazo");
    if (respuesta.stop_reason === "max_tokens") throw new ErrorDeEstimacion("cortada");
    if (!respuesta.parsed_output) throw new ErrorDeEstimacion("sin-formato");
    return respuesta.parsed_output;
  };
}
