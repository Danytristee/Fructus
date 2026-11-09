import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { serialExcel, type Libro } from "./exportar-reglas";
import { libroAXlsx } from "./exportar-xlsx";

const libro: Libro = [
  {
    nombre: "Ventas",
    anchos: [18, 28, 14],
    encabezado: 0,
    filas: [
      ["Fecha", "Cliente", "Total"],
      // 14:00 UTC = 9:00 a. m. en Lima, del 3 de octubre.
      [{ v: serialExcel("2026-10-03T14:00:00+00:00"), f: "fecha-hora" }, "Don Lucho", { v: 1250.5, f: "soles" }],
      [{ v: serialExcel("2026-10-03T14:30:00+00:00"), f: "fecha-hora" }, "=HYPERLINK(\"http://ejemplo.test\",\"cobrar\")", { v: 20, f: "soles" }],
      [null, "+52 cajas", null],
    ],
  },
  { nombre: "Vacía", anchos: [10], filas: [["Solo el título"]], encabezado: 0 },
];

function leer() {
  // cellStyles: sin esto SheetJS no devuelve los anchos de columna al leer (sí los escribe).
  return XLSX.read(libroAXlsx(libro), { type: "buffer", cellStyles: true });
}

function hojaDe(nombre: string) {
  const hoja = leer().Sheets[nombre];
  if (!hoja) throw new Error(`falta la hoja ${nombre}`);
  return hoja;
}

describe("libroAXlsx", () => {
  it("es un .xlsx de verdad: un zip que Excel abre, con las hojas con su nombre y en su orden", () => {
    const bytes = libroAXlsx(libro);
    expect(bytes.subarray(0, 2).toString()).toBe("PK"); // un .xlsx es un zip
    expect(leer().SheetNames).toEqual(["Ventas", "Vacía"]);
  });

  it("los montos son números con formato de soles: se ven «S/ 1,250.50» y se pueden sumar", () => {
    const celda = hojaDe("Ventas").C2;
    expect(celda.t).toBe("n");
    expect(celda.v).toBe(1250.5);
    expect(celda.w).toBe('S/ 1,250.50');
  });

  it("la fecha es un número con formato de fecha y hora, con la hora de Lima sin importar la zona del servidor", () => {
    const celda = hojaDe("Ventas").A2;
    expect(celda.t).toBe("n");
    expect(celda.w).toBe("03/10/2026 09:00");
  });

  it("un texto que empieza con «=» o «+» queda como texto: Excel no lo ejecuta como fórmula", () => {
    const hoja = hojaDe("Ventas");
    expect(hoja.B3.t).toBe("s");
    expect(hoja.B3.f).toBeUndefined();
    expect(hoja.B3.v).toBe('=HYPERLINK("http://ejemplo.test","cobrar")');
    expect(hoja.B4.t).toBe("s");
    expect(hoja.B4.f).toBeUndefined();
  });

  it("las celdas vacías quedan vacías, no con un 0 ni un texto", () => {
    const hoja = hojaDe("Ventas");
    expect(hoja.A4).toBeUndefined();
    expect(hoja.C4).toBeUndefined();
  });

  it("lleva el filtro desde los títulos hasta la última fila, y el ancho de cada columna", () => {
    const hoja = hojaDe("Ventas");
    expect(hoja["!autofilter"]?.ref).toBe("A1:C4");
    expect(hoja["!cols"]?.map((c) => c.wch)).toEqual([18, 28, 14]);
    expect(hoja["!ref"]).toBe("A1:C4");
  });

  it("una hoja con solo los títulos también se abre", () => {
    expect(hojaDe("Vacía")["!ref"]).toBe("A1"); // el rango de una sola celda se escribe así
  });
});
