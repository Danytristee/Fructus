// Alta y edición de un cliente (A8): qué se le pide a la persona, cómo se limpia y qué se guarda. Lógica pura: no importa
// React ni Supabase. Las mismas reglas corren en la hoja (para decir qué falta) y en el servidor (que no se fía de la hoja).

export type TipoDocumento = "DNI" | "RUC";

/** Lo que la persona escribe en la hoja: todo texto, tal cual, sin limpiar. */
export type BorradorCliente = {
  nombre: string;
  alias: string[];
  telefono: string;
  tipoDocumento: TipoDocumento | null;
  numeroDocumento: string;
  direccion: string;
  notas: string;
};

export const BORRADOR_VACIO: BorradorCliente = { nombre: "", alias: [], telefono: "", tipoDocumento: null, numeroDocumento: "", direccion: "", notas: "" };

/** Lo que se guarda en `clientes`, ya limpio. Lo que no se llenó va `null`, no «». */
export type FilaCliente = {
  nombre: string;
  alias: string[];
  tipo_documento: TipoDocumento | null;
  numero_documento: string | null;
  telefono: string | null;
  direccion: string | null;
  notas: string | null;
};

export const LIMITES = { nombre: 80, alias: 8, aliasLargo: 40, telefono: 20, direccion: 120, notas: 300 } as const;

/** Desde esta similitud (pg_trgm) un nombre «se parece» a otro: el mismo umbral que usa la voz para elegir un cliente solo. */
export const PARECIDO_DESDE = 0.45;

export const NOMBRE_REPETIDO = "Ya tienes un cliente con ese nombre. Agrega algo para distinguirlos, por ejemplo «Juan Pérez (puesto 12)».";

const espacios = (texto: string) => texto.replace(/\s+/g, " ").trim();

const limpiarNombre = espacios;

/** «Don Lucho» → «don lucho». Los apodos se guardan en minúscula, como los busca la voz. */
export const limpiarApodo = (texto: string) => espacios(texto.replace(/[«»"“”]/g, "")).toLowerCase();

export type ResultadoApodo = { ok: true; lista: string[] } | { ok: false; error: string | null };

/** Suma un apodo a la lista. Vacío no es error (no hay nada que agregar): `error: null`. */
export function agregarApodo(lista: string[], texto: string): ResultadoApodo {
  const apodo = limpiarApodo(texto);
  if (apodo === "") return { ok: false, error: null };
  if (apodo.length > LIMITES.aliasLargo) return { ok: false, error: `Un apodo no puede pasar de ${LIMITES.aliasLargo} letras.` };
  if (lista.includes(apodo)) return { ok: false, error: "Ese apodo ya está." };
  if (lista.length >= LIMITES.alias) return { ok: false, error: `Con ${LIMITES.alias} apodos alcanza.` };
  return { ok: true, lista: [...lista, apodo] };
}

export type LecturaDocumento = { ok: true; numero: string | null } | { ok: false; error: string };

/** DNI: 8 números. RUC: 11 números que empiezan con 10, 15, 16, 17 o 20 (la base exige el largo; el comienzo ataja un dedo que se fue). */
export function leerDocumento(tipo: TipoDocumento | null, texto: string): LecturaDocumento {
  const numero = texto.replace(/[\s-]/g, "");
  if (tipo === null) return numero === "" ? { ok: true, numero: null } : { ok: false, error: "Elige si es DNI o RUC." };
  if (numero === "") return { ok: false, error: tipo === "DNI" ? "Escribe el DNI: son 8 números." : "Escribe el RUC: son 11 números." };
  if (tipo === "DNI") return /^\d{8}$/.test(numero) ? { ok: true, numero } : { ok: false, error: "El DNI tiene 8 números." };
  return /^(10|15|16|17|20)\d{9}$/.test(numero) ? { ok: true, numero } : { ok: false, error: "El RUC tiene 11 números y empieza con 10 o 20." };
}

export type LecturaTelefono = { ok: true; telefono: string | null } | { ok: false; error: string };

export function leerTelefono(texto: string): LecturaTelefono {
  const telefono = espacios(texto);
  if (telefono === "") return { ok: true, telefono: null };
  const digitos = telefono.replace(/\D/g, "").length;
  if (telefono.length > LIMITES.telefono || !/^[\d\s+\-().]+$/.test(telefono) || digitos < 6 || digitos > 15) {
    return { ok: false, error: "Escribe el teléfono solo con números, por ejemplo 987 654 321." };
  }
  return { ok: true, telefono };
}

export type CampoCliente = "nombre" | "telefono" | "documento" | "direccion" | "notas";
export type ErroresCliente = Partial<Record<CampoCliente, string>>;
export type ResultadoCliente = { ok: true; fila: FilaCliente } | { ok: false; errores: ErroresCliente };

/** El borrador, limpio y listo para guardar; o qué campo está mal y qué decirle a la persona. */
export function validarCliente(b: BorradorCliente): ResultadoCliente {
  const errores: ErroresCliente = {};

  const nombre = limpiarNombre(b.nombre);
  if (nombre === "") errores.nombre = "Escribe cómo se llama.";
  else if (nombre.length > LIMITES.nombre) errores.nombre = `El nombre no puede pasar de ${LIMITES.nombre} letras.`;

  const telefono = leerTelefono(b.telefono);
  if (!telefono.ok) errores.telefono = telefono.error;

  const documento = leerDocumento(b.tipoDocumento, b.numeroDocumento);
  if (!documento.ok) errores.documento = documento.error;

  const direccion = espacios(b.direccion);
  if (direccion.length > LIMITES.direccion) errores.direccion = `La dirección no puede pasar de ${LIMITES.direccion} letras.`;
  const notas = b.notas.trim();
  if (notas.length > LIMITES.notas) errores.notas = `Las notas no pueden pasar de ${LIMITES.notas} letras.`;

  if (Object.keys(errores).length > 0 || !telefono.ok || !documento.ok) return { ok: false, errores };

  const alias = [...new Set(b.alias.map(limpiarApodo).filter((a) => a !== "" && a.length <= LIMITES.aliasLargo))].slice(0, LIMITES.alias);
  return {
    ok: true,
    fila: {
      nombre,
      alias,
      tipo_documento: b.tipoDocumento,
      numero_documento: documento.numero,
      telefono: telefono.telefono,
      direccion: direccion || null,
      notas: notas || null,
    },
  };
}

/** Lo que dice la hoja mientras falta algo, en el orden en que se ve. null si se puede guardar. */
export function primeraFalta(b: BorradorCliente): string | null {
  const v = validarCliente(b);
  if (v.ok) return null;
  const e = v.errores;
  return e.nombre ?? e.documento ?? e.telefono ?? e.direccion ?? e.notas ?? null;
}

type ClienteLeido = {
  nombre: string;
  alias: string[];
  tipo_documento: string | null;
  numero_documento: string | null;
  telefono: string | null;
  direccion: string | null;
  notas: string | null;
};

/** De la fila de la base al borrador que se edita. */
export function borradorDeCliente(c: ClienteLeido): BorradorCliente {
  return {
    nombre: c.nombre,
    alias: c.alias,
    telefono: c.telefono ?? "",
    tipoDocumento: c.tipo_documento === "DNI" || c.tipo_documento === "RUC" ? c.tipo_documento : null,
    numeroDocumento: c.numero_documento ?? "",
    direccion: c.direccion ?? "",
    notas: c.notas ?? "",
  };
}

/** Dos filas iguales, para saber si un reintento es el mismo cliente (respuesta perdida) o uno distinto con el mismo nombre. */
export function mismaFila(a: FilaCliente, b: FilaCliente): boolean {
  return (
    a.nombre.toLowerCase() === b.nombre.toLowerCase() &&
    a.tipo_documento === b.tipo_documento &&
    a.numero_documento === b.numero_documento &&
    a.telefono === b.telefono &&
    a.direccion === b.direccion &&
    a.notas === b.notas &&
    a.alias.length === b.alias.length &&
    a.alias.every((x, i) => x === b.alias[i])
  );
}

/** Si lo escrito cambia algo de lo que ya había: editar sin cambiar nada no se guarda. */
export function hayCambios(inicial: BorradorCliente, ahora: BorradorCliente): boolean {
  const [a, b] = [validarCliente(inicial), validarCliente(ahora)];
  if (a.ok && b.ok) return !mismaFila(a.fila, b.fila);
  return JSON.stringify(inicial) !== JSON.stringify(ahora);
}

/** «Ya tienes a Luis Paredes («don lucho»). ¿Es el mismo?» Null si nadie se parece. */
export function avisoParecidos(parecidos: { nombre: string; alias: string[] }[]): string | null {
  if (parecidos.length === 0) return null;
  const quienes = parecidos.slice(0, 2).map((c) => (c.alias[0] ? `${c.nombre} («${c.alias[0]}»)` : c.nombre));
  return `Ya tienes a ${quienes.join(" y a ")}. ¿Es el mismo?`;
}
