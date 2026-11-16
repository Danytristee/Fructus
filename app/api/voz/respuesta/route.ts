import { NextResponse, type NextRequest } from "next/server";

import { permisosDe } from "@/lib/permisos-reglas";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { VOCABULARIO_RESPUESTA, clasificarRespuesta } from "@/lib/voz/respuesta-reglas";
import { transcribir } from "@/lib/voz/stt";

// POST /api/voz/respuesta: la respuesta corta después de oír la lectura de una venta (ADR-0020) → Whisper → ¿confirma? No guarda
// nada: si confirma, el celular guarda por la misma acción que el toque. Nunca registra la transcripción en los logs.

// Una respuesta corta: el celular deja de escuchar a los 8 s.
const TOPE_BYTES = 1024 * 1024;
const TOPE_MS = 15_000;

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

  const texto = await transcribir(audio, { vocabulario: VOCABULARIO_RESPUESTA });
  if (!texto.ok) return responder(502, { error: "No te entendí." });
  return responder(200, { respuesta: clasificarRespuesta(texto.texto) });
}
