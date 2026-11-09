import { baseLocal } from "./base";

// Un mes de prueba con datos conocidos, para comprobar que el Excel repite lo que hay en la base. Va con la secret key local: escribe
// directo en las tablas, con fechas de un mes pasado (las demás pruebas escriben «ahora», así que nadie más toca ese mes).
//
// Cuida lo que la base no impide sola (scripts/invariantes.sql): el total de cada venta es la suma de sus ítems, cada ítem tiene su salida
// de stock, la venta anulada devolvió lo que vendió y el número del comprobante lo entregó su serie (tomar_numero). Y no mueve el stock ni
// las deudas de nadie: lo que se vende, se malogra o se debe se repone con una compra o se paga con un abono, y el cliente es uno propio.
// Se siembra una sola vez por mes: la marca queda en un gasto, que es lo último que se escribe.

const DUENIO = "10000000-0000-0000-0000-000000000001";
const NOMBRE_DEL_CLIENTE = "Cliente prueba Excel";
const MARCA_DE_DATOS ="PRUEBA-EXPORTAR";
export const MARCA_DE_PAGINAS = "PRUEBA-PAGINAS";
export const MOTIVO_DE_ANULACION = "Se equivocó de cliente";

/** Lo que el archivo de un mes sembrado tiene que decir. Se calcula a mano a partir de lo que se siembra abajo. */
export const ESPERADO = {
  ventasRegistradas: 3, // la de las 10, la del crédito y la del último día; la anulada no cuenta
  ventasAnuladas: 1,
  vendido: 770, // 500 + 230 + 40
  contado: 540,
  credito: 230,
  abonos: 230,
  gastos: 40,
  comprasAlContado: 480,
  cajasMalogradas: 3,
  // Efectivo: entran las dos ventas al contado (500 y 40), salen el gasto (40) y la compra al contado (480).
  efectivo: { entro: 540, salio: 520, neto: 20 },
  // Yape: solo el abono. La venta anulada de 100 por Yape no entró.
  yape: { entro: 230, salio: 0, neto: 230 },
} as const;

type Db = ReturnType<typeof baseLocal>;

function falla(donde: string, error: { message: string } | null): never {
  throw new Error(`No se pudo sembrar ${donde}: ${error?.message ?? "sin datos"}. Si quedó a medias: npx supabase db reset.`);
}

/** Un instante de Lima como lo guarda la base (UTC). `dia` 0 es el último día del mes anterior; `diasDelMes + 1`, el primero del siguiente. */
export function instanteDeLima(mes: string, dia: number, hora: number, minuto = 0): string {
  const [anio, delAnio] = mes.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(anio, delAnio - 1, dia, hora + 5, minuto)).toISOString();
}

export function diasDelMes(mes: string): number {
  const [anio, delAnio] = mes.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(anio, delAnio, 0)).getUTCDate();
}

/** El número de Excel de una fecha y hora de Lima, calculado aparte de la app: la hora tal cual se lee en el reloj del puesto. */
export function serialDeLima(mes: string, dia: number, hora: number, minuto = 0): number {
  const [anio, delAnio] = mes.split("-").map(Number) as [number, number];
  return Date.UTC(anio, delAnio - 1, dia, hora, minuto) / 86_400_000 + 25_569;
}

async function idDe(db: Db, tabla: string, filtros: Record<string, string>): Promise<number> {
  let consulta = db.from(tabla).select("id");
  for (const [columna, valor] of Object.entries(filtros)) consulta = consulta.eq(columna, valor);
  const { data, error } = await consulta.limit(1).maybeSingle();
  if (error || !data) falla(`${tabla} ${JSON.stringify(filtros)}`, error);
  return data.id as number;
}

async function clienteDePrueba(db: Db): Promise<number> {
  const { data } = await db.from("clientes").select("id").eq("nombre", NOMBRE_DEL_CLIENTE).limit(1).maybeSingle();
  if (data) return data.id as number;
  const { data: nuevo, error } = await db.from("clientes").insert({ nombre: NOMBRE_DEL_CLIENTE }).select("id").single();
  if (error || !nuevo) falla("el cliente", error);
  return nuevo.id as number;
}

type Linea = { producto: number; cajas: number; precio: number };

async function sembrarVenta(
  db: Db,
  v: { fecha: string; condicion: "contado" | "credito"; medio: string | null; cliente: number | null; lineas: Linea[]; anulada?: boolean },
): Promise<number> {
  const total = v.lineas.reduce((s, l) => s + l.cajas * l.precio, 0);
  const { data, error } = await db
    .from("ventas")
    .insert({
      fecha: v.fecha,
      condicion: v.condicion,
      medio_pago: v.medio,
      cliente_id: v.cliente,
      total,
      registrado_por: DUENIO,
      ...(v.anulada ? { estado: "anulada", anulada_en: v.fecha, anulada_por: DUENIO, motivo_anulacion: MOTIVO_DE_ANULACION } : {}),
    })
    .select("id")
    .single();
  if (error || !data) falla("una venta", error);
  const ventaId = data.id as number;
  const items = await db.from("venta_items").insert(v.lineas.map((l) => ({ venta_id: ventaId, producto_id: l.producto, cantidad: l.cajas, precio_unitario: l.precio, descuento: 0 })));
  if (items.error) falla("las líneas de una venta", items.error);
  const movimientos = v.lineas.flatMap((l) => [
    { producto_id: l.producto, tipo: "salida_venta", cantidad: -l.cajas, venta_id: ventaId, fecha: v.fecha, registrado_por: DUENIO },
    ...(v.anulada ? [{ producto_id: l.producto, tipo: "devolucion", cantidad: l.cajas, venta_id: ventaId, fecha: v.fecha, registrado_por: DUENIO }] : []),
  ]);
  const stock = await db.from("movimientos_stock").insert(movimientos);
  if (stock.error) falla("el stock de una venta", stock.error);
  return ventaId;
}

async function sembrarCompra(
  db: Db,
  c: { fecha: string; condicion: "contado" | "credito"; medio: string | null; proveedor: number; numero: string | null; producto: number; cajas: number; costo: number },
) {
  const { data, error } = await db
    .from("compras")
    .insert({ fecha: c.fecha, condicion: c.condicion, medio_pago: c.medio, proveedor_id: c.proveedor, numero_comprobante: c.numero, total: c.cajas * c.costo, registrado_por: DUENIO })
    .select("id")
    .single();
  if (error || !data) falla("una compra", error);
  const items = await db.from("compra_items").insert({ compra_id: data.id, producto_id: c.producto, cantidad: c.cajas, costo_unitario: c.costo });
  if (items.error) falla("las líneas de una compra", items.error);
  const stock = await db.from("movimientos_stock").insert({ producto_id: c.producto, tipo: "entrada_compra", cantidad: c.cajas, compra_id: data.id, fecha: c.fecha, registrado_por: DUENIO });
  if (stock.error) falla("el stock de una compra", stock.error);
}

/** ¿Ya tiene este mes la marca? */
async function yaSembrado(db: Db, mes: string, marca: string): Promise<number> {
  const siguiente = instanteDeLima(mes, diasDelMes(mes) + 1, 0);
  const { count, error } = await db
    .from("gastos")
    .select("id", { count: "exact", head: true })
    .like("descripcion", `${marca}%`)
    .gte("fecha", instanteDeLima(mes, 1, 0))
    .lt("fecha", siguiente);
  if (error) falla("la marca del mes", error);
  return count ?? 0;
}

/**
 * Siembra el mes con datos conocidos (ver ESPERADO). Trae dos ventas de borde que NO deben salir en este mes:
 * una el último día del mes anterior a las 11:59 p. m. de Lima (en UTC ya es el día 1 de este mes) y otra el día 1 del siguiente a las 12:30 a. m.
 * Y una que SÍ debe salir: el último día, a las 9 p. m. de Lima (en UTC ya es el día siguiente).
 */
export async function sembrarMes(mes: string): Promise<void> {
  const db = baseLocal();
  if ((await yaSembrado(db, mes, MARCA_DE_DATOS)) > 0) return;

  const [kent, edward, transportes, agricola] = await Promise.all([
    idDe(db, "productos", { nombre: "Mango", variedad: "Kent" }),
    idDe(db, "productos", { nombre: "Mango", variedad: "Edward" }),
    idDe(db, "proveedores", { nombre: "Transportes Piura Norte" }),
    idDe(db, "proveedores", { nombre: "Agrícola Chao" }),
  ]);
  const cliente = await clienteDePrueba(db);
  const ultimo = diasDelMes(mes);

  const primera = await sembrarVenta(db, { fecha: instanteDeLima(mes, 10, 9), condicion: "contado", medio: "efectivo", cliente, lineas: [{ producto: kent, cajas: 10, precio: 50 }] });
  await sembrarVenta(db, { fecha: instanteDeLima(mes, 11, 10), condicion: "credito", medio: null, cliente, lineas: [{ producto: edward, cajas: 4, precio: 57.5 }] });
  await sembrarVenta(db, { fecha: instanteDeLima(mes, 12, 11), condicion: "contado", medio: "yape", cliente: null, lineas: [{ producto: kent, cajas: 2, precio: 50 }], anulada: true });
  await sembrarVenta(db, { fecha: instanteDeLima(mes, ultimo, 21), condicion: "contado", medio: "efectivo", cliente: null, lineas: [{ producto: kent, cajas: 1, precio: 40 }] });
  // Los dos bordes que no son de este mes.
  await sembrarVenta(db, { fecha: instanteDeLima(mes, ultimo + 1, 0, 30), condicion: "contado", medio: "efectivo", cliente: null, lineas: [{ producto: kent, cajas: 1, precio: 99 }] });
  await sembrarVenta(db, { fecha: instanteDeLima(mes, 0, 23, 59), condicion: "contado", medio: "efectivo", cliente: null, lineas: [{ producto: kent, cajas: 1, precio: 77 }] });

  // Una boleta aceptada para la primera venta: el número lo entrega la serie, como en la app.
  const numero = await db.rpc("tomar_numero", { p_serie: "B001" });
  if (numero.error || typeof numero.data !== "number") falla("el número de la boleta", numero.error);
  const boleta = await db.from("comprobantes").insert({ venta_id: primera, tipo: "03", serie: "B001", numero: numero.data, estado: "aceptado" });
  if (boleta.error) falla("la boleta", boleta.error);

  // Lo vendido (13 cajas de Kent, la anulada ya devolvió las suyas) y malogrado (3) se repone: el stock queda como estaba.
  await sembrarCompra(db, { fecha: instanteDeLima(mes, 8, 8), condicion: "contado", medio: "efectivo", proveedor: transportes, numero: "F001-55", producto: kent, cajas: 16, costo: 30 });
  await sembrarCompra(db, { fecha: instanteDeLima(mes, 9, 8), condicion: "credito", medio: null, proveedor: agricola, numero: null, producto: edward, cajas: 4, costo: 40 });
  const merma = await db
    .from("movimientos_stock")
    .insert({ producto_id: kent, tipo: "merma", cantidad: -3, motivo: "Se malogró (prueba)", fecha: instanteDeLima(mes, 15, 9), registrado_por: DUENIO });
  if (merma.error) falla("la merma", merma.error);

  // La deuda del crédito se paga completa: el cliente queda en cero.
  const abono = await db
    .from("abonos")
    .insert({ cliente_id: cliente, monto: 230, medio_pago: "yape", nota: "Pagó todo (prueba)", fecha: instanteDeLima(mes, 13, 9), registrado_por: DUENIO });
  if (abono.error) falla("el abono", abono.error);

  // La marca va al final: si algo falló antes, el mes no queda marcado como completo.
  const gasto = await db
    .from("gastos")
    .insert({ categoria: "flete", monto: 40, medio_pago: "efectivo", descripcion: `${MARCA_DE_DATOS} camión`, fecha: instanteDeLima(mes, 14, 9), registrado_por: DUENIO });
  if (gasto.error) falla("el gasto", gasto.error);
}

/** El comprobante que se sembró en el mes: lo da la serie, así que se lee de la base en vez de suponerlo. */
export async function boletaSembrada(mes: string): Promise<string> {
  const db = baseLocal();
  const clienteId = await idDe(db, "clientes", { nombre: NOMBRE_DEL_CLIENTE });
  const { data: venta } = await db.from("ventas").select("id").eq("cliente_id", clienteId).eq("fecha", instanteDeLima(mes, 10, 9)).eq("condicion", "contado").limit(1).maybeSingle();
  const { data, error } = await db.from("comprobantes").select("serie, numero").eq("venta_id", venta?.id ?? -1).limit(1).maybeSingle();
  if (error || !data) falla("la lectura de la boleta", error);
  return `Boleta ${data.serie}-${String(data.numero).padStart(8, "0")}`;
}

/** Más de 1000 gastos en un mes: lo que Supabase devuelve en una consulta. Con una lectura sin páginas, el archivo saldría cortado. */
export async function sembrarPaginas(mes: string, cuantos: number): Promise<void> {
  const db = baseLocal();
  const hay = await yaSembrado(db, mes, MARCA_DE_PAGINAS);
  if (hay >= cuantos) return;
  const filas = Array.from({ length: cuantos - hay }, (_, i) => ({
    categoria: "otros",
    monto: 1,
    medio_pago: "efectivo",
    descripcion: `${MARCA_DE_PAGINAS} ${i + 1}`,
    fecha: instanteDeLima(mes, 5, 9, i % 60),
    registrado_por: DUENIO,
  }));
  const { error } = await db.from("gastos").insert(filas);
  if (error) falla("los gastos de las páginas", error);
}
