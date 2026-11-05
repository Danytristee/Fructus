"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { abrirComandoAMano, type IntencionAMano, type ResultadoComandoAMano } from "@/app/(app)/acciones-a-mano";
import { descartarComando } from "@/app/(app)/acciones-voz";
import { Boton } from "@/components/ui/Boton";
import { NO_ABRIO } from "@/lib/a-mano-reglas";
import type { Tarjeta } from "@/lib/voz/tarjeta-reglas";
import type { ResultadoVoz } from "./VozHoy";

// La hoja llega en diferido, como en «Hoy»: no pesa en la primera carga. Se pide por detrás apenas la pantalla queda
// lista, para que al tocar el botón suba sin esperar.
const cargarHoja = () => import("./HojaVoz").then((m) => m.HojaVoz);
const HojaVoz = dynamic(cargarHoja, { ssr: false });

// Abrir el comando es una ida al servidor: con la señal colgada, el botón no puede quedarse girando para siempre.
const TOPE_ABRIR_MS = 10_000;

type Props = {
  intencion: IntencionAMano;
  /** La tarjeta vacía, o con lo que ya se sabe (el cliente de su ficha, la fruta de su fila). */
  tarjeta: Tarjeta;
  /** El título de la hoja: «Registrar abono». */
  titulo: string;
  icono: React.ReactNode;
  /** El texto del botón; si no se dice, el título. */
  etiqueta?: string;
  /**
   * `flotante`: una píldora de la acción de la pantalla; va dentro de una `BarraFlotante`, que la pone sobre la barra de abajo
   * donde el pulgar la alcanza. `fila`: un botón normal dentro de la pantalla, junto a lo que registra.
   */
  variante: "flotante" | "fila";
};

// Registrar a mano lo mismo que se registra por voz (A8): la misma tarjeta de confirmación, llenada con lo que se toca.
// Abre un comando «a mano» al tocar, para que un doble toque o una respuesta perdida no guarden dos veces.
export function OperacionAMano({ intencion, tarjeta, titulo, icono, etiqueta, variante }: Props) {
  const [resultado, setResultado] = useState<ResultadoVoz | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void cargarHoja();
  }, []);

  async function abrir() {
    if (abriendo) return;
    setAbriendo(true);
    setError(null);
    let reloj = 0;
    const tope = new Promise<ResultadoComandoAMano>((resolve) => {
      reloj = window.setTimeout(() => resolve({ ok: false, error: NO_ABRIO }), TOPE_ABRIR_MS);
    });
    const r = await Promise.race([abrirComandoAMano(intencion).catch((): ResultadoComandoAMano => ({ ok: false, error: NO_ABRIO })), tope]);
    window.clearTimeout(reloj);
    setAbriendo(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    // Cada vez es un comando nuevo: lo que se dejó a medias la vez anterior no vuelve a aparecer.
    setResultado({ comandoId: r.comandoId, tarjeta, latenciaMs: 0 });
    setAbierta(true);
  }

  function alCerrar(motivo: "guardada" | "descartada") {
    setAbierta(false);
    if (motivo === "descartada" && resultado) void descartarComando(resultado.comandoId, 0).catch(() => {});
  }

  const aviso = error && (
    <p role="alert" className="pointer-events-auto w-full rounded-control bg-superficie px-3.5 py-2.5 font-bold text-deuda ring-2 ring-deuda">
      {error}
    </p>
  );

  return (
    <>
      {variante === "flotante" ? (
        <>
          {aviso}
          <Boton variante="flotante" onClick={() => void abrir()} cargando={abriendo} className="pointer-events-auto">
            {icono}
            {etiqueta ?? titulo}
          </Boton>
        </>
      ) : (
        <div className="grid gap-2">
          {aviso}
          <Boton variante="secundario" onClick={() => void abrir()} cargando={abriendo} className="w-full">
            {icono}
            {etiqueta ?? titulo}
          </Boton>
        </div>
      )}
      {resultado && <HojaVoz resultado={resultado} abierta={abierta} alCerrar={alCerrar} titulo={titulo} icono={icono} aMano />}
    </>
  );
}
