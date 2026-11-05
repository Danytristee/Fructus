"use client";

import { useRouter } from "next/navigation";

import { Boton } from "@/components/ui/Boton";

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
  style?: React.CSSProperties;
};

// El pie de toda tarjeta de voz: qué falta o qué falló, Confirmar y Descartar. Pegado abajo de la hoja: con todo lo de
// arriba, a 360 px Confirmar se iba debajo del borde (regla 1). El borde inferior negativo iguala al margen: sin scroll no
// sube, y no tapa lo de arriba.
export function PieConfirmar({ aviso, error, guardando, listo, avisoNeutro = false, etiqueta, etiquetaPendiente, etiquetaDescartar = "Descartar", alConfirmar, alDescartar, style }: Props) {
  const router = useRouter();
  return (
    <div
      className="sticky -bottom-[calc(16px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-1 -mb-[calc(16px+env(safe-area-inset-bottom))] grid animate-pieza gap-2 bg-fondo px-4 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_-12px_16px_-12px_rgb(var(--sombra-color)/0.25)] md:-bottom-5 md:-mb-5"
      style={style}
    >
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
    </div>
  );
}
