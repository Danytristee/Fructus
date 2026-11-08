import { describe, expect, it } from "vitest";

import {
  armarPedido,
  comprobanteVigente,
  fraseDeComprobante,
  leerRespuesta,
  nombreDelTipo,
  ofertaDeFactura,
  numeroDeComprobante,
  type DatosDeVenta,
} from "./comprobante-reglas";

const emisor = { ruc: "20600000001", razonSocial: "Frutas La Hermelinda SAC" };
const referencia = { tipo: "03" as const, serie: "B001", numero: 12 };

const mango: DatosDeVenta["items"][number] = { descripcion: "Mango Kent", cantidad: 10, precioUnitario: 45, descuento: 0, subtotal: 450, afectacionIgv: "20" };
const alPaso = (items: DatosDeVenta["items"]): DatosDeVenta => ({ fecha: "2026-11-07", total: items.reduce((s, i) => s + i.subtotal, 0), cliente: null, items });

describe("el número del comprobante", () => {
  it("se dice como en el papel: serie, guion y correlativo de 8 cifras", () => {
    expect(numeroDeComprobante("B001", 12)).toBe("B001-00000012");
    expect(numeroDeComprobante("F001", 123456)).toBe("F001-00123456");
  });

  it("01 es factura y 03 es boleta", () => {
    expect(nombreDelTipo("01")).toBe("Factura");
    expect(nombreDelTipo("03")).toBe("Boleta");
  });
});

describe("armarPedido", () => {
  it("una boleta al paso va a «clientes varios», con la fruta exonerada: sin IGV y el total igual a lo vendido", () => {
    const p = armarPedido(referencia, alPaso([mango]), emisor);
    expect(p).toMatchObject({
      tipo: "03",
      serie: "B001",
      numero: 12,
      fecha_emision: "2026-11-07",
      moneda: "PEN",
      emisor: { ruc: "20600000001", razon_social: "Frutas La Hermelinda SAC" },
      cliente: { tipo_documento: "0", numero_documento: "-", nombre: "CLIENTES VARIOS" },
      totales: { gravado: 0, exonerado: 450, igv: 0, total: 450 },
    });
    expect(p.items).toEqual([
      { descripcion: "Mango Kent", unidad: "NIU", cantidad: 10, precio_unitario: 45, valor_venta: 450, afectacion_igv: "20", igv: 0 },
    ]);
  });

  it("al cliente con DNI o con RUC se le pone su documento y su nombre", () => {
    const dni = armarPedido(referencia, { ...alPaso([mango]), cliente: { tipoDocumento: "DNI", numeroDocumento: "40123456", nombre: "Luis Paredes" } }, emisor);
    expect(dni.cliente).toEqual({ tipo_documento: "1", numero_documento: "40123456", nombre: "Luis Paredes" });
    const ruc = armarPedido({ ...referencia, tipo: "01", serie: "F001" }, { ...alPaso([mango]), cliente: { tipoDocumento: "RUC", numeroDocumento: "20601234567", nombre: "Juguería El Paraíso" } }, emisor);
    expect(ruc.cliente).toEqual({ tipo_documento: "6", numero_documento: "20601234567", nombre: "Juguería El Paraíso" });
  });

  it("un cliente sin documento va como «clientes varios», aunque tenga nombre (la boleta chica no lo exige)", () => {
    const p = armarPedido(referencia, { ...alPaso([mango]), cliente: { tipoDocumento: null, numeroDocumento: null, nombre: "Rosa Quispe" } }, emisor);
    expect(p.cliente).toEqual({ tipo_documento: "0", numero_documento: "-", nombre: "Rosa Quispe" });
  });

  it("lo gravado (afectación 10) trae el IGV de 18 % incluido en el precio: 118 son 100 más 18", () => {
    const p = armarPedido(referencia, alPaso([{ descripcion: "Envase", cantidad: 1, precioUnitario: 118, descuento: 0, subtotal: 118, afectacionIgv: "10" }]), emisor);
    expect(p.items[0]).toMatchObject({ valor_venta: 100, igv: 18, afectacion_igv: "10" });
    expect(p.totales).toEqual({ gravado: 100, exonerado: 0, igv: 18, total: 118 });
  });

  it("mezcla de exonerado y gravado: los totales cuadran con lo vendido, al céntimo", () => {
    const p = armarPedido(referencia, alPaso([mango, { descripcion: "Envase", cantidad: 3, precioUnitario: 10.01, descuento: 0, subtotal: 30.03, afectacionIgv: "10" }]), emisor);
    expect(p.totales.total).toBe(480.03);
    expect(Math.round((p.totales.gravado + p.totales.igv + p.totales.exonerado) * 100)).toBe(48003);
    expect(p.items.reduce((s, i) => s + Math.round((i.valor_venta + i.igv) * 100), 0)).toBe(48003);
  });

  it("el descuento ya viene en el subtotal: lo que se factura es el subtotal, no cantidad por precio", () => {
    const p = armarPedido(referencia, alPaso([{ descripcion: "Papaya", cantidad: 1, precioUnitario: 35, descuento: 5, subtotal: 30, afectacionIgv: "20" }]), emisor);
    expect(p.items[0]).toMatchObject({ valor_venta: 30, precio_unitario: 35 });
    expect(p.totales.total).toBe(30);
  });

  it("lo inafecto o con otro código se trata sin IGV (como lo exonerado): no se inventa un impuesto", () => {
    const p = armarPedido(referencia, alPaso([{ ...mango, afectacionIgv: "30" }]), emisor);
    expect(p.items[0]).toMatchObject({ igv: 0, afectacion_igv: "30" });
    expect(p.totales).toMatchObject({ gravado: 0, igv: 0, total: 450 });
  });
});

describe("leerRespuesta (lo que dice el proveedor)", () => {
  const cuerpo = { estado: "aceptado", pdf_url: "https://lucode.test/pdf/B001-12", xml_url: "https://lucode.test/xml/B001-12" };

  it("aceptado trae el enlace al PDF y al XML, y guarda la respuesta cruda tal cual", () => {
    expect(leerRespuesta(200, cuerpo)).toEqual({ tipo: "aceptado", pdfUrl: "https://lucode.test/pdf/B001-12", xmlUrl: "https://lucode.test/xml/B001-12", cruda: cuerpo });
  });

  it("aceptado sin enlaces sigue siendo aceptado: el PDF es un extra", () => {
    expect(leerRespuesta(200, { estado: "aceptado" })).toMatchObject({ tipo: "aceptado", pdfUrl: null, xmlUrl: null });
  });

  it("rechazado dice por qué", () => {
    expect(leerRespuesta(200, { estado: "rechazado", mensaje: "El RUC del cliente no existe" })).toMatchObject({ tipo: "rechazado", mensaje: "El RUC del cliente no existe" });
  });

  it("enviado: lo recibió pero SUNAT todavía no contesta", () => {
    expect(leerRespuesta(202, { estado: "enviado" })).toMatchObject({ tipo: "enviado" });
  });

  it("lo que no se entiende, o no es un éxito del servidor, es «sin respuesta»: no se asume ni éxito ni rechazo", () => {
    expect(leerRespuesta(200, { algo: "raro" })).toMatchObject({ tipo: "sin-respuesta" });
    expect(leerRespuesta(200, "texto suelto")).toMatchObject({ tipo: "sin-respuesta" });
    expect(leerRespuesta(200, null)).toMatchObject({ tipo: "sin-respuesta" });
    expect(leerRespuesta(500, { estado: "aceptado" })).toMatchObject({ tipo: "sin-respuesta" });
    expect(leerRespuesta(401, { mensaje: "token" })).toMatchObject({ tipo: "sin-respuesta" });
  });

  it("un enlace que no es una dirección no se guarda", () => {
    expect(leerRespuesta(200, { estado: "aceptado", pdf_url: "javascript:alert(1)" })).toMatchObject({ tipo: "aceptado", pdfUrl: null });
  });
});

describe("comprobanteVigente", () => {
  const c = (estado: string, id = 1) => ({ id, tipo: "03" as const, serie: "B001", numero: id, estado, pdfUrl: null });

  it("es el que está pendiente, enviado o aceptado; el rechazado y el anulado ya no cuentan", () => {
    expect(comprobanteVigente([c("rechazado", 1), c("aceptado", 2)])?.id).toBe(2);
    expect(comprobanteVigente([c("pendiente", 3)])?.id).toBe(3);
    expect(comprobanteVigente([c("enviado", 4)])?.id).toBe(4);
    expect(comprobanteVigente([c("rechazado", 1), c("anulado", 2)])).toBeNull();
    expect(comprobanteVigente([])).toBeNull();
  });
});

describe("fraseDeComprobante", () => {
  it("dice qué es y en qué quedó, en palabras de puesto", () => {
    const base = { id: 1, tipo: "03" as const, serie: "B001", numero: 12, pdfUrl: null };
    expect(fraseDeComprobante({ ...base, estado: "aceptado" })).toEqual({ titulo: "Boleta B001-00000012", estado: "aceptada" });
    expect(fraseDeComprobante({ ...base, estado: "enviado" })).toEqual({ titulo: "Boleta B001-00000012", estado: "enviada, esperando a SUNAT" });
    expect(fraseDeComprobante({ ...base, estado: "pendiente" })).toEqual({ titulo: "Boleta B001-00000012", estado: "en proceso" });
    expect(fraseDeComprobante({ ...base, tipo: "01", serie: "F001", estado: "aceptado" })).toEqual({ titulo: "Factura F001-00000012", estado: "aceptada" });
  });
});

describe("ofertaDeFactura (qué se le ofrece a quien mira la venta)", () => {
  it("una venta al paso no recibe factura: la factura lleva el RUC de un cliente", () => {
    expect(ofertaDeFactura(null, true)).toBeNull();
  });

  it("a un cliente con RUC la factura sale directo", () => {
    expect(ofertaDeFactura({ tipoDocumento: "RUC" }, false)).toBe("emitir");
    expect(ofertaDeFactura({ tipoDocumento: "RUC" }, true)).toBe("emitir");
  });

  it("a un cliente sin documento, quien puede editar clientes pide el RUC; quien no puede, no ve la factura", () => {
    expect(ofertaDeFactura({ tipoDocumento: null }, true)).toBe("pedir-ruc");
    expect(ofertaDeFactura({ tipoDocumento: null }, false)).toBeNull();
  });

  it("un cliente con DNI no recibe factura desde aquí: su documento es el DNI y no se pisa sin avisar (se cambia en su ficha)", () => {
    expect(ofertaDeFactura({ tipoDocumento: "DNI" }, true)).toBeNull();
    expect(ofertaDeFactura({ tipoDocumento: "DNI" }, false)).toBeNull();
  });
});
