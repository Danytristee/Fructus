// Convierte el libro que armó lib/exportar-reglas.ts en un archivo .xlsx con SheetJS (ADR-0005, pila: se instala desde su CDN oficial).
// Solo se importa desde la ruta /api/exportar: SheetJS pesa cientos de KB y no debe llegar nunca al celular.
//
// Cada celda se escribe a mano con su tipo («s» texto, «n» número) y no con aoa_to_sheet: así un nombre de cliente o una nota que empiece
// con «=» o «+» queda como texto y Excel no lo ejecuta como fórmula.
import * as XLSX from "xlsx";

import type { Formato, Libro } from "./exportar-reglas";

// Los formatos de número de Excel. «General» (sin `z`) muestra 10 como 10 y 2.5 como 2.5, que es como se dicen las cajas.
const FORMATOS: Record<Formato, string | undefined> = {
  soles: '"S/ "#,##0.00',
  "fecha-hora": "dd/mm/yyyy hh:mm",
  numero: undefined,
};

export const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function libroAXlsx(libro: Libro): Buffer {
  const archivo = XLSX.utils.book_new();
  for (const hoja of libro) {
    const celdas: XLSX.WorkSheet = {};
    const columnas = Math.max(hoja.anchos.length, ...hoja.filas.map((f) => f.length));
    hoja.filas.forEach((fila, r) => {
      fila.forEach((celda, c) => {
        if (celda === null) return;
        const referencia = XLSX.utils.encode_cell({ r, c });
        if (typeof celda === "string") {
          celdas[referencia] = { t: "s", v: celda };
          return;
        }
        const formato = FORMATOS[celda.f];
        celdas[referencia] = formato ? { t: "n", v: celda.v, z: formato } : { t: "n", v: celda.v };
      });
    });
    const ultimaFila = Math.max(hoja.filas.length - 1, 0);
    celdas["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: ultimaFila, c: Math.max(columnas - 1, 0) } });
    celdas["!cols"] = hoja.anchos.map((wch) => ({ wch }));
    if (hoja.encabezado !== undefined) {
      celdas["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: hoja.encabezado, c: 0 }, e: { r: ultimaFila, c: Math.max(columnas - 1, 0) } }) };
    }
    XLSX.utils.book_append_sheet(archivo, celdas, hoja.nombre);
  }
  return XLSX.write(archivo, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
}
