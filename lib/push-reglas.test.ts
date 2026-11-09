import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { ResumenHoy } from "./hoy-reglas";
import {
  avisoDeActivacion,
  avisoDelDia,
  clasificarRespuesta,
  claveParaElNavegador,
  direccionDeAvisoValida,
  esquemaSuscripcion,
  estadoDelAviso,
  HORA_DEL_AVISO_LIMA,
  HORA_DEL_AVISO_TEXTO,
} from "./push-reglas";

/** La pantalla usa espacios duros («S/ », «58 cajas») para que no se parta un renglón: aquí se comparan como espacios normales. */
const plano = <T extends { titulo: string; cuerpo: string }>(a: T | null): T | null => (a && { ...a, titulo: a.titulo.replace(/\u00a0/g, " "), cuerpo: a.cuerpo.replace(/\u00a0/g, " ") });

const dia = (cambios: Partial<ResumenHoy> = {}): ResumenHoy => ({
  vendido: 1250,
  contado: 800,
  credito: 450,
  cobrado: 1030,
  abonos: 230,
  porCobrar: 3420,
  numeroVentas: 9,
  cajas: 58,
  compras: 0,
  gastos: 0,
  ...cambios,
});

describe("la hora del aviso", () => {
  it("vercel.json la dice en UTC y es la misma de Lima: 7 p. m. en Lima es medianoche UTC", () => {
    const { crons } = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons?: { path: string; schedule: string }[] };
    const cron = crons?.find((c) => c.path === "/api/cron/resumen-diario");
    expect(cron, "vercel.json tiene que programar /api/cron/resumen-diario").toBeDefined();
    const [minuto, hora, ...resto] = cron!.schedule.split(" ");
    expect(resto).toEqual(["*", "*", "*"]); // una vez al día: el plan Hobby no deja más
    expect(minuto).toBe("0");
    expect((Number(hora) + 24 - 5) % 24).toBe(HORA_DEL_AVISO_LIMA); // Lima es UTC−5, sin horario de verano
  });

  it("en pantalla se dice «como a las 7 p. m.»: en Hobby el cron corre dentro de la hora, no a la hora exacta", () => {
    expect(HORA_DEL_AVISO_TEXTO).toBe("como a las 7 p. m.");
  });
});

describe("direccionDeAvisoValida", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/dXNlcjpwcnVlYmE",
    "https://jmt17.google.com/fcm/send/dXNlcjpwcnVlYmE", // el que dio un Chrome de verdad
    "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
    "https://web.push.apple.com/QGv2-sDnXjOq",
    "https://wns2-pn1p.notify.windows.com/w/?token=BQYAAAB",
  ])("acepta la de un servicio de avisos conocido: %s", (direccion) => {
    expect(direccionDeAvisoValida(direccion)).toBe(true);
  });

  it.each([
    ["una dirección sin https", "http://fcm.googleapis.com/fcm/send/abc"],
    ["la propia máquina", "https://localhost/fcm/send/abc"],
    ["una dirección de la red interna", "https://169.254.169.254/latest/meta-data"],
    ["otra IP", "https://127.0.0.1/fcm/send/abc"],
    ["un dominio que solo contiene el nombre", "https://fcm.googleapis.com.malo.example/fcm/send/abc"],
    ["un dominio que termina parecido", "https://malofcm.googleapis.com/fcm/send/abc"],
    ["un dominio de Apple pegado a otro texto", "https://mala-push.apple.com/abc"],
    ["otro servicio de Google que no es de avisos", "https://docs.google.com/fcm/send/abc"],
    ["el de Google con algo más pegado", "https://jmt17.google.com.malo.example/fcm/send/abc"],
    ["credenciales en la dirección", "https://usuario:clave@fcm.googleapis.com/fcm/send/abc"],
    ["un puerto", "https://fcm.googleapis.com:8443/fcm/send/abc"],
    ["texto que no es una dirección", "no-es-una-direccion"],
    ["vacía", ""],
  ])("rechaza %s", (_que, direccion) => {
    expect(direccionDeAvisoValida(direccion)).toBe(false);
  });
});

describe("esquemaSuscripcion", () => {
  const buena = {
    endpoint: "https://fcm.googleapis.com/fcm/send/dXNlcjpwcnVlYmE",
    keys: {
      p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
      auth: "tBHItJI5svbpez7KI4CCXg",
    },
  };

  it("acepta lo que da el navegador (y deja pasar campos de más, como expirationTime)", () => {
    expect(esquemaSuscripcion.safeParse({ ...buena, expirationTime: null }).success).toBe(true);
  });

  it("rechaza una dirección que no es de un servicio de avisos, aunque las claves estén bien", () => {
    expect(esquemaSuscripcion.safeParse({ ...buena, endpoint: "https://interno.example/aviso" }).success).toBe(false);
  });

  it("rechaza claves que no tienen la forma de las del navegador o que faltan", () => {
    expect(esquemaSuscripcion.safeParse({ ...buena, keys: { ...buena.keys, p256dh: "corta" } }).success).toBe(false);
    expect(esquemaSuscripcion.safeParse({ ...buena, keys: { ...buena.keys, auth: "con espacios y ñ!!!!!!!!!!!" } }).success).toBe(false);
    expect(esquemaSuscripcion.safeParse({ endpoint: buena.endpoint }).success).toBe(false);
    expect(esquemaSuscripcion.safeParse(null).success).toBe(false);
  });
});

describe("avisoDelDia", () => {
  it("dice lo vendido, lo cobrado y lo que te deben, con las cifras de «Hoy», y lleva al cierre", () => {
    expect(plano(avisoDelDia(dia(), "2026-11-08"))).toEqual({
      titulo: "Vendiste S/ 1,250.00 hoy",
      cuerpo: "58 cajas en 9 ventas · Cobraste S/ 1,030.00 · Te deben S/ 3,420.00",
      url: "/cierre",
      tag: "resumen-2026-11-08",
    });
  });

  it("cobraste es el contado más los abonos: no cuenta lo vendido al crédito", () => {
    expect(plano(avisoDelDia(dia({ contado: 800, abonos: 230, cobrado: 1030 }), "2026-11-08"))?.cuerpo).toContain("Cobraste S/ 1,030.00");
  });

  it("singular y sin deudas: «1 caja en 1 venta» y «Nadie te debe»", () => {
    const aviso = avisoDelDia(dia({ numeroVentas: 1, cajas: 1, vendido: 45, contado: 45, credito: 0, cobrado: 45, abonos: 0, porCobrar: 0 }), "2026-11-08");
    expect(plano(aviso)).toMatchObject({ titulo: "Vendiste S/ 45.00 hoy", cuerpo: "1 caja en 1 venta · Cobraste S/ 45.00 · Nadie te debe" });
  });

  it("un día sin ventas pero con abonos avisa lo cobrado", () => {
    const aviso = avisoDelDia(dia({ numeroVentas: 0, cajas: 0, vendido: 0, contado: 0, credito: 0, cobrado: 230, abonos: 230 }), "2026-11-08");
    expect(plano(aviso)).toMatchObject({ titulo: "Hoy cobraste S/ 230.00 en abonos", cuerpo: "No hubo ventas · Te deben S/ 3,420.00" });
  });

  it("un día sin ventas ni abonos no avisa nada: sería ruido, y el dueño aprendería a ignorar el aviso", () => {
    expect(avisoDelDia(dia({ numeroVentas: 0, cajas: 0, vendido: 0, contado: 0, credito: 0, cobrado: 0, abonos: 0 }), "2026-11-08")).toBeNull();
    // Solo gastos o compras tampoco: lo que importa del cierre es lo que entró.
    expect(avisoDelDia(dia({ numeroVentas: 0, cajas: 0, vendido: 0, contado: 0, credito: 0, cobrado: 0, abonos: 0, gastos: 60, compras: 400 }), "2026-11-08")).toBeNull();
  });

  it("la etiqueta lleva el día: un aviso de otro día no reemplaza al de hoy", () => {
    expect(avisoDelDia(dia(), "2026-11-08")?.tag).not.toBe(avisoDelDia(dia(), "2026-11-09")?.tag);
  });

  it("lleva solo cifras del día: ni nombres de clientes ni teléfonos", () => {
    const aviso = avisoDelDia(dia(), "2026-11-08")!;
    expect(`${aviso.titulo} ${aviso.cuerpo}`).not.toMatch(/\d{9}|don |doña /i);
  });
});

describe("avisoDeActivacion", () => {
  it("dice a qué hora llega y lleva al cierre", () => {
    expect(avisoDeActivacion()).toMatchObject({ url: "/cierre", tag: "aviso-activado" });
    expect(avisoDeActivacion().cuerpo).toContain("como a las 7 p. m.");
  });
});

describe("clasificarRespuesta", () => {
  it("2xx es enviado", () => {
    for (const estado of [200, 201, 202]) expect(clasificarRespuesta(estado)).toEqual({ estado: "enviado" });
  });

  it("404 y 410: la dirección ya no existe, se desactiva", () => {
    expect(clasificarRespuesta(404)).toEqual({ estado: "caducada" });
    expect(clasificarRespuesta(410)).toEqual({ estado: "caducada" });
  });

  it("lo demás falla esta vez y se anota el código, sin desactivar (una clave mal puesta no debe apagar los avisos de todos)", () => {
    for (const estado of [400, 401, 403, 413, 429, 500, 503]) expect(clasificarRespuesta(estado)).toEqual({ estado: "fallo", codigo: `http-${estado}` });
  });
});

describe("estadoDelAviso", () => {
  const todo = { sistema: "android", instalada: false, soportado: true, registroDisponible: true, permiso: "default", suscrita: false } as const;

  it("Android con permiso por pedir: apagado, con el interruptor para activarlo", () => {
    expect(estadoDelAviso(todo)).toBe("apagado");
  });

  it("con el permiso dado y una suscripción en ese teléfono: activo", () => {
    expect(estadoDelAviso({ ...todo, permiso: "granted", suscrita: true })).toBe("activo");
  });

  it("un permiso sin suscripción no avisa nada: sigue apagado (y al tocarlo se suscribe)", () => {
    expect(estadoDelAviso({ ...todo, permiso: "granted", suscrita: false })).toBe("apagado");
    // y una suscripción de antes sin el permiso (la persona lo quitó en los ajustes) tampoco cuenta como activo
    expect(estadoDelAviso({ ...todo, permiso: "default", suscrita: true })).toBe("apagado");
  });

  it("si la persona dijo «No permitir», queda bloqueado: el navegador no vuelve a preguntar", () => {
    expect(estadoDelAviso({ ...todo, permiso: "denied" })).toBe("bloqueado");
  });

  it("iPhone con la app sin instalar: se dice que primero hay que instalarla (Safari no manda avisos a una pestaña)", () => {
    expect(estadoDelAviso({ ...todo, sistema: "ios", soportado: false, registroDisponible: false })).toBe("instalar-primero");
  });

  it("iPhone con la app instalada: como cualquier otro teléfono", () => {
    expect(estadoDelAviso({ ...todo, sistema: "ios", instalada: true })).toBe("apagado");
    expect(estadoDelAviso({ ...todo, sistema: "ios", instalada: true, permiso: "granted", suscrita: true })).toBe("activo");
  });

  it("sin soporte, o sin service worker (desarrollo): no se ofrece", () => {
    expect(estadoDelAviso({ ...todo, soportado: false })).toBe("no-disponible");
    expect(estadoDelAviso({ ...todo, registroDisponible: false })).toBe("no-disponible");
    expect(estadoDelAviso({ ...todo, sistema: "ios", instalada: true, soportado: false })).toBe("no-disponible"); // un iPhone viejo
  });
});

describe("claveParaElNavegador", () => {
  it("pasa la clave pública de base64url a los 65 bytes de un punto de la curva P-256", () => {
    const clave = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM";
    const bytes = claveParaElNavegador(clave);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4); // punto sin comprimir
    expect(Buffer.from(bytes).toString("base64url")).toBe(clave);
  });
});
