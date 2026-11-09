import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import webpush from "web-push";

import { descifrar, telefonoDePrueba as telefono } from "../../tests/ayudas/push-de-prueba";
import type { Aviso } from "../push-reglas";
import { enviarAviso, problemaConLaClaveVapid, type ConfiguracionVapid } from "./enviar";

// El aviso se cifra de verdad (claves reales de curva P-256, como las de un teléfono) y se descifra aquí con la clave del «teléfono»:
// así se prueba que lo que sale del servidor es lo que el teléfono podría leer, sin depender de ninguna red.

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
const vapid: ConfiguracionVapid = { asunto: "mailto:soporte@fructus.test", clavePublica: publicKey, clavePrivada: privateKey };

const aviso: Aviso = { titulo: "Vendiste S/ 1,250.00 hoy", cuerpo: "58 cajas en 9 ventas · Cobraste S/ 1,030.00", url: "/cierre", tag: "resumen-2026-11-08" };

type Pedido = { url: string; init: RequestInit };
let pedidos: Pedido[];

function simularRed(respuesta: () => Response | Promise<Response>) {
  pedidos = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      pedidos.push({ url, init });
      return respuesta();
    }),
  );
}

beforeEach(() => simularRed(() => new Response(null, { status: 201 })));
afterEach(() => vi.unstubAllGlobals());

describe("enviarAviso", () => {
  it("manda un pedido firmado y cifrado que el teléfono puede leer, a la dirección de ese teléfono", async () => {
    const t = telefono();
    const resultado = await enviarAviso(vapid, t.destino, aviso, { ttlSegundos: 21_600, tema: "resumen-2026-11-08" });

    expect(resultado).toEqual({ estado: "enviado" });
    expect(pedidos).toHaveLength(1);
    const { url, init } = pedidos[0]!;
    expect(url).toBe(t.destino.endpoint);
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const h = init.headers as Record<string, string>;
    expect(h["Content-Encoding"]).toBe("aes128gcm");
    expect(String(h["TTL"])).toBe("21600"); // fetch lo manda como texto
    expect(h["Topic"]).toBe("resumen-2026-11-08");
    expect(h["Urgency"]).toBe("normal");
    expect(h["Content-Length"], "fetch calcula el largo solo").toBeUndefined();

    // El teléfono descifra exactamente lo que el servidor armó.
    expect(JSON.parse(descifrar(init.body as Uint8Array, t))).toEqual(aviso);
  });

  it("el pedido lleva la firma VAPID: la dirección del servicio de avisos, el asunto, un vencimiento corto y la clave pública del servidor", async () => {
    await enviarAviso(vapid, telefono().destino, aviso, { ttlSegundos: 60 });
    const autorizacion = (pedidos[0]!.init.headers as Record<string, string>)["Authorization"]!;
    const [, t, k] = autorizacion.match(/^vapid t=([^,]+), k=(\S+)$/)!;
    expect(k).toBe(vapid.clavePublica);
    const carga = JSON.parse(Buffer.from(t!.split(".")[1]!, "base64url").toString()) as { aud: string; sub: string; exp: number };
    expect(carga.aud).toBe("https://fcm.googleapis.com");
    expect(carga.sub).toBe(vapid.asunto);
    const enSegundos = carga.exp - Date.now() / 1000;
    expect(enSegundos).toBeGreaterThan(0);
    expect(enSegundos).toBeLessThanOrEqual(24 * 3600); // el servicio de avisos no acepta firmas de más de 24 h
  });

  it("el aviso no viaja en claro: ni el título ni las cifras se leen en el cuerpo del pedido", async () => {
    await enviarAviso(vapid, telefono().destino, aviso, { ttlSegundos: 60 });
    const cuerpo = Buffer.from(pedidos[0]!.init.body as Uint8Array).toString("latin1");
    expect(cuerpo).not.toContain("Vendiste");
    expect(cuerpo).not.toContain("1,250");
  });

  it("con un simulador, el pedido va allá y lleva a qué teléfono iba (solo para pruebas)", async () => {
    const t = telefono();
    await enviarAviso(vapid, t.destino, aviso, { ttlSegundos: 60, simulador: "http://127.0.0.1:3300/push" });
    expect(pedidos[0]!.url).toBe("http://127.0.0.1:3300/push");
    expect((pedidos[0]!.init.headers as Record<string, string>)["X-Push-Endpoint"]).toBe(t.destino.endpoint);
  });

  it("404 y 410: la dirección ya no existe (caducada); 201, enviado", async () => {
    for (const [estado, esperado] of [
      [201, { estado: "enviado" }],
      [404, { estado: "caducada" }],
      [410, { estado: "caducada" }],
    ] as const) {
      simularRed(() => new Response(null, { status: estado }));
      expect(await enviarAviso(vapid, telefono().destino, aviso, { ttlSegundos: 60 })).toEqual(esperado);
    }
  });

  it("401, 429 o 503: falló esta vez, con su código, sin dar la dirección por muerta", async () => {
    for (const estado of [401, 429, 503]) {
      simularRed(() => new Response(null, { status: estado }));
      expect(await enviarAviso(vapid, telefono().destino, aviso, { ttlSegundos: 60 })).toEqual({ estado: "fallo", codigo: `http-${estado}` });
    }
  });

  it("si el servicio de avisos no responde a tiempo: «timeout»; si no hay red: «red». Nunca lanza", async () => {
    const tiempo = Object.assign(new Error("tiempo"), { name: "TimeoutError" });
    simularRed(() => Promise.reject(tiempo));
    expect(await enviarAviso(vapid, telefono().destino, aviso, { ttlSegundos: 60 })).toEqual({ estado: "fallo", codigo: "timeout" });
    simularRed(() => Promise.reject(new TypeError("fetch failed")));
    expect(await enviarAviso(vapid, telefono().destino, aviso, { ttlSegundos: 60 })).toEqual({ estado: "fallo", codigo: "red" });
  });

  it("unas claves de teléfono que no sirven no se desactivan ni tiran el envío: fallo «cifrado», y no se llamó a la red", async () => {
    const t = telefono();
    const resultado = await enviarAviso(vapid, { ...t.destino, clave_p256dh: "A".repeat(87) }, aviso, { ttlSegundos: 60 });
    expect(resultado).toMatchObject({ estado: "fallo" });
    expect((resultado as { codigo: string }).codigo).toMatch(/^cifrado:/);
    expect(pedidos).toHaveLength(0);
  });
});

describe("problemaConLaClaveVapid", () => {
  it("un par de claves de verdad y un asunto válido: sin problema", () => {
    expect(problemaConLaClaveVapid(vapid)).toBeNull();
    expect(problemaConLaClaveVapid({ ...vapid, asunto: "https://fructus.example" })).toBeNull();
  });

  it("claves cruzadas (la pública de un par con la privada de otro): lo dice, en vez de dejar que todos los avisos den 401", () => {
    const otra = webpush.generateVAPIDKeys();
    expect(problemaConLaClaveVapid({ ...vapid, clavePrivada: otra.privateKey })).toMatch(/no son pareja/);
  });

  it("claves cortadas, intercambiadas o con basura", () => {
    expect(problemaConLaClaveVapid({ ...vapid, clavePublica: vapid.clavePrivada, clavePrivada: vapid.clavePublica })).not.toBeNull();
    expect(problemaConLaClaveVapid({ ...vapid, clavePublica: vapid.clavePublica.slice(0, 40) })).not.toBeNull();
    expect(problemaConLaClaveVapid({ ...vapid, clavePrivada: "" })).not.toBeNull();
  });

  it("el asunto tiene que ser un correo o una dirección https (Apple rechaza los demás)", () => {
    for (const asunto of ["", "soporte@fructus.test", "http://127.0.0.1:3000", "mailto:"]) {
      expect(problemaConLaClaveVapid({ ...vapid, asunto }), asunto).toMatch(/VAPID_SUBJECT/);
    }
  });
});
