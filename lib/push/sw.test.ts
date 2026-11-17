import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { describe, expect, it, vi } from "vitest";

import { avisoDeActivacion, avisoDelDia } from "../push-reglas";

// public/sw.js es JavaScript de navegador y no se puede importar: se corre en un contexto aparte, con un navegador de mentira, y se
// mira qué muestra y a dónde lleva. Lo que se prueba es lo que el teléfono hace al recibir el aviso y al tocarlo.

const ORIGEN = "https://fructus.test";

type Ventana = { url: string; focus: () => Promise<void>; navigate?: (url: string) => Promise<void> };
type Mostrada = { titulo: string; opciones: { body: string; icon: string; lang: string; tag: string; data: { url: string } } };

function cargarServiceWorker(ventanas: Ventana[] = []) {
  const oyentes = new Map<string, (evento: unknown) => void>();
  const mostradas: Mostrada[] = [];
  const abiertas: string[] = [];
  const self = {
    location: { origin: ORIGEN },
    addEventListener: (tipo: string, oyente: (evento: unknown) => void) => oyentes.set(tipo, oyente),
    registration: {
      showNotification: async (titulo: string, opciones: Mostrada["opciones"]) => void mostradas.push({ titulo, opciones }),
    },
    clients: {
      matchAll: async () => ventanas,
      openWindow: async (url: string) => void abiertas.push(url),
    },
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), { self, URL, console: { ...console, warn: vi.fn() }, caches: {}, fetch: vi.fn(), Response, setTimeout, Promise });

  /** Entrega un aviso (push) con ese contenido y espera a que se muestre. `contenido`: texto del cuerpo, o null si no llega nada. */
  const recibir = async (contenido: string | null) => {
    const esperas: Promise<unknown>[] = [];
    oyentes.get("push")!({ data: contenido === null ? null : { json: () => JSON.parse(contenido) }, waitUntil: (p: Promise<unknown>) => esperas.push(p) });
    await Promise.all(esperas);
  };

  /** El toque en un aviso que lleva esos datos. */
  const tocar = async (datos: unknown) => {
    const esperas: Promise<unknown>[] = [];
    const notificacion = { data: datos, close: vi.fn() };
    oyentes.get("notificationclick")!({ notification: notificacion, waitUntil: (p: Promise<unknown>) => esperas.push(p) });
    await Promise.all(esperas);
    return notificacion;
  };

  return { mostradas, abiertas, recibir, tocar, oyentes };
}

describe("public/sw.js · recibir el aviso", () => {
  it("muestra el aviso con su título, su texto, el ícono de la app y la etiqueta (un aviso nuevo reemplaza al anterior)", async () => {
    const sw = cargarServiceWorker();
    const aviso = avisoDelDia({ vendido: 1250, contado: 800, credito: 450, cobrado: 1030, abonos: 230, porCobrar: 3420, numeroVentas: 9, cajas: 58, compras: 0, gastos: 0 }, "2026-11-09")!;
    await sw.recibir(JSON.stringify(aviso));

    expect(sw.mostradas).toHaveLength(1);
    expect(sw.mostradas[0]).toEqual({
      titulo: aviso.titulo,
      opciones: { body: aviso.cuerpo, icon: "/icons/icon-192.png", lang: "es-PE", tag: "resumen-2026-11-09", data: { url: "/cierre" } },
    });
  });

  it("lee las mismas llaves que arma el servidor: el aviso de activación también se muestra completo", async () => {
    const sw = cargarServiceWorker();
    const aviso = avisoDeActivacion({ hora: 19, minuto: 0 });
    await sw.recibir(JSON.stringify(aviso));
    expect(sw.mostradas[0]).toMatchObject({ titulo: aviso.titulo, opciones: { body: aviso.cuerpo, tag: aviso.tag, data: { url: aviso.url } } });
  });

  it("si el aviso llega sin contenido o con basura, muestra el aviso genérico: Chrome exige mostrar algo, y es mejor el nuestro que el suyo", async () => {
    for (const contenido of [null, "esto no es JSON", "{}", JSON.stringify({ titulo: 5, cuerpo: [] }), JSON.stringify({ titulo: "solo título" })]) {
      const sw = cargarServiceWorker();
      await sw.recibir(contenido);
      expect(sw.mostradas, String(contenido)).toHaveLength(1);
      expect(sw.mostradas[0]).toMatchObject({ titulo: "Tu día en Fructus", opciones: { data: { url: "/cierre" } } });
    }
  });

  it("el toque solo puede llevar a una pantalla de la app: una dirección de afuera se cambia por el cierre", async () => {
    for (const url of ["https://malo.example/cierre", "//malo.example", "/\\malo.example", "javascript:alert(1)", "cierre", 7, null]) {
      const sw = cargarServiceWorker();
      await sw.recibir(JSON.stringify({ titulo: "t", cuerpo: "c", url, tag: "x" }));
      expect(sw.mostradas[0]!.opciones.data.url, String(url)).toBe("/cierre");
    }
    const sw = cargarServiceWorker();
    await sw.recibir(JSON.stringify({ titulo: "t", cuerpo: "c", url: "/clientes", tag: "x" }));
    expect(sw.mostradas[0]!.opciones.data.url).toBe("/clientes");
  });

  it("un título o un texto larguísimos se recortan (no llenan la pantalla del teléfono)", async () => {
    const sw = cargarServiceWorker();
    await sw.recibir(JSON.stringify({ titulo: "t".repeat(500), cuerpo: "c".repeat(900), url: "/cierre", tag: "x".repeat(300) }));
    expect(sw.mostradas[0]!.titulo).toHaveLength(120);
    expect(sw.mostradas[0]!.opciones.body).toHaveLength(240);
    expect(sw.mostradas[0]!.opciones.tag).toHaveLength(64);
  });
});

describe("public/sw.js · tocar el aviso", () => {
  const ventana = (url: string, extra: Partial<Ventana> = {}): Ventana & { focus: ReturnType<typeof vi.fn>; navigate: ReturnType<typeof vi.fn> } => ({
    url,
    focus: vi.fn(async () => {}),
    navigate: vi.fn(async () => {}),
    ...extra,
  }) as never;

  it("cierra el aviso y, si la app ya está abierta, lleva esa ventana al destino en vez de abrir otra", async () => {
    const abierta = ventana(`${ORIGEN}/`);
    const sw = cargarServiceWorker([abierta]);
    const notificacion = await sw.tocar({ url: "/cierre" });

    expect(notificacion.close).toHaveBeenCalled();
    expect(abierta.focus).toHaveBeenCalled();
    expect(abierta.navigate).toHaveBeenCalledWith(`${ORIGEN}/cierre`);
    expect(sw.abiertas).toEqual([]);
  });

  it("si la app no está abierta, la abre en el destino", async () => {
    const sw = cargarServiceWorker([]);
    await sw.tocar({ url: "/cierre" });
    expect(sw.abiertas).toEqual([`${ORIGEN}/cierre`]);
  });

  it("una ventana de otro sitio no cuenta como la app: se abre una nueva", async () => {
    const sw = cargarServiceWorker([ventana("https://otro.example/")]);
    await sw.tocar({ url: "/cierre" });
    expect(sw.abiertas).toEqual([`${ORIGEN}/cierre`]);
  });

  it("si la ventana abierta no se deja llevar (no la controla este service worker), abre una nueva en vez de no hacer nada", async () => {
    const sw = cargarServiceWorker([ventana(`${ORIGEN}/stock`, { navigate: vi.fn(async () => Promise.reject(new TypeError("no se puede"))) })]);
    await sw.tocar({ url: "/cierre" });
    expect(sw.abiertas).toEqual([`${ORIGEN}/cierre`]);
  });

  it("un aviso sin destino, o con uno de afuera, lleva al cierre", async () => {
    for (const datos of [undefined, null, {}, { url: "https://malo.example" }, { url: "//malo.example" }]) {
      const sw = cargarServiceWorker([]);
      await sw.tocar(datos);
      expect(sw.abiertas, JSON.stringify(datos)).toEqual([`${ORIGEN}/cierre`]);
    }
  });
});

describe("public/sw.js · lo que ya hacía", () => {
  it("sigue escuchando abrir pantallas (la página sin conexión) además de los avisos", () => {
    const { oyentes } = cargarServiceWorker();
    expect([...oyentes.keys()].sort()).toEqual(["activate", "fetch", "install", "notificationclick", "push"]);
  });
});
