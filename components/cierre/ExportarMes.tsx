"use client";

import { useState } from "react";
import { CircleCheck, Download, FileSpreadsheet } from "lucide-react";

import { filaDelMenu, iconoDelMenu } from "@/components/marco/menu-estilos";
import { Aviso } from "@/components/ui/Aviso";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { vibrar } from "@/components/voz/senales";

type Mes = { mes: string; etiqueta: string; enCurso: boolean };
type Estado = { mes: string; fase: "preparando" | "listo" } | null;

const SIN_SENAL = "Revisa tu señal e inténtalo otra vez. Lo que registraste está a salvo.";

/** Lo que dice el servidor ya viene en lenguaje de puesto; si no llegó nada legible, el aviso de siempre. */
async function mensajeDe(respuesta: Response): Promise<string> {
  try {
    const cuerpo: unknown = await respuesta.json();
    if (cuerpo && typeof cuerpo === "object" && "error" in cuerpo && typeof cuerpo.error === "string") return cuerpo.error;
  } catch {
    // Una respuesta que no es JSON (un corte en el camino): se dice lo de siempre, abajo.
  }
  return SIN_SENAL;
}

/** Entrega el archivo al navegador, que lo guarda en las descargas del teléfono. */
function guardarArchivo(archivo: Blob, nombre: string) {
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 60_000);
}

// El mes en un Excel para el contador. Una fila por mes, un toque: baja el archivo. No guarda nada en la base (solo lee).
export function ExportarMes({ meses }: { meses: Mes[] }) {
  const [estado, setEstado] = useState<Estado>(null);
  const [error, setError] = useState<string | null>(null);
  const ocupado = estado?.fase === "preparando";

  async function descargar(mes: string) {
    if (ocupado) return; // un archivo a la vez
    setError(null);
    setEstado({ mes, fase: "preparando" });
    try {
      const respuesta = await fetch(`/api/exportar?mes=${mes}`, { signal: AbortSignal.timeout(40_000) });
      if (!respuesta.ok) {
        setError(await mensajeDe(respuesta));
        setEstado(null);
        return;
      }
      guardarArchivo(await respuesta.blob(), `fructus-${mes}.xlsx`);
      vibrar(30);
      setEstado({ mes, fase: "listo" });
    } catch (e) {
      console.error("exportar: no se pudo bajar el mes", { mes, error: e instanceof Error ? e.name : "desconocido" });
      setError(SIN_SENAL);
      setEstado(null);
    }
  }

  const hecho = estado?.fase === "listo" ? meses.find((m) => m.mes === estado.mes) : undefined;

  return (
    <Tarjeta className="grid animate-subir gap-3 [animation-delay:200ms]">
      <div className="grid gap-1">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <FileSpreadsheet aria-hidden className="size-5 text-acento-texto" /> Excel para tu contador
        </h2>
        <p className="text-texto-suave">Ventas, abonos, compras, gastos y mermas. Lo anulado se ve marcado y no suma.</p>
      </div>

      {/* El aviso va arriba de las filas, no debajo: con seis meses la lista es larga y abajo quedaría lejos del dedo que acaba de tocar. */}
      {hecho && (
        <Aviso tipo="exito" titulo={`Listo: ${hecho.etiqueta}`}>
          Búscalo en las descargas de tu teléfono.
        </Aviso>
      )}
      {error && <Aviso titulo="No pudimos armar el Excel">{error}</Aviso>}

      <ul className="grid gap-2">
        {meses.map((m) => {
          const preparando = estado?.mes === m.mes && estado.fase === "preparando";
          const listo = estado?.mes === m.mes && estado.fase === "listo";
          return (
            <li key={m.mes}>
              <button
                type="button"
                onClick={() => void descargar(m.mes)}
                disabled={ocupado}
                aria-busy={preparando || undefined}
                aria-label={`Descargar el Excel de ${m.etiqueta}`}
                className={`${filaDelMenu} disabled:opacity-100 ${ocupado && !preparando ? "opacity-60" : ""}`}
              >
                <span className={`${iconoDelMenu} bg-exito-fondo text-exito`}>
                  <FileSpreadsheet aria-hidden className="size-6" />
                </span>
                <span className="grid">
                  <span>{m.etiqueta}</span>
                  <span className="text-base font-normal text-texto-suave">{preparando ? "Preparando el Excel…" : m.enCurso ? "Hasta hoy" : "Mes completo"}</span>
                </span>
                {preparando ? (
                  <span aria-hidden className="size-6 animate-girar rounded-full border-[3px] border-acento-texto border-r-transparent" />
                ) : listo ? (
                  <CircleCheck aria-hidden className="size-6 text-exito" />
                ) : (
                  <Download aria-hidden className="size-6 text-texto-suave" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}
