import { NextResponse, type NextRequest } from "next/server";

import { permisosDe } from "@/lib/permisos-reglas";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { leerCatalogo } from "@/lib/voz/catalogo";
import { vocabularioWhisper } from "@/lib/voz/catalogo-reglas";
import { interpretar } from "@/lib/voz/interprete";
import { resolver } from "@/lib/voz/resolver";
import { transcribir } from "@/lib/voz/stt";
import { armarTarjeta } from "@/lib/voz/tarjeta-reglas";

// POST /api/voz: audio → texto (Whisper) → intención (LLM + Zod) → registro en comandos_voz → nombres y precios de la
// base → tarjeta lista para mostrar. Todo lo sensible pasa aquí, en el servidor (CLAUDE.md, «La voz»). No guarda la
// venta: eso pasa recién al confirmar la tarjeta (A5). Nunca registra la transcripción en los logs, solo ids y códigos.

const TOPE_BYTES = 10 * 1024 * 1024;
const TOPE_MS = 60_000;
const NO_TE_ENTENDI = "No te entendí, inténtalo otra vez.";

const responder = (estado: number, cuerpo: Record<string, unknown>) => NextResponse.json(cuerpo, { status: estado });

export async function POST(request: NextRequest) {
  const inicio = performance.now();
  const supabase = await crearClienteServidor();

  // 1. Quién habla y si puede registrar (el contador solo lee).
  const { data: sesion } = await supabase.auth.getClaims();
  if (!sesion?.claims) return responder(401, { error: "Tu sesión terminó. Vuelve a entrar." });
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", sesion.claims.sub).eq("activo", true).maybeSingle();
  if (!permisosDe(perfil?.rol ?? null).registrar) return responder(403, { error: "Tu cuenta no puede registrar operaciones." });

  // 2. El audio: un archivo de audio, de 10 MB y 60 s como máximo.
  const formulario = await request.formData().catch(() => null);
  const audio = formulario?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return responder(400, { error: "No llegó el audio. Mantén el botón mientras hablas." });
  if (audio.size > TOPE_BYTES) return responder(413, { error: "El audio es muy largo. Dilo en menos de un minuto." });
  if (audio.type && !audio.type.startsWith("audio/")) return responder(415, { error: "Eso no es un audio." });
  const duracionMs = Number(formulario?.get("duracion_ms")) || null;
  if (duracionMs !== null && duracionMs > TOPE_MS) return responder(413, { error: "El audio es muy largo. Dilo en menos de un minuto." });

  // 3. Voz a texto, con el vocabulario del puesto.
  let vocabulario: string | undefined;
  try {
    vocabulario = vocabularioWhisper(await leerCatalogo(supabase));
  } catch (e) {
    // Sin catálogo igual se transcribe: el vocabulario mejora la ortografía, pero no es indispensable.
    console.error("voz: no se pudo armar el vocabulario", { error: e instanceof Error ? e.message : "desconocido" });
  }
  const texto = await transcribir(audio, { vocabulario });
  if (!texto.ok) return responder(502, { error: NO_TE_ENTENDI, conservarAudio: true });

  // 4. Texto a intención.
  const interpretacion = await interpretar(texto.texto);
  const entendio = interpretacion.ok && interpretacion.interpretacion.herramienta !== "no_entendido";

  // 5. El rastro en comandos_voz, siempre: sirve para medir la precisión con lo que de verdad se dice en el puesto.
  const { data: comando, error: errorComando } = await supabase
    .from("comandos_voz")
    .insert({
      transcripcion: texto.texto,
      intencion: interpretacion.ok ? interpretacion.interpretacion.herramienta : null,
      interpretacion: interpretacion.ok ? interpretacion.interpretacion : { error: interpretacion.motivo },
      resultado: entendio ? "pendiente" : "no_entendido",
      duracion_audio_ms: duracionMs,
      modelo_stt: texto.modelo,
      modelo_llm: interpretacion.ok ? interpretacion.modelo : null,
    })
    .select("id")
    .single();
  if (errorComando) {
    console.error("voz: no se pudo registrar el comando", { codigo: errorComando.code });
    return responder(503, { error: "No pudimos guardar lo que dijiste. Revisa tu señal e inténtalo otra vez.", conservarAudio: true });
  }
  if (!interpretacion.ok) return responder(502, { error: NO_TE_ENTENDI, conservarAudio: true, comandoId: comando.id });

  // 6. Nombres y precios de la base → la tarjeta.
  let tarjeta;
  try {
    tarjeta = armarTarjeta(interpretacion.interpretacion, await resolver(supabase, interpretacion.interpretacion));
  } catch (e) {
    console.error("voz: no se pudieron resolver los nombres", { comandoId: comando.id, error: e instanceof Error ? e.message : "desconocido" });
    return responder(503, { error: "No pudimos buscar en tu cuaderno. Revisa tu señal e inténtalo otra vez.", conservarAudio: true });
  }

  // 7. La latencia del servidor queda en el comando (el navegador le suma la red).
  const latenciaMs = Math.round(performance.now() - inicio);
  const { error: errorLatencia } = await supabase.from("comandos_voz").update({ latencia_ms: latenciaMs }).eq("id", comando.id);
  if (errorLatencia) console.error("voz: no se pudo guardar la latencia", { comandoId: comando.id, codigo: errorLatencia.code });

  return responder(200, { comandoId: comando.id, transcripcion: texto.texto, tarjeta, latenciaMs });
}
