// De quién dependes y quién te tiene como cliente fijo, con lo que ya está en tus compras (apartado Proveedores).
// Fructus no ve las ventas del proveedor: que «él te necesita» se deduce de cuán seguido y desde cuándo le compras
// (decisión del 2026-11-12). Por eso la pantalla dice «eres su cliente fijo», no «depende de ti».
import { diaDeLima } from "./formato";

/** Ventana del análisis: lo de los últimos 90 días. La antigüedad mira más atrás (lo que llegue en `compras`). */
export const VENTANA_DIAS = 90;
/** Ser la única fuente de una fruta pesa en la dependencia solo si esa fruta es al menos esta parte de tus compras. */
export const FRUTA_IMPORTANTE = 0.05;

export type CompraResumida = { proveedorId: number | null; fecha: string; total: number };
export type FrutaComprada = {
  proveedorId: number | null;
  productoId: number;
  fruta: string;
  cajas: number;
  total: number;
  ultimoCosto: number;
  costoPromedio: number;
};
export type ProveedorBase = { id: number; nombre: string; saldo: number };

export type Nivel = "alto" | "medio" | "bajo";
export type Posicion = "riesgo" | "socio" | "ventaja" | "ocasional" | "enfriado";

export type FrutaDelProveedor = {
  productoId: number;
  fruta: string;
  cajas: number;
  ultimoCosto: number;
  /** El costo más bajo que te dio otro proveedor por la misma fruta, si hay otro. */
  mejorOtro: { proveedorId: number; costo: number } | null;
  /** ultimoCosto − mejorOtro.costo: positivo, él es más caro. */
  diferencia: number;
  /** Cuánto subió su último costo sobre su promedio del periodo (0.05 = 5 %). */
  subio: number;
  unicaFuente: boolean;
  /** Qué parte de todas tus compras es esta fruta (de cualquier proveedor). */
  pesoEnTusCompras: number;
};

export type AnalisisProveedor = {
  id: number;
  nombre: string;
  saldo: number;
  total: number;
  compras: number;
  participacion: number;
  ultimaCompra: string | null;
  diasSinComprar: number | null;
  /** Cada cuántos días le compras (la mediana entre un día de compra y el siguiente). */
  cadaDias: number | null;
  /** Desde hace cuántos días le compras, hasta donde llega la historia. */
  antiguedadDias: number | null;
  tendencia: "sube" | "baja" | "igual";
  dependes: Nivel;
  clienteFijo: Nivel;
  posicion: Posicion;
  frutas: FrutaDelProveedor[];
  /** Lo que ahorrarías en un mes si le compraras al más barato lo que hoy le compras a él. */
  ahorroMensual: number;
};

const DIA = 86_400_000;
const dias = (desde: string, hasta: Date) => Math.round((Date.parse(diaDeLima(hasta)) - Date.parse(diaDeLima(new Date(desde)))) / DIA);

function mediana(numeros: number[]): number | null {
  if (numeros.length === 0) return null;
  const orden = [...numeros].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio]! : (orden[medio - 1]! + orden[medio]!) / 2;
}

/** Cuánto pesa en tus compras, y si es tu única fuente de algo. */
export function nivelDependencia(participacion: number, unicas: number): Nivel {
  if (participacion >= 0.25 || unicas > 0) return "alto";
  return participacion >= 0.1 ? "medio" : "bajo";
}

/** Si le compras seguido, desde hace tiempo y hasta ahora, eres su cliente fijo: él también te necesita. */
export function nivelClienteFijo(cadaDias: number | null, antiguedadDias: number | null, diasSinComprar: number | null): Nivel {
  if (cadaDias === null || antiguedadDias === null || diasSinComprar === null || diasSinComprar > 21) return "bajo";
  if (cadaDias <= 7 && antiguedadDias >= 60 && diasSinComprar <= 14) return "alto";
  return cadaDias <= 14 && antiguedadDias >= 30 ? "medio" : "bajo";
}

/**
 * La posición para negociar, en un veredicto:
 * - enfriado: hace más de 30 días que no le compras;
 * - riesgo: dependes de él y él no te necesita tanto, o es tu única fuente de una fruta;
 * - socio: se necesitan los dos;
 * - ventaja: eres su cliente fijo y tienes otras opciones;
 * - ocasional: ni uno ni otro.
 */
export function posicionDe(dependes: Nivel, clienteFijo: Nivel, unicas: number, diasSinComprar: number | null): Posicion {
  if (diasSinComprar !== null && diasSinComprar > 30) return "enfriado";
  if (dependes === "alto" && (clienteFijo !== "alto" || unicas > 0)) return "riesgo";
  if (dependes === "alto") return "socio";
  if (clienteFijo === "alto" || (clienteFijo === "medio" && dependes === "medio")) return "ventaja";
  return "ocasional";
}

/** Compras de la segunda mitad de la ventana contra la primera: más de 15 % de diferencia es que sube o baja. */
function tendenciaDe(compras: CompraResumida[], hoy: Date): AnalisisProveedor["tendencia"] {
  const mitad = VENTANA_DIAS / 2;
  let reciente = 0;
  let antes = 0;
  for (const c of compras) {
    const d = dias(c.fecha, hoy);
    if (d < mitad) reciente += c.total;
    else if (d < VENTANA_DIAS) antes += c.total;
  }
  if (antes === 0) return reciente > 0 ? "sube" : "igual";
  const cambio = reciente / antes - 1;
  return cambio > 0.15 ? "sube" : cambio < -0.15 ? "baja" : "igual";
}

/**
 * Analiza a cada proveedor. `compras` trae una fila por compra (puede ir más atrás que la ventana, para la antigüedad);
 * `frutas`, una fila por proveedor y fruta dentro de la ventana. Las compras sin proveedor anotado cuentan en el total,
 * para que el porcentaje de cada uno no se infle.
 */
export function analizarProveedores(proveedores: ProveedorBase[], compras: CompraResumida[], frutas: FrutaComprada[], hoy: Date): AnalisisProveedor[] {
  const enVentana = compras.filter((c) => dias(c.fecha, hoy) < VENTANA_DIAS);
  const totalGeneral = enVentana.reduce((s, c) => s + c.total, 0);

  // Por fruta: quién te la trae y a qué costo.
  const porFruta = new Map<number, FrutaComprada[]>();
  for (const f of frutas) if (f.proveedorId !== null) porFruta.set(f.productoId, [...(porFruta.get(f.productoId) ?? []), f]);

  return proveedores
    .map((p): AnalisisProveedor => {
      const suyas = compras.filter((c) => c.proveedorId === p.id);
      const suyasVentana = enVentana.filter((c) => c.proveedorId === p.id);
      const total = suyasVentana.reduce((s, c) => s + c.total, 0);
      const diasDeCompra = [...new Set(suyasVentana.map((c) => diaDeLima(new Date(c.fecha))))].sort();
      const saltos = diasDeCompra.slice(1).map((d, i) => (Date.parse(d) - Date.parse(diasDeCompra[i]!)) / DIA);
      const ultima = suyas.reduce<string | null>((m, c) => (m === null || c.fecha > m ? c.fecha : m), null);
      const primera = suyas.reduce<string | null>((m, c) => (m === null || c.fecha < m ? c.fecha : m), null);
      const diasSinComprar = ultima ? dias(ultima, hoy) : null;
      const cadaDias = mediana(saltos);
      const antiguedadDias = primera ? dias(primera, hoy) : null;

      const lasSuyas = frutas
        .filter((f) => f.proveedorId === p.id)
        .map((f): FrutaDelProveedor => {
          const otros = (porFruta.get(f.productoId) ?? []).filter((o) => o.proveedorId !== p.id);
          const mejor = otros.reduce<FrutaComprada | null>((m, o) => (m === null || o.ultimoCosto < m.ultimoCosto ? o : m), null);
          return {
            productoId: f.productoId,
            fruta: f.fruta,
            cajas: f.cajas,
            ultimoCosto: f.ultimoCosto,
            mejorOtro: mejor ? { proveedorId: mejor.proveedorId!, costo: mejor.ultimoCosto } : null,
            diferencia: mejor ? f.ultimoCosto - mejor.ultimoCosto : 0,
            subio: f.costoPromedio > 0 ? f.ultimoCosto / f.costoPromedio - 1 : 0,
            unicaFuente: otros.length === 0,
            pesoEnTusCompras: totalGeneral > 0 ? (porFruta.get(f.productoId) ?? []).reduce((s, o) => s + o.total, 0) / totalGeneral : 0,
          };
        })
        .sort((a, b) => b.cajas - a.cajas);

      // Que solo él te traiga el tumbo no te ata; que solo él te traiga el kiwi que vendes todos los días, sí.
      const unicas = lasSuyas.filter((f) => f.unicaFuente && f.pesoEnTusCompras >= FRUTA_IMPORTANTE).length;
      const participacion = totalGeneral > 0 ? total / totalGeneral : 0;
      const dependes = nivelDependencia(participacion, unicas);
      const clienteFijo = nivelClienteFijo(cadaDias, antiguedadDias, diasSinComprar);
      const ahorro = lasSuyas.reduce((s, f) => s + (f.diferencia > 0 ? f.diferencia * f.cajas : 0), 0);

      return {
        id: p.id,
        nombre: p.nombre,
        saldo: p.saldo,
        total,
        compras: suyasVentana.length,
        participacion,
        ultimaCompra: ultima,
        diasSinComprar,
        cadaDias,
        antiguedadDias,
        tendencia: tendenciaDe(suyas, hoy),
        dependes,
        clienteFijo,
        posicion: posicionDe(dependes, clienteFijo, unicas, diasSinComprar),
        frutas: lasSuyas,
        ahorroMensual: Math.round((ahorro * 30) / VENTANA_DIAS),
      };
    })
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es"));
}

export type ResumenProveedores = {
  total: number;
  /** El que más pesa, con su parte. */
  principal: { nombre: string; participacion: number } | null;
  /** Cuánto se llevan los 3 primeros. */
  top3: number;
  deuda: number;
  conDeuda: number;
  /** Proveedores a los que hoy les puedes pedir mejor precio. */
  paraNegociar: number;
  enRiesgo: number;
};

export function resumirProveedores(analisis: AnalisisProveedor[]): ResumenProveedores {
  const total = analisis.reduce((s, a) => s + a.total, 0);
  const conCompras = analisis.filter((a) => a.total > 0);
  const deben = analisis.filter((a) => a.saldo > 0);
  return {
    total,
    principal: conCompras[0] ? { nombre: conCompras[0].nombre, participacion: conCompras[0].participacion } : null,
    top3: conCompras.slice(0, 3).reduce((s, a) => s + a.participacion, 0),
    deuda: deben.reduce((s, a) => s + a.saldo, 0),
    conDeuda: deben.length,
    paraNegociar: analisis.filter((a) => a.posicion === "ventaja" || a.ahorroMensual > 0).length,
    enRiesgo: analisis.filter((a) => a.posicion === "riesgo").length,
  };
}
