import { NextResponse } from "next/server";

import { cronAutorizado } from "@/lib/push/cron";
import { enviarAviso } from "@/lib/push/enviar";
import { enviarElResumenDelDia, estadoHttpDelInforme } from "@/lib/push/resumen-diario";
import { anotarEnLaBase, leerConfiguracionPush, leerDestinatariosDeLaBase, leerPorSalirDeLaBase, leerResumenDeLaBase } from "@/lib/push/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";

// El aviso del día: Vercel llama a esta ruta una vez al día (vercel.json, «0 0 * * *» = las 7 p. m. de Lima; en el plan Hobby corre
// dentro de esa hora). Lee el día, y si hubo ventas o abonos, se lo manda a cada teléfono que lo pidió. Ver ADR-0013. Después, si hay
// fruta que tiene que salir mañana, manda otro aviso con cuál (aviso de frescura).
// Solo la llama el cron: sin el secreto no hace nada. Los registros llevan conteos e ids, nunca direcciones, nombres ni montos.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SIN_CACHE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!cronAutorizado(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    // Con la ruta abierta a internet: sin decir por qué se rechaza. Quien configura mira el registro del servidor.
    if (!process.env.CRON_SECRET) console.error("push: falta CRON_SECRET, el cron no puede autorizarse");
    return NextResponse.json({ error: "no-autorizado" }, { status: 401, headers: SIN_CACHE });
  }

  const configuracion = leerConfiguracionPush();
  if (!configuracion.ok) {
    console.error("push: el aviso del día no está configurado", { faltan: configuracion.faltan, problema: configuracion.problema });
    return NextResponse.json({ error: "sin-configurar", faltan: configuracion.faltan }, { status: 503, headers: SIN_CACHE });
  }
  const { vapid, simulador } = configuracion.configuracion;

  try {
    const db = crearClienteServicio();
    const informe = await enviarElResumenDelDia(
      {
        leerResumen: (fecha) => leerResumenDeLaBase(db, fecha),
        // El aviso de frescura: qué tiene que salir mañana. Va aparte del resumen y, si no se puede leer, el resumen sale igual.
        leerPorSalir: (ahora) => leerPorSalirDeLaBase(db, ahora),
        leerDestinatarios: () => leerDestinatariosDeLaBase(db),
        enviar: (destino, aviso, opciones) => enviarAviso(vapid, destino, aviso, { ...opciones, simulador }),
        anotar: (id, resultado, ahora) => anotarEnLaBase(db, id, resultado, ahora),
      },
      new Date(),
    );
    console.info("push: resumen del día", informe);
    return NextResponse.json(informe, { status: estadoHttpDelInforme(informe), headers: SIN_CACHE });
  } catch (e) {
    console.error("push: no se pudo armar el resumen del día", { error: e instanceof Error ? e.message : "desconocido" });
    return NextResponse.json({ error: "no-se-pudo-armar" }, { status: 502, headers: SIN_CACHE });
  }
}
