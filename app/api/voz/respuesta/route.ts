import { NextResponse, type NextRequest } from "next/server";

import { permisosDe } from "@/lib/permisos-reglas";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { esquemaVentaActual } from "@/lib/voz/esquemas";
import { interpretar } from "@/lib/voz/interprete";
import { resolver } from "@/lib/voz/resolver";
import { VOCABULARIO_PAGO, VOCABULARIO_RESPUESTA, clasificarPago, clasificarRespuesta, pareceCorreccion, pideQueRepita } from "@/lib/voz/respuesta-reglas";
import { transcribir } from "@/lib/voz/stt";
import { armarTarjeta } from "@/lib/voz/tarjeta-reglas";

// POST /api/voz/respuesta: la respuesta corta después de oír la lectura de una venta (ADR-0020) → Whisper → ¿confirma?, o, si se
// preguntó «¿Pagó o lo debe?» (`pregunta=pago`), cómo quedó el pago. «Repite» pide que se lea otra vez. No guarda nada: el celular anota el pago en la tarjeta y, si
// confirma, guarda por la misma acción que el toque. Si en vez de confirmar corrige («no, son ocho cajas»), el intérprete arma la
// venta corregida a partir de la venta actual (`venta`, en los campos de registrar_venta) y vuelve una tarjeta nueva para leer y
// confirmar. Nunca registra la
// transcripción en los logs.

// Una respuesta corta: el celular deja de escuchar a los 8 s.
const TOPE_BYTES = 1024 * 1024;
const TOPE_MS = 15_000;
/** La venta que se está confirmando, en datos: más que esto no es una venta del puesto. */
const TOPE_VENTA = 4_000;

/** La venta actual que mandó el celular para poder corregirla, validada; null si no vino o no tiene la forma de registrar_venta. */
function leerVentaActual(campo: FormDataEntryValue | null | undefined) {
  if (typeof campo !== "string" || !campo || campo.length > TOPE_VENTA) return null;
  try {
    const leida = esquemaVentaActual.safeParse(JSON.parse(campo));
    return leida.success ? leida.data : null;
  } catch {
    return null;
  }
}

const responder = (estado: number, cuerpo: Record<string, unknown>) => NextResponse.json(cuerpo, { status: estado });

export async function POST(request: NextRequest) {
  const supabase = await crearClienteServidor();

  // Quién habla y si puede registrar (el contador solo lee): la respuesta confirma una venta.
  const { data: sesion } = await supabase.auth.getClaims();
  if (!sesion?.claims) return responder(401, { error: "Tu sesión terminó. Vuelve a entrar." });
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", sesion.claims.sub).eq("activo", true).maybeSingle();
  if (!permisosDe(perfil?.rol ?? null).registrar) return responder(403, { error: "Tu cuenta no puede registrar operaciones." });

  const formulario = await request.formData().catch(() => null);
  const audio = formulario?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return responder(400, { error: "No llegó la respuesta." });
  if (audio.size > TOPE_BYTES) return responder(413, { error: "La respuesta es muy larga." });
  if (audio.type && !audio.type.startsWith("audio/")) return responder(415, { error: "Eso no es un audio." });
  const duracionMs = Number(formulario?.get("duracion_ms")) || null;
  if (duracionMs !== null && duracionMs > TOPE_MS) return responder(413, { error: "La respuesta es muy larga." });

  const pregunta = formulario?.get("pregunta") === "pago" ? "pago" : "confirmar";
  const texto = await transcribir(audio, { vocabulario: pregunta === "pago" ? VOCABULARIO_PAGO : VOCABULARIO_RESPUESTA });
  if (!texto.ok) return responder(502, { error: "No te entendí." });
  // «Repite», «¿qué?»: se vuelve a leer, en cualquier pregunta, sin llamar al modelo.
  if (pideQueRepita(texto.texto)) return responder(200, { repetir: true });
  if (pregunta === "pago") return responder(200, { pago: clasificarPago(texto.texto) });

  const respuesta = clasificarRespuesta(texto.texto);
  const actual = leerVentaActual(formulario?.get("venta"));
  if (respuesta === "confirmar" || !actual || !pareceCorreccion(texto.texto)) return responder(200, { respuesta });
  // Corrigió: la venta completa ya corregida, con los nombres y precios de la base, como una tarjeta dictada.
  const corregida = await interpretar(texto.texto, { correccionDe: actual });
  if (!corregida.ok || corregida.interpretacion.herramienta !== "registrar_venta") return responder(200, { respuesta: "otra" });
  try {
    const tarjeta = armarTarjeta(corregida.interpretacion, await resolver(supabase, corregida.interpretacion));
    return responder(200, tarjeta.tipo === "venta" ? { respuesta: "corregir", tarjeta } : { respuesta: "otra" });
  } catch (e) {
    console.error("voz: no se pudo armar la corrección", { error: e instanceof Error ? e.message : "desconocido" });
    return responder(200, { respuesta: "otra" });
  }
}
