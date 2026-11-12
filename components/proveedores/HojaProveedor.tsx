"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";

import { guardarProveedor, type ResultadoGuardarProveedor } from "@/app/(app)/acciones-proveedores";
import { Campo } from "@/components/ui/Campo";
import { Desplegable } from "@/components/ui/Desplegable";
import { Hoja } from "@/components/ui/Hoja";
import { Guardado } from "@/components/voz/Guardado";
import { PieConfirmar } from "@/components/voz/PieConfirmar";
import { useConfirmar } from "@/components/voz/useConfirmar";
import { avisoDeProveedor, LIMITES_PROVEEDOR, PROVEEDOR_VACIO, validarProveedor, type BorradorProveedor, type CampoProveedor } from "@/lib/proveedor-reglas";

export type ProveedorEditable = { id: number; borrador: BorradorProveedor };

type Props = { abierta: boolean; alCerrar: () => void; proveedor: ProveedorEditable | null };
type Guardado_ = Extract<ResultadoGuardarProveedor, { ok: true }>;

// El alta y la edición de un proveedor: nombre, cómo le dices, a quién llamar y de dónde trae, a la vista; RUC, dirección y notas un
// toque más abajo. Solo el dueño y el administrador la ven (la base también lo exige).
export function HojaProveedor({ abierta, alCerrar, proveedor }: Props) {
  const guardando = useRef(false);
  return (
    <Hoja
      abierta={abierta}
      alCambiar={(abrir) => !abrir && !guardando.current && alCerrar()}
      titulo={proveedor ? "Editar proveedor" : "Nuevo proveedor"}
      icono={<Truck aria-hidden />}
    >
      <Formulario proveedor={proveedor} alCerrar={alCerrar} alCambiarGuardando={(g) => (guardando.current = g)} />
    </Hoja>
  );
}

function Formulario({ proveedor, alCerrar, alCambiarGuardando }: { proveedor: ProveedorEditable | null; alCerrar: () => void; alCambiarGuardando: (g: boolean) => void }) {
  const inicial = proveedor?.borrador ?? PROVEEDOR_VACIO;
  const router = useRouter();
  const [b, setB] = useState<BorradorProveedor>(inicial);
  const [masDatos, setMasDatos] = useState(false);
  const [tocados, setTocados] = useState<ReadonlySet<CampoProveedor>>(new Set());
  const { confirmar, guardando, error, guardado } = useConfirmar<Guardado_>({ alGuardar: () => undefined, alCambiarGuardando, boton: "Guardar proveedor" });

  useEffect(() => {
    if (!guardado) return;
    const t = window.setTimeout(() => {
      alCerrar();
      if (!proveedor) router.push(`/proveedores/${guardado.id}`);
    }, 1700);
    return () => window.clearTimeout(t);
  }, [guardado, proveedor, alCerrar, router]);

  const validado = validarProveedor(b);
  const errores = validado.ok ? {} : validado.errores;
  const { aviso, enMasDatos } = avisoDeProveedor(b, proveedor?.borrador ?? null);

  const campo = (k: CampoProveedor, etiqueta: string, extra: Partial<React.ComponentProps<typeof Campo>> = {}) => (
    <Campo
      id={`proveedor-${k}`}
      etiqueta={etiqueta}
      value={b[k]}
      onChange={(e) => setB((x) => ({ ...x, [k]: e.target.value }))}
      onBlur={() => setTocados((t) => new Set(t).add(k))}
      error={tocados.has(k) ? errores[k] : undefined}
      autoComplete="off"
      {...extra}
    />
  );

  if (guardado) return <Guardado titulo={proveedor ? "Cambios guardados" : "Proveedor guardado"}>{b.nombre.trim()}</Guardado>;

  return (
    <div className="grid gap-3">
      {campo("nombre", "Nombre", { autoCapitalize: "words", maxLength: LIMITES_PROVEEDOR.nombre })}
      {campo("apodos", "Cómo le dices (separa con comas)", { placeholder: "chao, el de chao", maxLength: LIMITES_PROVEEDOR.apodos })}
      {campo("contacto", "Con quién hablas", { placeholder: "don Wilmer", autoCapitalize: "words", maxLength: LIMITES_PROVEEDOR.contacto })}
      {campo("telefono", "Teléfono", { inputMode: "tel", placeholder: "987 654 321", maxLength: 20 })}
      {campo("origen", "De dónde trae la fruta", { placeholder: "Chao, La Libertad", maxLength: LIMITES_PROVEEDOR.origen })}
      {/* Si el error está aquí adentro, se abre solo y su campo sale en rojo: con «Más datos» cerrado, el pie pedía revisar algo que no se
          veía (/chaos 2026-11-12). Se controla desde aquí, sin volver a montarlo: así el RUC no pierde el foco mientras se escribe. */}
      <Desplegable
        abierto={masDatos || enMasDatos}
        alCambiar={setMasDatos}
        resumen={<span className="font-bold">Más datos: RUC, dirección y notas</span>}
      >
        <div className="grid gap-3 pb-2">
          {campo("ruc", "RUC", { inputMode: "numeric", maxLength: 13 })}
          {campo("direccion", "Dirección", { maxLength: LIMITES_PROVEEDOR.direccion })}
          {campo("notas", "Notas", { placeholder: "Da crédito a 15 días", maxLength: LIMITES_PROVEEDOR.notas })}
        </div>
      </Desplegable>
      <PieConfirmar
        aviso={aviso}
        avisoNeutro
        error={error}
        guardando={guardando}
        listo={aviso === null}
        etiqueta="Guardar proveedor"
        alConfirmar={() => {
          if (aviso !== null) return;
          void confirmar(() => guardarProveedor({ id: proveedor?.id ?? null, borrador: b, inicial: proveedor?.borrador ?? null }));
        }}
        alDescartar={alCerrar}
      />
    </div>
  );
}
