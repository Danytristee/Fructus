import { describe, expect, it } from "vitest";

import {
  armarPedido,
  ayudaDeComprobante,
  comprobanteAMostrar,
  comprobanteVigente,
  enlaceDeWhatsApp,
  fraseDeComprobante,
  leerConsulta,
  leerRespuesta,
  mensajeDeRespuesta,
  nombreDelTipo,
  notaDeComprobante,
  ofertaDeFactura,
  salidaDeRechazo,
  numeroDeComprobante,
  telefonoParaWhatsApp,
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
    expect(fraseDeComprobante({ ...base, estado: "aceptado" })).toEqual({ titulo: "Boleta B001-00000012", estado: "aceptada por SUNAT" });
    expect(fraseDeComprobante({ ...base, estado: "enviado" })).toEqual({ titulo: "Boleta B001-00000012", estado: "enviada, esperando a SUNAT" });
    expect(fraseDeComprobante({ ...base, estado: "pendiente" })).toEqual({ titulo: "Boleta B001-00000012", estado: "en proceso" });
    expect(fraseDeComprobante({ ...base, tipo: "01", serie: "F001", estado: "aceptado" })).toEqual({ titulo: "Factura F001-00000012", estado: "aceptada por SUNAT" });
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

// ---------------------------------------------------------------------------------------------------------------------
// A9.3 · Cuando el proveedor falla
// ---------------------------------------------------------------------------------------------------------------------

describe("leerRespuesta cuando algo sale mal", () => {
  it("«ya existe» (409): el proveedor ya tiene ese número; hay que preguntarle cómo quedó, no repetirlo", () => {
    expect(leerRespuesta(409, { mensaje: "El comprobante ya existe" })).toEqual({ tipo: "ya-existe" });
    expect(leerRespuesta(409, null)).toEqual({ tipo: "ya-existe" });
  });

  it("un pedido mal formado (400 o 422) es un rechazo, con su motivo si lo trae", () => {
    expect(leerRespuesta(422, { mensaje: "El RUC del cliente no existe" })).toMatchObject({ tipo: "rechazado", mensaje: "El RUC del cliente no existe" });
    expect(leerRespuesta(400, { mensaje: "Falta el cliente" })).toMatchObject({ tipo: "rechazado", mensaje: "Falta el cliente" });
    expect(leerRespuesta(400, null)).toMatchObject({ tipo: "rechazado", mensaje: "El comprobante fue rechazado" });
  });

  it("una clave mala (401, 403), una ruta que no existe (404) o una caída (5xx) NO son un rechazo del comprobante: es «sin respuesta»", () => {
    for (const estado of [401, 403, 404, 429, 500, 502, 503]) expect(leerRespuesta(estado, { mensaje: "x" }), String(estado)).toMatchObject({ tipo: "sin-respuesta" });
  });

  it("el motivo de un rechazo se recorta: no entra un texto de 5000 letras a la pantalla", () => {
    const r = leerRespuesta(200, { estado: "rechazado", mensaje: "x".repeat(900) });
    expect(r.tipo).toBe("rechazado");
    if (r.tipo === "rechazado") expect(r.mensaje.length).toBeLessThanOrEqual(300);
  });
});

describe("leerConsulta (preguntarle al proveedor cómo quedó un número)", () => {
  it("lo que contesta con un éxito se lee igual que al emitir", () => {
    expect(leerConsulta(200, { estado: "aceptado", pdf_url: "https://lucode.test/pdf/B001-12" })).toMatchObject({ tipo: "aceptado", pdfUrl: "https://lucode.test/pdf/B001-12" });
    expect(leerConsulta(200, { estado: "enviado" })).toMatchObject({ tipo: "enviado" });
    expect(leerConsulta(200, { estado: "rechazado", mensaje: "no" })).toMatchObject({ tipo: "rechazado", mensaje: "no" });
  });

  it("un 404 dice que el proveedor no conoce ese número: no es un rechazo", () => {
    expect(leerConsulta(404, { mensaje: "no existe" })).toEqual({ tipo: "no-existe" });
  });

  it("lo demás es «sin respuesta» (y, en una consulta, un 409 o un 400 no significan nada)", () => {
    expect(leerConsulta(500, {})).toMatchObject({ tipo: "sin-respuesta" });
    expect(leerConsulta(409, {})).toMatchObject({ tipo: "sin-respuesta" });
    expect(leerConsulta(400, {})).toMatchObject({ tipo: "sin-respuesta" });
    expect(leerConsulta(200, "raro")).toMatchObject({ tipo: "sin-respuesta" });
  });
});

describe("mensajeDeRespuesta (el motivo guardado de un rechazo)", () => {
  it("saca el mensaje de la respuesta cruda, o nada si no hay", () => {
    expect(mensajeDeRespuesta({ estado: "rechazado", mensaje: "El RUC no existe" })).toBe("El RUC no existe");
    expect(mensajeDeRespuesta({ estado: "rechazado" })).toBeNull();
    expect(mensajeDeRespuesta(null)).toBeNull();
    expect(mensajeDeRespuesta("texto")).toBeNull();
    expect(mensajeDeRespuesta({ mensaje: 42 })).toBeNull();
  });
});

describe("ayudaDeComprobante (qué hacer con uno que no terminó)", () => {
  it("pendiente: no hubo respuesta, se reintenta con el mismo número; enviado: se pregunta cómo va; aceptado: nada", () => {
    expect(ayudaDeComprobante("pendiente")).toEqual({ texto: "No llegó respuesta. Reintenta: lleva el mismo número y no se repite.", boton: "Reintentar" });
    expect(ayudaDeComprobante("enviado")).toEqual({ texto: "SUNAT todavía no contesta.", boton: "Ver cómo va" });
    expect(ayudaDeComprobante("aceptado")).toBeNull();
    expect(ayudaDeComprobante("rechazado")).toBeNull();
  });
});

describe("comprobanteAMostrar (el que se ve en el detalle de la venta)", () => {
  const c = (id: number, estado: string, motivo: string | null = null) => ({ id, tipo: "03" as const, serie: "B001", numero: id, estado, pdfUrl: null, motivo });

  it("el vigente manda sobre cualquier rechazado anterior", () => {
    expect(comprobanteAMostrar([c(1, "rechazado", "no"), c(2, "aceptado")])?.id).toBe(2);
  });

  it("sin uno vigente se muestra el último rechazado (con su motivo): quien mira entiende por qué no hay comprobante", () => {
    expect(comprobanteAMostrar([c(1, "rechazado", "uno"), c(3, "rechazado", "tres"), c(2, "rechazado", "dos")])).toMatchObject({ id: 3, motivo: "tres" });
  });

  it("un anulado o nada: no se muestra nada", () => {
    expect(comprobanteAMostrar([c(1, "anulado")])).toBeNull();
    expect(comprobanteAMostrar([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// A9.4 · Al dictar la venta: en qué quedó el comprobante que se pidió
// ---------------------------------------------------------------------------------------------------------------------

describe("notaDeComprobante (lo que dice el sello de la venta dictada)", () => {
  const vista = (estado: string, extra: Record<string, unknown> = {}) => ({ id: 1, tipo: "03" as const, serie: "B001", numero: 12, estado, pdfUrl: null, ...extra });

  it("aceptado: dice qué número salió", () => {
    expect(notaDeComprobante("boleta", { ok: true, comprobante: vista("aceptado") })).toBe("Boleta B001-00000012 aceptada por SUNAT");
    expect(notaDeComprobante("factura", { ok: true, comprobante: { ...vista("aceptado"), tipo: "01", serie: "F001" } })).toBe("Factura F001-00000012 aceptada por SUNAT");
  });

  it("en proceso o enviado: la venta ya está guardada y dice dónde terminarlo", () => {
    expect(notaDeComprobante("boleta", { ok: true, comprobante: vista("pendiente") })).toBe("Boleta B001-00000012 en proceso: termínala desde la venta");
    expect(notaDeComprobante("boleta", { ok: true, comprobante: vista("enviado") })).toBe("Boleta B001-00000012 enviada, esperando a SUNAT");
  });

  it("rechazada: dice por qué y que la venta quedó guardada", () => {
    expect(notaDeComprobante("factura", { ok: false, error: "x", comprobante: { ...vista("rechazado", { motivo: "El RUC del cliente no existe" }), tipo: "01", serie: "F001" } })).toBe(
      "La venta quedó guardada, pero la factura fue rechazada: El RUC del cliente no existe",
    );
    expect(notaDeComprobante("boleta", { ok: false, error: "x", comprobante: vista("rechazado") })).toBe("La venta quedó guardada, pero la boleta fue rechazada.");
  });

  it("no salió (falta el RUC, sin señal…): la venta quedó guardada y se dice qué pasó, en lenguaje de puesto", () => {
    expect(notaDeComprobante("factura", { ok: false, error: "Una factura va a un cliente con RUC. Agrégale el RUC en su ficha." })).toBe(
      "La venta quedó guardada, pero la factura no salió: Una factura va a un cliente con RUC. Agrégale el RUC en su ficha.",
    );
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// A9.5 · El PDF y «Enviar por WhatsApp»
// ---------------------------------------------------------------------------------------------------------------------

describe("telefonoParaWhatsApp", () => {
  it("un celular peruano (9 dígitos que empiezan con 9) lleva el 51 de Perú, con o sin espacios, guiones o +", () => {
    expect(telefonoParaWhatsApp("987 654 321")).toBe("51987654321");
    expect(telefonoParaWhatsApp("987-654-321")).toBe("51987654321");
    expect(telefonoParaWhatsApp("+51 987 654 321")).toBe("51987654321");
    expect(telefonoParaWhatsApp("51987654321")).toBe("51987654321");
  });

  it("un fijo, un número cortado o nada: no se usa un número que no es de WhatsApp (se abre sin destinatario)", () => {
    expect(telefonoParaWhatsApp("(044) 234567")).toBeNull();
    expect(telefonoParaWhatsApp("98765")).toBeNull();
    expect(telefonoParaWhatsApp("887 654 321")).toBeNull();
    expect(telefonoParaWhatsApp("")).toBeNull();
    expect(telefonoParaWhatsApp(null)).toBeNull();
  });
});

describe("enlaceDeWhatsApp", () => {
  const comprobante = { tipo: "03" as const, serie: "B001", numero: 12 };
  const texto = (enlace: string) => decodeURIComponent(enlace.split("?text=")[1]!);

  it("al número del cliente, con su nombre, qué comprobante es, cuánto fue y el enlace al PDF", () => {
    const enlace = enlaceDeWhatsApp({ telefono: "987 654 321", nombre: "Luis Paredes", comprobante, total: 450, pdfUrl: "https://lucode.test/pdf/B001-00000012" });
    expect(enlace.startsWith("https://wa.me/51987654321?text=")).toBe(true);
    expect(texto(enlace)).toBe("Hola Luis Paredes, te envío tu boleta B001-00000012 por S/ 450.00: https://lucode.test/pdf/B001-00000012");
  });

  it("sin teléfono se abre WhatsApp para elegir a quién; y una factura se dice factura", () => {
    const enlace = enlaceDeWhatsApp({ telefono: null, nombre: "Juguería El Paraíso", comprobante: { tipo: "01", serie: "F001", numero: 3 }, total: 1250.5, pdfUrl: "https://lucode.test/pdf/F001-00000003" });
    expect(enlace.startsWith("https://wa.me/?text=")).toBe(true);
    expect(texto(enlace)).toBe("Hola Juguería El Paraíso, te envío tu factura F001-00000003 por S/ 1,250.50: https://lucode.test/pdf/F001-00000003");
  });

  it("una venta al paso no tiene nombre: el saludo no lo inventa", () => {
    expect(texto(enlaceDeWhatsApp({ telefono: null, nombre: null, comprobante, total: 45, pdfUrl: "https://lucode.test/pdf/B001-00000012" }))).toBe(
      "Hola, te envío tu boleta B001-00000012 por S/ 45.00: https://lucode.test/pdf/B001-00000012",
    );
  });

  it("el mensaje va codificado: un nombre con & o ? no rompe el enlace", () => {
    const enlace = enlaceDeWhatsApp({ telefono: null, nombre: "Ñañez & Hijos?", comprobante, total: 10, pdfUrl: "https://lucode.test/pdf/B001-00000012" });
    expect(enlace.split("?text=")).toHaveLength(2);
    expect(texto(enlace)).toContain("Ñañez & Hijos?");
  });
});

describe("salidaDeRechazo (qué hacer con un comprobante rechazado)", () => {
  it("quien edita clientes va a la ficha; el ayudante avisa al dueño; sin cliente solo se emite otro", () => {
    expect(salidaDeRechazo(true, true)).toBe("corregir-ficha");
    expect(salidaDeRechazo(true, false)).toBe("pedir-al-dueno");
    expect(salidaDeRechazo(false, true)).toBe("emitir-otro");
    expect(salidaDeRechazo(false, false)).toBe("emitir-otro");
  });
});
