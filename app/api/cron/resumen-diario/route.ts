import { NextResponse } from "next/server";

import { cronAutorizado } from "@/lib/push/cron";
import { enviarAviso } from "@/lib/push/enviar";
import { enviarElResumenDelDia, estadoHttpDelInforme } from "@/lib/push/resumen-diario";
import { anotarEnLaBase, leerConfiguracionPush, leerDestinatariosDeLaBase, leerPorSalirDeLaBase, leerResumenDeLaBase } from "@/lib/push/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { estimarLaVidaDelDia, type InformeVida } from "@/lib/vida-estimada/estimar-del-dia";
import { dependenciasDeLaEstimacion } from "@/lib/vida-estimada/servidor";

// El aviso del día: Vercel llama a esta ruta una vez al día (vercel.json, «0 0 * * *» = las 7 p. m. de Lima; en el plan Hobby corre
// dentro de esa hora). Lee el día, y si hubo ventas o abonos, se lo manda a cada teléfono que lo pidió. Ver ADR-0013. Después, si hay
// fruta que tiene que salir mañana, manda otro aviso con cuál (aviso de frescura).
// En la misma pasada, y a la par, le pide al modelo que estime cuánto aguantan las frutas que todavía no tienen estimación (ADR-0021).
// Va aparte del aviso: no usa sus claves, no lo espera y, si falla, el aviso sale igual y Stock sigue con la tabla.
// Solo la llama el cron: sin el secreto no hace nada. Los registros llevan conteos e ids, nunca direcciones, nombres ni montos.
export const dynamic = "force-dynamic";
// La llamada al modelo tiene su propio tope de 45 s (lib/vida-estimada/sonnet.ts); el aviso solo, unos pocos segundos.
export const maxDuration = 60;

const SIN_CACHE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!cronAutorizado(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    // Con la ruta abierta a internet: sin decir por qué se rechaza. Quien configura mira el registro del servidor.
    if (!process.env.CRON_SECRET) console.error("push: falta CRON_SECRET, el cron no puede autorizarse");
    return NextResponse.json({ error: "no-autorizado" }, { status: 401, headers: SIN_CACHE });
  }

  const ahora = new Date();
  let db: ReturnType<typeof crearClienteServicio>;
  try {
    db = crearClienteServicio();
  } catch (e) {
    console.error("push: no se pudo armar el resumen del día", { error: e instanceof Error ? e.message : "desconocido" });
    return NextResponse.json({ error: "no-se-pudo-armar" }, { status: 502, headers: SIN_CACHE });
  }

  // Arranca ya y se espera al final: nunca lanza (su informe dice cómo salió).
  const vidaUtil: Promise<InformeVida> = estimarLaVidaDelDia(dependenciasDeLaEstimacion(db), ahora).then((informe) => {
    if (informe.motivo === "fallo") console.error("vida estimada: no se pudo estimar esta noche", informe);
    else console.info("vida estimada: estimación de la noche", informe);
    return informe;
  });

  const configuracion = leerConfiguracionPush();
  if (!configuracion.ok) {
    console.error("push: el aviso del día no está configurado", { faltan: configuracion.faltan, problema: configuracion.problema });
    return NextResponse.json({ error: "sin-configurar", faltan: configuracion.faltan, vidaUtil: await vidaUtil }, { status: 503, headers: SIN_CACHE });
  }
  const { vapid, simulador } = configuracion.configuracion;

  try {
    const informe = await enviarElResumenDelDia(
      {
        leerResumen: (fecha) => leerResumenDeLaBase(db, fecha),
        // El aviso de frescura: qué tiene que salir mañana. Va aparte del resumen y, si no se puede leer, el resumen sale igual.
        leerPorSalir: (cuando) => leerPorSalirDeLaBase(db, cuando),
        leerDestinatarios: () => leerDestinatariosDeLaBase(db),
        enviar: (destino, aviso, opciones) => enviarAviso(vapid, destino, aviso, { ...opciones, simulador }),
        anotar: (id, resultado, cuando) => anotarEnLaBase(db, id, resultado, cuando),
      },
      ahora,
    );
    console.info("push: resumen del día", informe);
    return NextResponse.json({ ...informe, vidaUtil: await vidaUtil }, { status: estadoHttpDelInforme(informe), headers: SIN_CACHE });
  } catch (e) {
    console.error("push: no se pudo armar el resumen del día", { error: e instanceof Error ? e.message : "desconocido" });
    return NextResponse.json({ error: "no-se-pudo-armar", vidaUtil: await vidaUtil }, { status: 502, headers: SIN_CACHE });
  }
}
