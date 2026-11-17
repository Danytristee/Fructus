import { NextResponse, type NextRequest } from "next/server";

import { permisosDe } from "@/lib/permisos-reglas";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { leerCatalogo } from "@/lib/voz/catalogo";
import { vocabularioWhisper } from "@/lib/voz/catalogo-reglas";
import { esquemaAbonoActual, esquemaCompraActual, esquemaFaltaPreguntada, esquemaVentaActual, type FaltaPreguntada, type OperacionActual } from "@/lib/voz/esquemas";
import { interpretar } from "@/lib/voz/interprete";
import { resolver } from "@/lib/voz/resolver";
import { VOCABULARIO_PAGO, VOCABULARIO_RESPUESTA, clasificarPago, clasificarRespuesta, hablaDeUnaParte, pareceCorreccion, pideQueRepita } from "@/lib/voz/respuesta-reglas";
import { transcribir } from "@/lib/voz/stt";
import { armarTarjeta } from "@/lib/voz/tarjeta-reglas";

// POST /api/voz/respuesta: la respuesta corta después de oír la lectura de una operación (ADR-0020) → Whisper → ¿confirma?, o, si se
// preguntó «¿Pagó o lo debe?» (`pregunta=pago`), cómo quedó el pago. «Repite» pide que se lea otra vez. No guarda nada: el celular
// anota el pago en la tarjeta y, si confirma, guarda por la misma acción que el toque. Si en vez de confirmar corrige («no, son ocho
// cajas»), el intérprete arma la operación corregida a partir de la actual (el campo `venta`, `abono` o `compra`, en los campos de su
// herramienta) y vuelve una tarjeta nueva para leer y confirmar. Si estaba incompleta y se preguntó lo que faltaba (`pregunta=falta`,
// con el dato en `falta`), la respuesta («cuarenta», «el Kent») la completa por el mismo camino (ADR-0027). Nunca registra la
// transcripción en los logs.

// Una respuesta corta: el celular deja de escuchar a los 8 s.
const TOPE_BYTES = 1024 * 1024;
const TOPE_MS = 15_000;
/** La operación que se está confirmando, en datos: más que esto no es una operación del puesto. */
const TOPE_OPERACION = 4_000;

const ESQUEMAS = { venta: esquemaVentaActual, abono: esquemaAbonoActual, compra: esquemaCompraActual } as const;

/**
 * La operación actual que mandó el celular para poder corregirla, validada con el esquema de su herramienta; null si no vino o no
 * tiene esa forma. Viaja en el campo con su nombre: `venta`, `abono` o `compra`.
 */
function leerActual(formulario: FormData | null): OperacionActual | null {
  for (const operacion of ["venta", "abono", "compra"] as const) {
    const campo = formulario?.get(operacion);
    if (typeof campo !== "string" || !campo) continue;
    if (campo.length > TOPE_OPERACION) return null;
    try {
      const leida = ESQUEMAS[operacion].safeParse(JSON.parse(campo));
      return leida.success ? ({ operacion, datos: leida.data } as OperacionActual) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** El dato que se preguntó, validado; null si no vino o no tiene la forma esperada. */
function leerFalta(campo: FormDataEntryValue | null | undefined): FaltaPreguntada | null {
  if (typeof campo !== "string" || !campo || campo.length > 1_000) return null;
  try {
    const leida = esquemaFaltaPreguntada.safeParse(JSON.parse(campo));
    return leida.success ? leida.data : null;
  } catch {
    return null;
  }
}

/** Para Whisper, cuando la respuesta es lo que faltaba: un nombre del puesto o un número. Sin catálogo, igual se transcribe. */
async function vocabularioFalta(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, falta: FaltaPreguntada | null) {
  const opciones = falta?.opciones.length ? `${falta.opciones.join(". ")}. ` : "";
  try {
    return `${opciones}${vocabularioWhisper(await leerCatalogo(supabase))}`;
  } catch (e) {
    console.error("voz: no se pudo armar el vocabulario", { error: e instanceof Error ? e.message : "desconocido" });
    return `${opciones}${VOCABULARIO_RESPUESTA}`;
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

  const campo = formulario?.get("pregunta");
  const pregunta = campo === "pago" ? "pago" : campo === "falta" ? "falta" : "confirmar";
  const falta = pregunta === "falta" ? leerFalta(formulario?.get("falta")) : null;
  const vocabulario = pregunta === "pago" ? VOCABULARIO_PAGO : pregunta === "falta" ? await vocabularioFalta(supabase, falta) : VOCABULARIO_RESPUESTA;
  const texto = await transcribir(audio, { vocabulario });
  if (!texto.ok) return responder(502, { error: "No te entendí." });
  // «Repite», «¿qué?»: se vuelve a leer, en cualquier pregunta, sin llamar al modelo.
  if (pideQueRepita(texto.texto)) return responder(200, { repetir: true });
  const actual = leerActual(formulario);

  if (pregunta === "pago") {
    // «Pagó quinientos», «me dio la mitad»: trae lo que pagó al llevar. No se clasifica en «Pagó» o «Lo debe» (sería inventar que pagó
    // todo, o perder lo que dejó): la venta se rehace con el intérprete, como cualquier corrección (ADR-0025). Si no sale, se repregunta.
    if (actual?.operacion === "venta" && hablaDeUnaParte(texto.texto)) {
      const tarjeta = await corregir(supabase, texto.texto, actual);
      return responder(200, tarjeta ? { respuesta: "corregir", tarjeta } : { pago: null });
    }
    return responder(200, { pago: clasificarPago(texto.texto) });
  }

  if (pregunta === "falta") {
    // Lo que faltaba («cuarenta», «el Kent», «don Lucho»): completa la operación con el intérprete, que sabe qué se preguntó. «Confirmo»
    // o un «sí» suelto no completan nada: se repregunta sin gastar una llamada al modelo. Nada se guarda aquí.
    if (!actual || !falta || !pareceCorreccion(texto.texto)) return responder(200, { respuesta: "otra" });
    const tarjeta = await corregir(supabase, texto.texto, actual, falta);
    return responder(200, tarjeta ? { respuesta: "corregir", tarjeta } : { respuesta: "otra" });
  }

  const respuesta = clasificarRespuesta(texto.texto);
  if (respuesta === "confirmar" || !actual || !pareceCorreccion(texto.texto)) return responder(200, { respuesta });
  const tarjeta = await corregir(supabase, texto.texto, actual);
  return responder(200, tarjeta ? { respuesta: "corregir", tarjeta } : { respuesta: "otra" });
}

/**
 * La operación completa ya corregida, con los nombres y precios de la base, como una tarjeta dictada. null si el intérprete no la
 * rehízo o la volvió otra operación (una venta que vuelve como abono no se corrige: se repregunta). `falta`: lo que se preguntó porque
 * faltaba, si la respuesta es eso.
 */
async function corregir(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, dicho: string, actual: OperacionActual, falta?: FaltaPreguntada) {
  const corregida = await interpretar(dicho, { correccionDe: actual, falta });
  if (!corregida.ok || corregida.interpretacion.herramienta !== `registrar_${actual.operacion}`) return null;
  try {
    const tarjeta = armarTarjeta(corregida.interpretacion, await resolver(supabase, corregida.interpretacion));
    return tarjeta.tipo === actual.operacion ? tarjeta : null;
  } catch (e) {
    console.error("voz: no se pudo armar la corrección", { error: e instanceof Error ? e.message : "desconocido" });
    return null;
  }
}
