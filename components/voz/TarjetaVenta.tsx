"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";

import { buscarClientes, confirmarVenta, saldoDe, sugerirPrecios } from "@/app/(app)/acciones-voz";
import { Avatar } from "@/components/ui/Avatar";
import { Boton } from "@/components/ui/Boton";
import { IconoFruta } from "@/components/ui/IconoFruta";
import { Insignia } from "@/components/ui/Insignia";
import { Monto } from "@/components/ui/Monto";
import { formatearCajas, formatearSoles } from "@/lib/formato";
import { iniciales, tonoDe } from "@/lib/operaciones-reglas";
import { borradorDe, faltaDe, frasesFalta, fueCorregido, leerPrecio, totalDe, ventaActual, type Borrador, type ItemBorrador } from "@/lib/voz/confirmar-venta-reglas";
import { cambiosDeCorreccion, guionCorreccion, guionVenta, relecturaPago, type Cambios } from "@/lib/voz/lectura-reglas";
import type { Tarjeta } from "@/lib/voz/tarjeta-reglas";
import { EditorBusqueda } from "./EditorBusqueda";
import { AvisosStock } from "./AvisosStock";
import { DudasVoz } from "./DudasVoz";
import { EditorItem } from "./EditorItem";
import { FilaCliente } from "./FilaCliente";
import { FilaTarjeta } from "./FilaTarjeta";
import { GrupoOpciones } from "./GrupoOpciones";
import { manosLibres } from "./manos-libres";
import { notaDeVoz } from "./NotaVoz";
import { EnCola } from "./EnCola";
import { Guardado } from "./Guardado";
import { InsigniaSugerido } from "./InsigniaSugerido";
import { MedidorDeuda } from "./MedidorDeuda";
import { PagoODebe } from "./PagoODebe";
import { PieConfirmar } from "./PieConfirmar";
import { useConfirmar } from "./useConfirmar";
import { useManosLibres } from "./useManosLibres";

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

const pieza = (n: number) => ({ animationDelay: `${120 + n * 55}ms` });

// La tarjeta de una venta dictada (CLAUDE.md, «La voz»): lo que se entendió en grande, cada dato tocable para corregirlo,
// ¿pagó o lo debe? si no se dijo, y un solo Confirmar. Guarda por la server action; el éxito se muestra cuando la base
// respondió. Un segundo toque no duplica: el botón se bloquea y registrar_venta es idempotente por comando.
export function TarjetaVenta({ tarjeta, comandoId, latenciaMs, alGuardar, alDescartar, alCambiarGuardando }: Props) {
  const [borrador, setBorrador] = useState<Borrador>(() => borradorDe(tarjeta));
  // La tarjeta que se muestra: la dictada, o la que dejó una corrección hablada (lo que se dijo, las opciones y las dudas).
  const [vigente, setVigente] = useState(tarjeta);
  const [vista, setVista] = useState<Vista>({ tipo: "tarjeta" });
  const [saldo, setSaldo] = useState<number | null>(null);
  // Lo que cambió la última corrección hablada, para marcarlo «corregido» mientras la venta siga tal cual la dejó la voz: tocar y
  // cambiar algo a mano la reemplaza, y la marca se va (/formidable 2026-11-17).
  const [corregida, setCorregida] = useState<{ borrador: Borrador; cambios: Cambios } | null>(null);
  const { confirmar: enviar, guardando, error, guardado: guardada, encolado, incierto } = useConfirmar<{ ok: true; saldo: number | null; comprobante: string | null }>({ alGuardar, alCambiarGuardando });
  // Manos libres (ADR-0020): al abrirse, la venta lista se lee en voz alta y se confirma diciendo «confirmo»; si falta saber si pagó,
  // se pregunta primero. Con dudas o si falta otro dato, solo se avisa y se toca. La tarjeta se monta solo en el navegador (la hoja no
  // tiene SSR): se puede leer el celular al empezar.
  // Con el stock que trajo la tarjeta: si la venta pide más, el aviso también se dice (con las manos llenas no se mira).
  const [guion] = useState(() => (manosLibres() ? guionVenta(borradorDe(tarjeta), tarjeta.dudas, tarjeta.stock) : null));
  const voz = useManosLibres({
    guion,
    alConfirmar: () => confirmar("voz"),
    // «¿Pagó o lo debe?» respondido por voz: se anota en la tarjeta (se ve en la píldora) y se repite la respuesta con «¿Confirmo?».
    // La venta no se vuelve a leer entera: se acaba de oír al preguntar.
    alPago: (pago) => {
      const nuevo = { ...borrador, condicion: pago.condicion, medio: pago.medio };
      setBorrador(nuevo);
      return relecturaPago(nuevo, vigente.stock);
    },
    // «No, son ocho cajas»: la tarjeta corregida reemplaza a la dictada (lo que se ve, las opciones y las dudas) y se dice solo lo que
    // cambió («Corregido. 8 cajas… Total, 360 soles. ¿Confirmo?»): el resto se acaba de oír. Al guardar cuenta como corregida, porque
    // se compara con lo dictado al principio.
    alCorregir: (nueva) => {
      const b = borradorDe(nueva);
      setVigente(nueva);
      setBorrador(b);
      setCorregida({ borrador: b, cambios: cambiosDeCorreccion(borrador, b) });
      // Lo que ya debía es del cliente, no de la venta: solo se vuelve a pedir si la corrección cambió de cliente. Antes se borraba
      // siempre y, con el mismo cliente, «te debe» desaparecía y no volvía (/formidable 2026-11-17).
      if ((b.cliente?.id ?? null) !== (borrador.cliente?.id ?? null)) setSaldo(null);
      return guionCorreccion(borrador, b, nueva.dudas, nueva.stock);
    },
    ventaActual: () => ventaActual(borrador),
    guardado: guardada !== null,
  });

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
  const marcas = corregida?.borrador === borrador ? corregida.cambios : null;
  const corregido = <Insignia tipo="corregido">corregido</Insignia>;

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

  function confirmar(confirmadoPor: "toque" | "voz" = "toque") {
    if (falta.length > 0) return;
    const entrada = { comandoId, borrador, corregido: fueCorregido(tarjeta, borrador), latenciaMs, confirmadoPor };
    // Con los datos, no solo la función: sin señal se guarda en el celular y se envía solo después (ADR-0019).
    void enviar(() => confirmarVenta(entrada), { tipo: "venta", entrada });
  }

  if (encolado) return <EnCola tipo="venta" />;

  if (guardada) {
    const nombre = borrador.cliente?.nombre;
    return (
      <Guardado titulo="Venta guardada">
        {nombre && guardada.saldo !== null &&
          (guardada.saldo > 0 ? (
            <>
              {nombre} te debe <strong className="cifra text-deuda">{formatearSoles(guardada.saldo)}</strong>
            </>
          ) : (
            `${nombre} no te debe nada`
          ))}
        {/* En qué quedó el comprobante que se pidió: la venta ya está guardada pase lo que pase con él. */}
        {guardada.comprobante && <span className="mt-1 block">{guardada.comprobante}</span>}
      </Guardado>
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
            inicial={borrador.cliente?.nombre ?? vigente.cliente.dicho ?? ""}
            opciones={vigente.cliente.opciones.map((o) => ({ ...o, detalle: null }))}
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
            opciones={vigente.items[vista.n]?.producto.opciones ?? []}
            monto={{
              etiqueta: "Precio de la caja",
              leer: leerPrecio,
              sugerir: (id) => sugerirPrecios(clienteId, [id]).then((p) => p?.[0] ?? null),
            }}
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
    // Tocar la tarjeta es tomar el control: la lectura se calla para que se pueda corregir o confirmar sin oírla encima.
    <div className="grid gap-2" onPointerDown={voz.fase === "callado" ? undefined : voz.tomarControl}>
      <FilaCliente
        style={pieza(0)}
        className="animate-pieza"
        cliente={cliente}
        dicho={vigente.cliente.dicho}
        falta={falta.includes("cliente")}
        sinNombre="Cliente de paso"
        alTocar={() => setVista({ tipo: "cliente" })}
        insignia={marcas?.cliente ? corregido : undefined}
      />
      {borrador.items.map((item, n) => (
        <FilaTarjeta
          key={n}
          style={pieza(n + 1)}
          className="animate-pieza"
          falta={item.productoId === null || item.precio === null}
          onClick={() => setVista({ tipo: "item", n })}
          icono={<IconoFruta nombre={item.producto || "?"} tamano={48} />}
          grande={
            <>
              {item.productoId === null ? `¿${item.producto}?` : `${formatearCajas(item.cantidad)} de ${item.producto}`}
              {/* Junto a lo que cambió: las cajas o la fruta aquí, el precio abajo (/formidable 2026-11-17). */}
              {/* Un espacio y no un margen: si la insignia baja de renglón, queda alineada con el texto. */}
              {marcas?.cajas.includes(n) && (
                <>
                  {" "}
                  <span className="inline-block align-middle">{corregido}</span>
                </>
              )}
            </>
          }
          chico={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="cifra">
                {item.productoId === null ? "Toca para elegir la fruta" : item.precio === null ? "Toca para poner el precio" : `${formatearSoles(item.precio)} la caja`}
              </span>
              {item.sugerido && <InsigniaSugerido />}
              {marcas?.precios.includes(n) && corregido}
            </span>
          }
        />
      ))}

      {/* Si la venta pide más cajas de las que hay: avisa, no bloquea. */}
      <AvisosStock items={borrador.items} inicial={vigente.stock} className="animate-pieza" />

      <DudasVoz dudas={vigente.dudas} />

      <div className="mx-1 mt-1 mb-1 flex animate-pieza items-baseline justify-between gap-3" style={pieza(borrador.items.length + 1)}>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-bold text-texto-suave">
          {borrador.descuento > 0 ? `Total, con ${formatearSoles(borrador.descuento)} de rebaja` : "Total"}
          {(marcas?.total || marcas?.rebaja) && corregido}
        </span>
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

      {/* Solo si se pidió comprobante («… factura»): la persona ve lo que se entendió y lo cambia o lo quita de un toque. */}
      {(vigente.comprobante !== "ninguno" || borrador.comprobante !== "ninguno") && (
        <div className="mt-1 grid animate-pieza gap-1.5">
          {/* Con su título: pegada a la fila de medios de pago (Efectivo, Yape…) se leía como la misma pregunta. */}
          <p className="mx-1 font-bold text-texto-suave">Comprobante</p>
          <GrupoOpciones
            pregunta="¿Con comprobante?"
            columnas={3}
            elegido={borrador.comprobante}
            alCambiar={(comprobante) => setBorrador((b) => ({ ...b, comprobante }))}
            opciones={[
              { valor: "ninguno", etiqueta: "Sin comprobante" },
              { valor: "boleta", etiqueta: "Boleta" },
              { valor: "factura", etiqueta: "Factura" },
            ]}
          />
          {/* La venta se guarda igual: la factura es solo para un cliente con RUC, y esto avisa antes si ya se ve que no podrá salir. */}
          {borrador.comprobante === "factura" && !cliente && <p className="mx-1 text-texto-suave">Una factura va a un cliente con RUC: elige a quién.</p>}
        </div>
      )}

      {cliente && saldo !== null && total !== null && borrador.condicion !== null && (
        <div className="animate-pieza">
          <MedidorDeuda nombre={cliente.nombre} saldo={saldo} total={total} alCredito={borrador.condicion === "credito"} />
        </div>
      )}

      <PieConfirmar
          guardaSinSenal
        style={pieza(borrador.items.length + 3)}
        aviso={aviso}
        error={error}
        guardando={guardando}
        listo={falta.length === 0}
        etiqueta="Confirmar venta"
        // Si solo falta eso, el botón mismo dice qué hacer: la pregunta está justo arriba (2.ª prueba ciega, /formidable).
        etiquetaPendiente={falta.length === 1 && falta[0] === "condicion" ? "Primero: ¿pagó o lo debe?" : undefined}
        alConfirmar={() => confirmar("toque")}
        alDescartar={() => alDescartar(incierto.current)}
        nota={notaDeVoz(voz)}
      />
    </div>
  );
}
