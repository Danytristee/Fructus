import { NextResponse, type NextRequest } from "next/server";

import { permisosDe } from "@/lib/permisos-reglas";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { leerCatalogo } from "@/lib/voz/catalogo";
import { pedidoDe, responderConsulta } from "@/lib/voz/consultas";
import { vocabularioWhisper } from "@/lib/voz/catalogo-reglas";
import { interpretar } from "@/lib/voz/interprete";
import { revisarFrase } from "@/lib/voz/palabra-reglas";
import { resolver } from "@/lib/voz/resolver";
import { transcribir } from "@/lib/voz/stt";
import { armarTarjeta } from "@/lib/voz/tarjeta-reglas";

// POST /api/voz: audio → texto (Whisper) → intención (LLM + Zod) → registro en comandos_voz → nombres y precios de la
// base → tarjeta lista para mostrar. Todo lo sensible pasa aquí, en el servidor (CLAUDE.md, «La voz»). No guarda la
// venta: eso pasa recién al confirmar la tarjeta (A5). Nunca registra la transcripción en los logs, solo ids y códigos.
// Lo dictado después de «Hola Fructus» llega con `despertar=1` y trae la frase: si Whisper oyó «frutas» en vez de la frase, se
// descarta sin guardar nada (el segundo paso, lib/voz/palabra-reglas.ts); si oyó la frase, se interpreta lo que siguió.

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
  if (!(audio instanceof Blob) || audio.size === 0) return responder(400, { error: "No llegó el audio. Toca el botón y habla después de «Te escucho»." });
  if (audio.size > TOPE_BYTES) return responder(413, { error: "El audio es muy largo. Dilo en menos de un minuto." });
  if (audio.type && !audio.type.startsWith("audio/")) return responder(415, { error: "Eso no es un audio." });
  const duracionMs = Number(formulario?.get("duracion_ms")) || null;
  if (duracionMs !== null && duracionMs > TOPE_MS) return responder(413, { error: "El audio es muy largo. Dilo en menos de un minuto." });
  const porPalabra = formulario?.get("despertar") === "1";
  // De qué celular viene (lib/voz/celular.ts): dos celulares que oyeron la misma frase abren una sola tarjeta (paso 4b).
  const celular = formulario?.get("celular");

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

  // 3b. El segundo paso de «Hola Fructus». Una frase parecida («hola, ¿hay frutas?») no era para Fructus: no se interpreta ni se
  //     guarda, porque sería guardar lo que se habla en el puesto. Con un toque nunca se descarta: la persona quiso dictar.
  const frase = revisarFrase(texto.texto);
  if (porPalabra && frase.veredicto === "parecida") {
    console.info("voz: «Hola Fructus» descartado en el segundo paso (una frase parecida)");
    return responder(200, { ignorado: "parecida" });
  }
  // Dijo la frase y nada más: no hay qué interpretar.
  if (frase.veredicto === "dijo" && !frase.orden) return responder(200, { ignorado: "sin_orden" });

  // 4. Texto a intención: lo que siguió a la frase, si se oyó; si no, todo (el intérprete pasa por alto un saludo).
  const orden = frase.veredicto === "dijo" ? frase.orden : texto.texto;
  const interpretacion = await interpretar(orden);
  const entendio = interpretacion.ok && interpretacion.interpretacion.herramienta !== "no_entendido";

  // 4b. Una venta dicha en voz alta la oyen todos los celulares que escuchan «Hola Fructus» en el puesto: solo el primero que la
  //     entiende abre su tarjeta (tomar_frase, ADR-0022). Si no, un solo «confirmo» la guardaba dos veces (/chaos 2026-11-16, 1).
  if (porPalabra && entendio && typeof celular === "string" && celular.length >= 8) {
    const { data: tomada, error: errorFrase } = await supabase.rpc("tomar_frase", { p_frase: orden, p_celular: celular.slice(0, 64) });
    if (errorFrase) {
      console.error("voz: no se pudo tomar la frase", { codigo: errorFrase.code });
      return responder(503, { error: "No pudimos guardar lo que dijiste. Revisa tu señal e inténtalo otra vez.", conservarAudio: true });
    }
    if (tomada === false) {
      console.info("voz: otro celular ya tomó esta frase");
      return responder(200, { ignorado: "otro_celular" });
    }
  }

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

  // 7. Si es una pregunta, la respuesta viaja con la tarjeta (sin otra vuelta). Si falla la lectura, la tarjeta la pide
  //    de nuevo con la acción responderConsulta: la pregunta no se pierde.
  if (tarjeta.tipo === "consulta") {
    try {
      tarjeta = { ...tarjeta, respuesta: await responderConsulta(supabase, pedidoDe(tarjeta)) };
    } catch (e) {
      console.error("voz: no se pudo responder la consulta", { comandoId: comando.id, error: e instanceof Error ? e.message : "desconocido" });
    }
  }
  // Una pregunta respondida no tiene nada que confirmar: el comando queda confirmado (cuenta en la precisión).
  const respondida = tarjeta.tipo === "consulta" && tarjeta.respuesta !== null;

  // 8. La latencia del servidor queda en el comando (el navegador le suma la red).
  const latenciaMs = Math.round(performance.now() - inicio);
  const { error: errorLatencia } = await supabase
    .from("comandos_voz")
    .update(respondida ? { latencia_ms: latenciaMs, resultado: "confirmado" } : { latencia_ms: latenciaMs })
    .eq("id", comando.id);
  if (errorLatencia) console.error("voz: no se pudo guardar la latencia", { comandoId: comando.id, codigo: errorLatencia.code });

  return responder(200, { comandoId: comando.id, transcripcion: texto.texto, tarjeta, latenciaMs });
}
