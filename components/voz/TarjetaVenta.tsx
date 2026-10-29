"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Info, UserRound } from "lucide-react";

import { buscarClientes, confirmarVenta, saldoDe, sugerirPrecios } from "@/app/(app)/acciones-voz";
import { Avatar } from "@/components/ui/Avatar";
import { Boton } from "@/components/ui/Boton";
import { useEspera } from "@/components/ui/Espera";
import { IconoFruta } from "@/components/ui/IconoFruta";
import { Insignia } from "@/components/ui/Insignia";
import { Monto } from "@/components/ui/Monto";
import { Sello } from "@/components/ui/Sello";
import { formatearCajas, formatearSoles } from "@/lib/formato";
import { iniciales, tonoDe } from "@/lib/operaciones-reglas";
import { borradorDe, faltaDe, frasesFalta, fueCorregido, totalDe, type Borrador, type ItemBorrador } from "@/lib/voz/confirmar-venta-reglas";
import type { Tarjeta } from "@/lib/voz/tarjeta-reglas";
import { EditorBusqueda } from "./EditorBusqueda";
import { EditorItem } from "./EditorItem";
import { FilaTarjeta } from "./FilaTarjeta";
import { MedidorDeuda } from "./MedidorDeuda";
import { PagoODebe } from "./PagoODebe";
import { sonarGuardado, vibrar } from "./senales";

type Venta = Extract<Tarjeta, { tipo: "venta" }>;
type Vista = { tipo: "tarjeta" } | { tipo: "cliente" } | { tipo: "item"; n: number };

type Props = {
  tarjeta: Venta;
  comandoId: number;
  latenciaMs: number;
  /** La base respondió que se guardó (la hoja muestra el sello y se cierra sola). */
  alGuardar: () => void;
  /** `incierto`: el último Confirmar no tuvo respuesta; pudo haberse guardado y el aviso no puede decir «no guardé». */
  alDescartar: (incierto: boolean) => void;
  /** Mientras guarda, la hoja no se cierra ni se descarta: la pantalla no puede decir «no guardé» de algo que se guardó. */
  alCambiarGuardando: (guardando: boolean) => void;
};

const SIN_SENAL = "No se pudo guardar. Revisa tu señal e inténtalo otra vez.";
// Toda llamada lleva tope (CLAUDE.md, «La voz»). Sin él, con la red colgada, «Guardando…» no terminaba nunca (/chaos).
const TOPE_CONFIRMAR_MS = 15_000;
const SIN_RESPUESTA = "La señal no respondió y no sé si se guardó. Toca Confirmar otra vez: no se va a repetir.";
const mismoNombre = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base" }) === 0;
const pieza = (n: number) => ({ animationDelay: `${120 + n * 55}ms` });

// La tarjeta de una venta dictada (CLAUDE.md, «La voz»): lo que se entendió en grande, cada dato tocable para corregirlo,
// ¿pagó o lo debe? si no se dijo, y un solo Confirmar. Guarda por la server action; el éxito se muestra cuando la base
// respondió. Un segundo toque no duplica: el botón se bloquea y registrar_venta es idempotente por comando.
export function TarjetaVenta({ tarjeta, comandoId, latenciaMs, alGuardar, alDescartar, alCambiarGuardando }: Props) {
  const [borrador, setBorrador] = useState<Borrador>(() => borradorDe(tarjeta));
  const [vista, setVista] = useState<Vista>({ tipo: "tarjeta" });
  const [saldo, setSaldo] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; sinSesion: boolean } | null>(null);
  const [guardada, setGuardada] = useState<{ saldo: number | null } | null>(null);
  const enviando = useRef(false);
  const incierto = useRef(false);
  const esperar = useEspera();
  const router = useRouter();

  const clienteId = borrador.cliente?.id ?? null;
  useEffect(() => {
    if (clienteId === null) return;
    let vigente = true;
    void saldoDe(clienteId)
      .catch(() => null)
      .then((s) => vigente && setSaldo(s));
    return () => {
      vigente = false;
    };
  }, [clienteId]);

  const total = totalDe(borrador);
  const falta = faltaDe(borrador);

  async function elegirCliente(cliente: Borrador["cliente"]) {
    setVista({ tipo: "tarjeta" });
    setSaldo(null);
    setBorrador((b) => ({ ...b, cliente }));
    // Los precios sugeridos eran del cliente anterior: se piden los de este. Los dichos no se tocan.
    const sugeridos = borrador.items.map((it, n) => ({ n, id: it.productoId })).filter((x) => x.id !== null && borrador.items[x.n]!.sugerido);
    if (sugeridos.length === 0) return;
    const precios = await sugerirPrecios(cliente?.id ?? null, sugeridos.map((x) => x.id!)).catch(() => null);
    if (!precios) return;
    setBorrador((b) => ({
      ...b,
      items: b.items.map((it, n) => {
        const i = sugeridos.findIndex((x) => x.n === n);
        return i === -1 || !it.sugerido ? it : { ...it, precio: precios[i] ?? null, sugerido: precios[i] != null };
      }),
    }));
  }

  async function confirmar() {
    if (enviando.current || falta.length > 0) return;
    enviando.current = true;
    setGuardando(true);
    alCambiarGuardando(true);
    setError(null);
    let reloj = 0;
    const tope = new Promise<{ ok: false; error: string }>((resolve) => {
      reloj = window.setTimeout(() => resolve({ ok: false, error: SIN_RESPUESTA }), TOPE_CONFIRMAR_MS);
    });
    const guardado = confirmarVenta({ comandoId, borrador, corregido: fueCorregido(tarjeta, borrador), latenciaMs }).catch(() => ({
      ok: false as const,
      error: SIN_SENAL,
    }));
    const r = await esperar(Promise.race([guardado, tope]));
    window.clearTimeout(reloj);
    setGuardando(false);
    alCambiarGuardando(false);
    if (!r.ok) {
      // Se puede volver a tocar: si la primera sí llegó a la base, registrar_venta devuelve la misma venta.
      enviando.current = false;
      incierto.current = r.error === SIN_RESPUESTA;
      setError({ mensaje: r.error, sinSesion: "sinSesion" in r && r.sinSesion === true });
      return;
    }
    setGuardada({ saldo: r.saldo });
    vibrar(30);
    sonarGuardado();
    alGuardar();
    // «Hoy» (lo vendido, lo último, la deuda) se rearma por detrás mientras el sello se anima.
    startTransition(() => router.refresh());
  }

  if (guardada) {
    const nombre = borrador.cliente?.nombre;
    return (
      <div role="status" className="grid justify-items-center gap-1 py-5 text-center">
        <Sello />
        <p className="mt-3 text-2xl font-extrabold">Venta guardada</p>
        {nombre && guardada.saldo !== null && (
          <p className="text-lg text-texto-suave">
            {guardada.saldo > 0 ? (
              <>
                {nombre} te debe <strong className="cifra text-deuda">{formatearSoles(guardada.saldo)}</strong>
              </>
            ) : (
              `${nombre} no te debe nada`
            )}
          </p>
        )}
      </div>
    );
  }

  if (vista.tipo !== "tarjeta") {
    const volver = () => setVista({ tipo: "tarjeta" });
    return (
      <div className="grid animate-pieza gap-3">
        <button type="button" onClick={volver} className="-ml-2 flex min-h-12 items-center gap-1 justify-self-start px-2 font-extrabold text-acento-texto">
          <ChevronLeft aria-hidden />
          Volver a la venta
        </button>
        {vista.tipo === "cliente" ? (
          <EditorBusqueda
            etiqueta="¿A quién le vendiste?"
            inicial={borrador.cliente?.nombre ?? tarjeta.cliente.dicho ?? ""}
            opciones={tarjeta.cliente.opciones.map((o) => ({ ...o, detalle: null }))}
            buscar={buscarClientes}
            alElegir={(o) => void elegirCliente({ id: o.id, nombre: o.nombre })}
            icono={(o) => <Avatar iniciales={iniciales(o.nombre)} tono={tonoDe(o.id)} />}
            sinResultados="No encuentro a nadie así. Prueba con otro nombre o apodo."
            extra={
              borrador.condicion !== "credito" && (
                <Boton variante="secundario" onClick={() => void elegirCliente(null)}>
                  Cliente de paso (sin nombre)
                </Boton>
              )
            }
          />
        ) : (
          <EditorItem
            item={borrador.items[vista.n]!}
            opciones={tarjeta.items[vista.n]?.producto.opciones ?? []}
            clienteId={clienteId}
            alListo={(item: ItemBorrador) => {
              setBorrador((b) => ({ ...b, items: b.items.map((it, n) => (n === vista.n ? item : it)) }));
              volver();
            }}
          />
        )}
      </div>
    );
  }

  const { cliente } = borrador;
  // «Pagó / Lo debe» ya lleva su pregunta escrita encima: el pie no la repite (/formidable 2026-10-29).
  const aviso = frasesFalta(falta.filter((f) => f !== "condicion"));
  return (
    <div className="grid gap-2">
      <FilaTarjeta
        style={pieza(0)}
        className="animate-pieza"
        falta={falta.includes("cliente")}
        onClick={() => setVista({ tipo: "cliente" })}
        icono={
          cliente ? (
            <Avatar iniciales={iniciales(cliente.nombre)} tono={tonoDe(cliente.id)} />
          ) : (
            <span className="grid size-12 place-items-center rounded-full bg-texto/8 text-texto-suave">
              <UserRound aria-hidden />
            </span>
          )
        }
        grande={cliente?.nombre ?? (tarjeta.cliente.dicho ? `¿${tarjeta.cliente.dicho}?` : "Sin cliente")}
        chico={
          cliente
            ? // Lo que dijo, para reconocer al cliente por su apodo: «Luis Paredes» puede no sonarle a «don Lucho» (/formidable).
              tarjeta.cliente.dicho && !mismoNombre(tarjeta.cliente.dicho, cliente.nombre)
              ? `dijiste «${tarjeta.cliente.dicho}»`
              : undefined
            : tarjeta.cliente.dicho
              ? "Toca para elegir quién es"
              : "Cliente de paso"
        }
      />
      {borrador.items.map((item, n) => (
        <FilaTarjeta
          key={n}
          style={pieza(n + 1)}
          className="animate-pieza"
          falta={item.productoId === null || item.precio === null}
          onClick={() => setVista({ tipo: "item", n })}
          icono={<IconoFruta nombre={item.producto || "?"} tamano={48} />}
          grande={item.productoId === null ? `¿${item.producto}?` : `${formatearCajas(item.cantidad)} de ${item.producto}`}
          chico={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="cifra">
                {item.productoId === null ? "Toca para elegir la fruta" : item.precio === null ? "Toca para poner el precio" : `${formatearSoles(item.precio)} la caja`}
              </span>
              {item.sugerido && (
                <Insignia tipo="sugerido" className="relative overflow-hidden">
                  sugerido
                  <span aria-hidden className="absolute inset-0 animate-barrido bg-linear-[100deg] from-transparent from-30% via-superficie/70 to-transparent to-70%" />
                </Insignia>
              )}
            </span>
          }
        />
      ))}

      {/* Las dudas del intérprete, junto a lo que se entendió: abajo quedaban tapadas por Confirmar (/formidable 2026-10-29). */}
      {tarjeta.dudas.map((duda) => (
        <p key={duda} className="mx-1 flex items-start gap-2 text-texto-suave">
          <Info aria-hidden className="mt-1 size-[18px] shrink-0" />
          {duda}
        </p>
      ))}

      <div className="mx-1 mt-1 mb-1 flex animate-pieza items-baseline justify-between gap-3" style={pieza(borrador.items.length + 1)}>
        <span className="text-lg font-bold text-texto-suave">{borrador.descuento > 0 ? `Total, con ${formatearSoles(borrador.descuento)} de rebaja` : "Total"}</span>
        {total === null ? (
          <span className="text-lg font-bold text-deuda">Falta el precio</span>
        ) : (
          <Monto valor={total} tamano="total" className="origin-right animate-saltar" />
        )}
      </div>

      <div className="animate-pieza" style={pieza(borrador.items.length + 2)}>
        <PagoODebe
          condicion={borrador.condicion}
          medio={borrador.medio}
          alCambiar={(condicion, medio) => setBorrador((b) => ({ ...b, condicion, medio }))}
        />
      </div>

      {cliente && saldo !== null && total !== null && borrador.condicion !== null && (
        <div className="animate-pieza">
          <MedidorDeuda nombre={cliente.nombre} saldo={saldo} total={total} alCredito={borrador.condicion === "credito"} />
        </div>
      )}

      {/* Pegado abajo de la hoja: con «Pagó», los medios y la deuda, a 360 px Confirmar se iba debajo del borde (regla 1).
          El borde inferior negativo iguala al margen: sin scroll no sube, y no tapa lo de arriba. */}
      <div
        className="sticky -bottom-[calc(16px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-1 -mb-[calc(16px+env(safe-area-inset-bottom))] grid animate-pieza gap-1 bg-fondo px-4 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_-12px_16px_-12px_rgb(var(--sombra-color)/0.25)] md:static md:m-0 md:p-0 md:shadow-none"
        style={pieza(borrador.items.length + 3)}
      >
        {(aviso || error) && (
          <p role={error ? "alert" : undefined} className="mx-1 mb-1 font-bold text-deuda">
            {error?.mensaje ?? aviso}
          </p>
        )}
        {error?.sinSesion && (
          <Boton variante="secundario" onClick={() => router.push("/login")}>
            Entrar otra vez
          </Boton>
        )}
        <Boton
          onClick={() => void confirmar()}
          cargando={guardando}
          disabled={falta.length > 0}
          // Mientras falta algo, la variante secundaria: texto oscuro que se lee al sol (blanco sobre un botón apagado no).
          variante={falta.length > 0 ? "secundario" : "principal"}
          className={falta.length > 0 ? "min-h-[68px] w-full text-[22px]" : undefined}
        >
          {/* Si solo falta eso, el botón mismo dice qué hacer: la pregunta está justo arriba (2.ª prueba ciega, /formidable). */}
          {falta.length === 1 && falta[0] === "condicion" ? "Primero: ¿pagó o lo debe?" : "Confirmar venta"}
        </Boton>
        <Boton variante="texto" onClick={() => alDescartar(incierto.current)} disabled={guardando}>
          Descartar
        </Boton>
      </div>
    </div>
  );
}
