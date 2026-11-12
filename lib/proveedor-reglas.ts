// El alta y la edición de un proveedor, y el pago que le haces: qué se acepta y cómo se dice lo que falta. Lógica pura.
import { leerTelefono } from "./cliente-reglas";
import { leerMonto } from "./voz/monto-reglas";

export const LIMITES_PROVEEDOR = { nombre: 80, apodos: 120, contacto: 60, origen: 80, direccion: 120, notas: 300 } as const;
/** Un pago a un proveedor de más de esto es un dedo que se fue: el más grande de la demo es de unos S/ 16,000. */
export const PAGO_MAXIMO = 100_000;

export const NOMBRE_PROVEEDOR_REPETIDO = "Ya tienes un proveedor con ese nombre. Agrega algo para distinguirlos, por ejemplo «Chao (Wilmer)».";

export type BorradorProveedor = {
  nombre: string;
  /** Separados por coma, como se escriben: «chao, el de chao». */
  apodos: string;
  contacto: string;
  telefono: string;
  ruc: string;
  origen: string;
  direccion: string;
  notas: string;
};

export const PROVEEDOR_VACIO: BorradorProveedor = { nombre: "", apodos: "", contacto: "", telefono: "", ruc: "", origen: "", direccion: "", notas: "" };

export type FilaProveedor = {
  nombre: string;
  alias: string[];
  contacto: string | null;
  telefono: string | null;
  ruc: string | null;
  origen: string | null;
  direccion: string | null;
  notas: string | null;
};

export type CampoProveedor = "nombre" | "apodos" | "contacto" | "telefono" | "ruc" | "origen" | "direccion" | "notas";
export type ErroresProveedor = Partial<Record<CampoProveedor, string>>;

const espacios = (t: string) => t.replace(/\s+/g, " ").trim();
const opcional = (t: string) => espacios(t) || null;

/** «Chao, el de chao,, CHAO» → ["chao", "el de chao"]: en minúsculas, sin vacíos ni repetidos. */
export function leerApodos(texto: string): string[] {
  return [...new Set(texto.split(",").map((a) => espacios(a.replace(/[«»"“”]/g, "")).toLowerCase()).filter(Boolean))];
}

export function validarProveedor(b: BorradorProveedor): { ok: true; fila: FilaProveedor } | { ok: false; errores: ErroresProveedor } {
  const errores: ErroresProveedor = {};
  const nombre = espacios(b.nombre);
  if (nombre === "") errores.nombre = "Escribe el nombre del proveedor.";
  else if (nombre.length > LIMITES_PROVEEDOR.nombre) errores.nombre = `El nombre va hasta ${LIMITES_PROVEEDOR.nombre} letras.`;
  if (b.apodos.length > LIMITES_PROVEEDOR.apodos) errores.apodos = "Son demasiados apodos.";
  const telefono = leerTelefono(b.telefono);
  if (!telefono.ok) errores.telefono = telefono.error;
  const ruc = b.ruc.replace(/[\s-]/g, "");
  if (ruc !== "" && !/^(10|15|16|17|20)\d{9}$/.test(ruc)) errores.ruc = "El RUC tiene 11 números y empieza con 10 o 20.";
  for (const campo of ["contacto", "origen", "direccion", "notas"] as const) {
    if (espacios(b[campo]).length > LIMITES_PROVEEDOR[campo]) errores[campo] = `Va hasta ${LIMITES_PROVEEDOR[campo]} letras.`;
  }
  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return {
    ok: true,
    fila: {
      nombre,
      alias: leerApodos(b.apodos),
      contacto: opcional(b.contacto),
      telefono: telefono.ok ? telefono.telefono : null,
      ruc: ruc || null,
      origen: opcional(b.origen),
      direccion: opcional(b.direccion),
      notas: opcional(b.notas),
    },
  };
}

export function borradorDeProveedor(p: FilaProveedor): BorradorProveedor {
  return {
    nombre: p.nombre,
    apodos: p.alias.join(", "),
    contacto: p.contacto ?? "",
    telefono: p.telefono ?? "",
    ruc: p.ruc ?? "",
    origen: p.origen ?? "",
    direccion: p.direccion ?? "",
    notas: p.notas ?? "",
  };
}

/** Solo lo que cambió: dos personas que editan campos distintos no se pisan. */
export function cambiosDeProveedor(antes: FilaProveedor, ahora: FilaProveedor): Partial<FilaProveedor> {
  const cambios: Partial<FilaProveedor> = {};
  for (const k of Object.keys(ahora) as (keyof FilaProveedor)[]) {
    if (JSON.stringify(antes[k]) !== JSON.stringify(ahora[k])) Object.assign(cambios, { [k]: ahora[k] });
  }
  return cambios;
}

export type LecturaPago = { ok: true; monto: number } | { ok: false; error: string | null };

/** El monto del pago, con la misma lectura que el abono: «500», «1,250.50» no; «1250.50» sí. Vacío: falta, sin error. */
export function leerPago(texto: string): LecturaPago {
  const r = leerMonto(texto, { nombre: "monto", maximo: PAGO_MAXIMO });
  return r.ok ? { ok: true, monto: r.valor } : r;
}

/** Lo que dice la hoja debajo del monto: cuánto le quedarás debiendo, o que quedará a tu favor (como el abono de un cliente). */
export function despuesDelPago(deuda: number, monto: number): { tipo: "debe" | "al_dia" | "a_favor"; monto: number } {
  const centimos = Math.round((deuda - monto) * 100);
  if (centimos > 0) return { tipo: "debe", monto: centimos / 100 };
  if (centimos < 0) return { tipo: "a_favor", monto: -centimos / 100 };
  return { tipo: "al_dia", monto: 0 };
}
