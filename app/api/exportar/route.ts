import { NextResponse, type NextRequest } from "next/server";

import { armarLibro, nombreDelArchivo, rangoDelMes } from "@/lib/exportar-reglas";
import { ErrorDeLectura, leerDatosDelMes } from "@/lib/exportar-mes";
import { libroAXlsx, TIPO_XLSX } from "@/lib/exportar-xlsx";
import { permisosDe } from "@/lib/permisos-reglas";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// GET /api/exportar?mes=AAAA-MM: el mes en un Excel para el contador. Solo lee: no guarda nada y respeta la RLS de quien lo pide.
// Quien puede ver el cierre (dueño, administrador, ayudante y contador, lib/permisos-reglas.ts) puede exportar el mes.

export const maxDuration = 30;

const SIN_GUARDAR = { "Cache-Control": "no-store" };
const responder = (estado: number, error: string) => NextResponse.json({ error }, { status: estado, headers: SIN_GUARDAR });

export async function GET(request: NextRequest) {
  const supabase = await crearClienteServidor();

  // 1. Quién pide y si puede.
  const { data: sesion } = await supabase.auth.getClaims();
  if (!sesion?.claims) return responder(401, "Tu sesión terminó. Vuelve a entrar.");
  const { data: perfil, error: errorPerfil } = await supabase.from("perfiles").select("rol").eq("id", sesion.claims.sub).eq("activo", true).maybeSingle();
  if (errorPerfil) {
    console.error("exportar: no se pudo leer el perfil", { codigo: errorPerfil.code });
    return responder(502, "No pudimos revisar tu cuenta. Revisa tu señal e inténtalo otra vez.");
  }
  if (!permisosDe(perfil?.rol ?? null).cierre) return responder(403, "Tu cuenta no puede exportar el mes.");

  // 2. Qué mes: uno que existe y que ya llegó.
  const ahora = new Date();
  const rango = rangoDelMes(request.nextUrl.searchParams.get("mes") ?? "", ahora);
  if (!rango) return responder(400, "Ese mes no existe o todavía no llega.");

  // 3. Leer, armar y entregar. Si algo falla, no sale un archivo a medias: sale el aviso.
  try {
    const archivo = libroAXlsx(armarLibro(await leerDatosDelMes(supabase, rango), ahora));
    return new NextResponse(new Uint8Array(archivo), {
      headers: {
        ...SIN_GUARDAR,
        "Content-Type": TIPO_XLSX,
        "Content-Disposition": `attachment; filename="${nombreDelArchivo(rango.mes)}"`,
      },
    });
  } catch (e) {
    console.error("exportar: no se pudo armar el mes", {
      mes: rango.mes,
      tabla: e instanceof ErrorDeLectura ? e.tabla : undefined,
      codigo: e instanceof ErrorDeLectura ? e.codigo : e instanceof Error ? e.name : "desconocido",
    });
    return responder(502, "No pudimos armar el Excel. Revisa tu señal e inténtalo otra vez. Lo que registraste está a salvo.");
  }
}
