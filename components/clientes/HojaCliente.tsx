"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserRound, X } from "lucide-react";

import { buscarParecidos, guardarCliente, type Parecido, type ResultadoGuardarCliente } from "@/app/(app)/acciones-clientes";
import { Campo } from "@/components/ui/Campo";
import { Desplegable } from "@/components/ui/Desplegable";
import { Hoja } from "@/components/ui/Hoja";
import { Guardado } from "@/components/voz/Guardado";
import { GrupoOpciones } from "@/components/voz/GrupoOpciones";
import { PieConfirmar } from "@/components/voz/PieConfirmar";
import { useConfirmar } from "@/components/voz/useConfirmar";
import {
  agregarApodo,
  avisoParecidos,
  BORRADOR_VACIO,
  hayCambios,
  LIMITES,
  primeraFalta,
  validarCliente,
  type BorradorCliente,
  type CampoCliente,
  type TipoDocumento,
} from "@/lib/cliente-reglas";

export type ClienteEditable = { id: number; borrador: BorradorCliente };

type Props = {
  abierta: boolean;
  alCerrar: () => void;
  /** null: se da de alta un cliente nuevo. Con datos: se edita al que ya existe. */
  cliente: ClienteEditable | null;
};

type ClienteGuardado = Extract<ResultadoGuardarCliente, { ok: true }>;
type Opcion = "ninguno" | TipoDocumento;

const OPCIONES_DOCUMENTO = [
  { valor: "ninguno", etiqueta: "Ninguno" },
  { valor: "DNI", etiqueta: "DNI" },
  { valor: "RUC", etiqueta: "RUC" },
] as const;

// El alta y la edición de un cliente: nombre, apodos (como lo busca la voz), teléfono y documento a la vista, y la dirección y
// las notas un toque más abajo. Solo el dueño y el administrador la ven (la base también lo exige).
export function HojaCliente({ abierta, alCerrar, cliente }: Props) {
  // Mientras guarda, la hoja no se cierra: deslizar o tocar el velo no puede descartar un cliente que está entrando.
  const guardando = useRef(false);
  return (
    <Hoja
      abierta={abierta}
      alCambiar={(abrir) => !abrir && !guardando.current && alCerrar()}
      titulo={cliente ? "Editar cliente" : "Nuevo cliente"}
      icono={<UserRound aria-hidden />}
    >
      {/* Se monta al abrir y se desmonta al cerrar: cada vez arranca limpia, sin lo que se dejó a medias. */}
      <Formulario cliente={cliente} alCerrar={alCerrar} alCambiarGuardando={(g) => (guardando.current = g)} />
    </Hoja>
  );
}

function Formulario({ cliente, alCerrar, alCambiarGuardando }: { cliente: ClienteEditable | null; alCerrar: () => void; alCambiarGuardando: (g: boolean) => void }) {
  const inicial = cliente?.borrador ?? BORRADOR_VACIO;
  const router = useRouter();
  const [b, setB] = useState<BorradorCliente>(inicial);
  const [apodo, setApodo] = useState("");
  const [errorApodo, setErrorApodo] = useState<string | null>(null);
  const [tocados, setTocados] = useState<ReadonlySet<CampoCliente>>(new Set());
  // Los parecidos de un texto concreto: si el nombre ya cambió, ese aviso no vale.
  const [parecidos, setParecidos] = useState<{ texto: string; lista: Parecido[] }>({ texto: "", lista: [] });
  const { confirmar, guardando, error, guardado } = useConfirmar<ClienteGuardado>({ alGuardar: () => undefined, alCambiarGuardando, boton: "Guardar cliente" });

  const tocar = (campo: CampoCliente) => setTocados((t) => new Set(t).add(campo));
  const cambiar = (cambios: Partial<BorradorCliente>) => setB((x) => ({ ...x, ...cambios }));

  // Un nombre que se parece a otro avisa antes de duplicar a «don Lucho». Solo si el nombre es uno nuevo (al editar sin tocarlo, no).
  const texto = b.nombre.trim();
  const debeBuscar = !guardado && texto.length >= 3 && texto !== inicial.nombre.trim();
  useEffect(() => {
    if (!debeBuscar) return;
    let vigente = true;
    const espera = window.setTimeout(async () => {
      const r = await buscarParecidos(texto, cliente?.id ?? null).catch(() => null);
      if (vigente) setParecidos({ texto, lista: r ?? [] });
    }, 400);
    return () => {
      vigente = false;
      window.clearTimeout(espera);
    };
  }, [texto, debeBuscar, cliente?.id]);
  const parecidosAhora = debeBuscar && parecidos.texto === texto ? parecidos.lista : [];
  const avisoDeParecidos = avisoParecidos(parecidosAhora);

  // Después del sello se cierra la hoja; un cliente nuevo se abre en su ficha.
  useEffect(() => {
    if (!guardado) return;
    const t = window.setTimeout(() => {
      alCerrar();
      if (!cliente) router.push(`/clientes/${guardado.id}`);
    }, 1700);
    return () => window.clearTimeout(t);
  }, [guardado, cliente, alCerrar, router]);

  function agregar(): BorradorCliente {
    const r = agregarApodo(b.alias, apodo);
    if (!r.ok) {
      setErrorApodo(r.error);
      return b;
    }
    setErrorApodo(null);
    setApodo("");
    const nuevo = { ...b, alias: r.lista };
    setB(nuevo);
    return nuevo;
  }

  // Un apodo escrito y no agregado se agrega solo al guardar: perderlo en silencio sería el peor error de este formulario.
  const conApodo = (): BorradorCliente => {
    const r = agregarApodo(b.alias, apodo);
    return r.ok ? { ...b, alias: r.lista } : b;
  };

  const validado = validarCliente(b);
  const errores = validado.ok ? {} : validado.errores;
  const falta = primeraFalta(b);
  const cambios = cliente ? hayCambios(inicial, conApodo()) : true;
  const aviso = falta ?? (cliente && !cambios ? "Todavía no cambiaste nada." : null);

  function guardar() {
    if (falta !== null || !cambios) return;
    const borrador = conApodo();
    void confirmar(() => guardarCliente({ id: cliente?.id ?? null, borrador, inicial: cliente?.borrador ?? null }));
  }

  if (guardado) {
    return <Guardado titulo={cliente ? "Cambios guardados" : "Cliente guardado"}>{b.nombre.trim()}</Guardado>;
  }

  return (
    <div className="grid gap-3">
      <Campo
        id="cliente-nombre"
        etiqueta="Nombre"
        value={b.nombre}
        onChange={(e) => cambiar({ nombre: e.target.value })}
        onBlur={() => tocar("nombre")}
        error={tocados.has("nombre") ? errores.nombre : undefined}
        autoComplete="off"
        autoCapitalize="words"
        maxLength={LIMITES.nombre}
      />
      {avisoDeParecidos && (
        <div role="note" className="flex items-center justify-between gap-3 rounded-[20px] bg-superficie px-3.5 py-2 ring-2 ring-acento/50">
          <p className="text-lg">{avisoDeParecidos}</p>
          <Link href={`/clientes/${parecidosAhora[0]!.id}`} className="flex min-h-12 shrink-0 items-center font-extrabold text-acento-texto">
            Ver ficha
          </Link>
        </div>
      )}

      <div className="grid gap-2">
        {b.alias.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Apodos">
            {b.alias.map((a) => (
              <li key={a}>
                <button
                  type="button"
                  onClick={() => cambiar({ alias: b.alias.filter((x) => x !== a) })}
                  aria-label={`Quitar «${a}»`}
                  className="flex min-h-12 items-center gap-2 rounded-full bg-superficie pr-3 pl-4 text-lg font-bold"
                >
                  {a}
                  <X aria-hidden className="size-5 text-texto-suave" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Campo
          id="cliente-apodo"
          etiqueta="Apodos: cómo le dices"
          placeholder="don lucho"
          value={apodo}
          onChange={(e) => {
            setApodo(e.target.value);
            setErrorApodo(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar();
            }
          }}
          enterKeyHint="done"
          autoComplete="off"
          error={errorApodo ?? undefined}
          fin={
            <button type="button" onClick={agregar} aria-label="Agregar apodo" className="grid size-12 place-items-center rounded-full bg-texto text-superficie">
              <Plus aria-hidden className="size-6" />
            </button>
          }
        />
      </div>

      <Campo
        id="cliente-telefono"
        etiqueta="Teléfono"
        value={b.telefono}
        onChange={(e) => cambiar({ telefono: e.target.value })}
        onBlur={() => tocar("telefono")}
        error={tocados.has("telefono") ? errores.telefono : undefined}
        inputMode="tel"
        autoComplete="off"
        maxLength={LIMITES.telefono}
      />

      <div className="grid gap-2">
        <p className="font-bold">Documento</p>
        <GrupoOpciones<Opcion>
          opciones={OPCIONES_DOCUMENTO}
          elegido={b.tipoDocumento ?? "ninguno"}
          alCambiar={(o) => {
            cambiar({ tipoDocumento: o === "ninguno" ? null : o, numeroDocumento: o === "ninguno" ? "" : b.numeroDocumento });
            setTocados((t) => {
              const s = new Set(t);
              s.delete("documento");
              return s;
            });
          }}
          pregunta="Tipo de documento"
          columnas={3}
        />
        {b.tipoDocumento && (
          <Campo
            id="cliente-documento"
            etiqueta={`Número de ${b.tipoDocumento}`}
            value={b.numeroDocumento}
            onChange={(e) => cambiar({ numeroDocumento: e.target.value })}
            onBlur={() => tocar("documento")}
            error={tocados.has("documento") ? errores.documento : undefined}
            inputMode="numeric"
            autoComplete="off"
            maxLength={16}
          />
        )}
      </div>

      <Desplegable resumen={<span className="font-bold">Más datos: dirección y notas</span>}>
        <div className="grid gap-3 pb-2">
          <Campo
            id="cliente-direccion"
            etiqueta="Dirección"
            value={b.direccion}
            onChange={(e) => cambiar({ direccion: e.target.value })}
            onBlur={() => tocar("direccion")}
            error={tocados.has("direccion") ? errores.direccion : undefined}
            autoComplete="off"
            maxLength={LIMITES.direccion}
          />
          <Campo
            id="cliente-notas"
            etiqueta="Notas"
            value={b.notas}
            onChange={(e) => cambiar({ notas: e.target.value })}
            onBlur={() => tocar("notas")}
            error={tocados.has("notas") ? errores.notas : undefined}
            autoComplete="off"
            maxLength={LIMITES.notas}
          />
        </div>
      </Desplegable>

      <PieConfirmar
        aviso={aviso}
        avisoNeutro
        error={error}
        guardando={guardando}
        listo={aviso === null}
        etiqueta="Guardar cliente"
        alConfirmar={guardar}
        alDescartar={alCerrar}
      />
    </div>
  );
}
