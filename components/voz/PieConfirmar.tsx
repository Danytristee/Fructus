"use client";

import { useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";

import { useCola } from "@/components/cola/ColaProveedor";

import { Boton } from "@/components/ui/Boton";
import { PieFijo } from "@/components/ui/PieFijo";

type Props = {
  /** Lo que falta para poder confirmar, en una frase; null si no falta nada. */
  aviso: string | null;
  error: { mensaje: string; sinSesion: boolean } | null;
  guardando: boolean;
  /** Se puede confirmar: no falta nada. */
  listo: boolean;
  /** A mano (A8): lo que falta se dice como instrucción, en texto normal, no en rojo. Los errores siguen en rojo. */
  avisoNeutro?: boolean;
  /** Lo que dice el segundo botón si «Descartar» no se entiende: al anular una venta, «No, dejarla». */
  etiquetaDescartar?: string;
  /** «Confirmar venta», «Confirmar abono». */
  etiqueta: string;
  /** Lo que dice el botón mientras no está listo, si lo que falta está justo arriba («Primero: ¿pagó o lo debe?»). */
  etiquetaPendiente?: string;
  alConfirmar: () => void;
  alDescartar: () => void;
  /** Las tarjetas de voz y a mano: sin señal se guardan en el celular (ADR-0019). Las demás hojas necesitan señal para guardar. */
  guardaSinSenal?: boolean;
  /** Una línea sobre los botones con lo que hace la voz en manos libres («Te la estoy leyendo…», ADR-0020), con su icono. */
  nota?: React.ReactNode;
  style?: React.CSSProperties;
};

// El pie de toda tarjeta de voz: qué falta o qué falló, Confirmar y Descartar. Va pegado abajo de la hoja (`PieFijo`): con todo lo de
// arriba, a 360 px Confirmar se iba debajo del borde (regla 1).
export function PieConfirmar({ aviso, error, guardando, listo, avisoNeutro = false, etiqueta, etiquetaPendiente, etiquetaDescartar = "Descartar", alConfirmar, alDescartar, guardaSinSenal = false, nota, style }: Props) {
  const router = useRouter();
  // Con la hoja abierta, el velo tapa la franja de arriba: sin señal se dice aquí, antes de tocar (/formidable 2026-11-12).
  const sinSenal = useCola()?.situacion.enLinea === false;
  return (
    <PieFijo className="animate-pieza gap-2" style={style}>
      {sinSenal && !error && (
        <p className="mx-1 mb-1 flex items-start gap-2 font-bold text-texto">
          <WifiOff aria-hidden className="mt-0.5 size-5 shrink-0 text-acento-texto" />
          {guardaSinSenal ? "Sin señal: se guarda en el celular y se envía cuando vuelva." : "Sin señal: para guardar esto necesitas señal."}
        </p>
      )}
      {nota && !error && (
        <p role="status" className="mx-1 mb-1 flex items-start gap-2 font-bold text-texto">
          {nota}
        </p>
      )}
      {(aviso || error) && (
        <p role={error ? "alert" : undefined} className={`mx-1 mb-1 font-bold ${!error && avisoNeutro ? "text-texto" : "text-deuda"}`}>
          {error?.mensaje ?? aviso}
        </p>
      )}
      {error?.sinSesion && (
        <Boton variante="secundario" onClick={() => router.push("/login")}>
          Entrar otra vez
        </Boton>
      )}
      <Boton
        onClick={alConfirmar}
        cargando={guardando}
        disabled={!listo}
        // Mientras falta algo, la variante secundaria: texto oscuro que se lee al sol (blanco sobre un botón apagado no).
        variante={listo ? "principal" : "secundario"}
        className={listo ? undefined : "min-h-[68px] w-full text-[22px]"}
      >
        {!listo && etiquetaPendiente ? etiquetaPendiente : etiqueta}
      </Boton>
      <Boton variante="texto" onClick={alDescartar} disabled={guardando}>
        {etiquetaDescartar}
      </Boton>
    </PieFijo>
  );
}
