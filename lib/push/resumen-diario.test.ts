import { describe, expect, it, vi } from "vitest";

import type { ResumenHoy } from "../hoy-reglas";
import type { Aviso, ResultadoEnvio } from "../push-reglas";
import { ENVIOS_A_LA_VEZ, enviarElResumenDelDia, estadoHttpDelInforme, TTL_DEL_AVISO_SEGUNDOS, type Dependencias, type Destinatario, type Informe } from "./resumen-diario";

const conVentas: ResumenHoy = { vendido: 1250, contado: 800, credito: 450, cobrado: 1030, abonos: 230, porCobrar: 3420, numeroVentas: 9, cajas: 58, compras: 0, gastos: 0 };
const sinNada: ResumenHoy = { ...conVentas, vendido: 0, contado: 0, credito: 0, cobrado: 0, abonos: 0, numeroVentas: 0, cajas: 0 };

// Lunes 9 de noviembre, 7:30 p. m. en Lima = martes 10, 00:30 en UTC: el día que se resume es el de Lima.
const ahora = new Date("2026-11-10T00:30:00Z");

const telefono = (id: number): Destinatario => ({ id, endpoint: `https://fcm.googleapis.com/fcm/send/telefono-${id}`, clave_p256dh: "p", clave_auth: "a" });

function mundo(cambios: Partial<Dependencias> & { telefonos?: Destinatario[] } = {}) {
  const { telefonos = [telefono(1)], ...resto } = cambios;
  const enviados: { id: number; aviso: Aviso; opciones: { ttlSegundos: number; tema: string } }[] = [];
  const anotados: { id: number; resultado: ResultadoEnvio }[] = [];
  const deps: Dependencias = {
    leerResumen: vi.fn(async () => conVentas),
    leerDestinatarios: vi.fn(async () => telefonos),
    enviar: vi.fn(async (d, aviso, opciones) => {
      enviados.push({ id: d.id, aviso, opciones });
      return { estado: "enviado" } as ResultadoEnvio;
    }),
    anotar: vi.fn(async (id, resultado) => {
      anotados.push({ id, resultado });
    }),
    ...resto,
  };
  return { deps, enviados, anotados };
}

describe("enviarElResumenDelDia", () => {
  it("resume el día de Lima (no el de UTC) y manda el mismo aviso, con su tema y su vencimiento, a cada teléfono", async () => {
    const { deps, enviados } = mundo({ telefonos: [telefono(1), telefono(2)] });
    const informe = await enviarElResumenDelDia(deps, ahora);

    expect(deps.leerResumen).toHaveBeenCalledWith("2026-11-09");
    expect(informe).toEqual({ fecha: "2026-11-09", motivo: "enviado", destinatarios: 2, enviados: 2, caducadas: 0, fallos: 0 });
    expect(enviados.map((e) => e.id).sort()).toEqual([1, 2]);
    for (const e of enviados) {
      expect(e.aviso).toMatchObject({ url: "/cierre", tag: "resumen-2026-11-09" });
      expect(e.opciones).toEqual({ ttlSegundos: TTL_DEL_AVISO_SEGUNDOS, tema: "resumen-2026-11-09" });
    }
  });

  it("un día sin ventas ni abonos no avisa a nadie, y ni siquiera lee a quién", async () => {
    const { deps, enviados } = mundo({ leerResumen: async () => sinNada });
    const informe = await enviarElResumenDelDia(deps, ahora);
    expect(informe).toMatchObject({ motivo: "sin-movimiento", destinatarios: 0, enviados: 0 });
    expect(deps.leerDestinatarios).not.toHaveBeenCalled();
    expect(enviados).toHaveLength(0);
  });

  it("sin teléfonos que lo pidieron, no hay nada que mandar", async () => {
    const { deps } = mundo({ telefonos: [] });
    expect(await enviarElResumenDelDia(deps, ahora)).toMatchObject({ motivo: "sin-destinatarios", destinatarios: 0 });
    expect(deps.enviar).not.toHaveBeenCalled();
  });

  it("anota cómo salió cada uno: enviado, caducado (se desactiva) o fallo (se anota el código)", async () => {
    const resultados: Record<number, ResultadoEnvio> = {
      1: { estado: "enviado" },
      2: { estado: "caducada" },
      3: { estado: "fallo", codigo: "http-503" },
    };
    const { deps, anotados } = mundo({ telefonos: [telefono(1), telefono(2), telefono(3)], enviar: async (d) => resultados[d.id]! });
    const informe = await enviarElResumenDelDia(deps, ahora);

    expect(informe).toMatchObject({ destinatarios: 3, enviados: 1, caducadas: 1, fallos: 1 });
    expect(anotados.sort((a, b) => a.id - b.id)).toEqual([
      { id: 1, resultado: { estado: "enviado" } },
      { id: 2, resultado: { estado: "caducada" } },
      { id: 3, resultado: { estado: "fallo", codigo: "http-503" } },
    ]);
  });

  it("un envío que lanza se cuenta como fallo y no frena a los demás", async () => {
    const { deps, anotados } = mundo({
      telefonos: [telefono(1), telefono(2)],
      enviar: async (d) => {
        if (d.id === 1) throw new TypeError("se cayó");
        return { estado: "enviado" };
      },
    });
    const informe = await enviarElResumenDelDia(deps, ahora);
    expect(informe).toMatchObject({ enviados: 1, fallos: 1 });
    expect(anotados.find((a) => a.id === 1)?.resultado).toEqual({ estado: "fallo", codigo: "inesperado:TypeError" });
  });

  it("si no se puede anotar el resultado, el envío igual cuenta y los demás siguen (y el registro lleva el id, nunca la dirección)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps } = mundo({ telefonos: [telefono(1), telefono(2)], anotar: async () => Promise.reject(new Error("base caída")) });
    const informe = await enviarElResumenDelDia(deps, ahora);
    expect(informe).toMatchObject({ enviados: 2 });
    const registrado = JSON.stringify(error.mock.calls);
    expect(registrado).toContain("suscripcionId");
    expect(registrado).not.toContain("fcm.googleapis.com");
    error.mockRestore();
  });

  it("si no se puede leer el día, lanza: nada de avisar con cifras inventadas", async () => {
    const { deps } = mundo({ leerResumen: async () => Promise.reject(new Error("base caída")) });
    await expect(enviarElResumenDelDia(deps, ahora)).rejects.toThrow("base caída");
    expect(deps.enviar).not.toHaveBeenCalled();
  });

  it("manda de a pocos a la vez, no todos juntos", async () => {
    let enCurso = 0;
    let maximo = 0;
    const telefonos = Array.from({ length: 12 }, (_, i) => telefono(i + 1));
    const { deps } = mundo({
      telefonos,
      enviar: async () => {
        enCurso++;
        maximo = Math.max(maximo, enCurso);
        await new Promise((r) => setTimeout(r, 5));
        enCurso--;
        return { estado: "enviado" };
      },
    });
    const informe = await enviarElResumenDelDia(deps, ahora);
    expect(informe.enviados).toBe(12);
    expect(maximo).toBeLessThanOrEqual(ENVIOS_A_LA_VEZ);
    expect(maximo).toBeGreaterThan(1);
  });
});

describe("el aviso de frescura, junto al resumen", () => {
  const porSalir = { frutas: [{ nombre: "Mango Kent", cajas: 12 }], gradosHoy: 30 };

  it("con fruta por salir mañana, cada teléfono recibe los dos avisos: el resumen y después el de frescura", async () => {
    const { deps, enviados } = mundo({ telefonos: [telefono(1), telefono(2)], leerPorSalir: vi.fn(async () => porSalir) });
    const informe = await enviarElResumenDelDia(deps, ahora);
    expect(enviados.filter((e) => e.id === 1).map((e) => e.aviso.tag)).toEqual(["resumen-2026-11-09", "frescura-2026-11-09"]);
    expect(enviados).toHaveLength(4);
    // Un teléfono cuenta una vez, aunque reciba dos avisos.
    expect(informe).toMatchObject({ motivo: "enviado", destinatarios: 2, enviados: 2, fallos: 0 });
    // Cada aviso viaja con su propio tema: el de frescura no reemplaza al resumen en el teléfono.
    expect(enviados.find((e) => e.aviso.tag.startsWith("frescura"))!.opciones).toEqual({ ttlSegundos: TTL_DEL_AVISO_SEGUNDOS, tema: "frescura-2026-11-09" });
  });

  it("un día sin ventas igual avisa lo que tiene que salir: la fruta se malogra lo mismo", async () => {
    const { deps, enviados } = mundo({ leerResumen: vi.fn(async () => sinNada), leerPorSalir: vi.fn(async () => porSalir) });
    const informe = await enviarElResumenDelDia(deps, ahora);
    expect(enviados.map((e) => e.aviso.titulo)).toEqual(["Mañana tienen que salir 12 cajas"]);
    expect(informe.motivo).toBe("enviado");
  });

  it("sin fruta por salir, sale solo el resumen de siempre", async () => {
    const { deps, enviados } = mundo({ leerPorSalir: vi.fn(async () => ({ frutas: [], gradosHoy: null })) });
    await enviarElResumenDelDia(deps, ahora);
    expect(enviados.map((e) => e.aviso.tag)).toEqual(["resumen-2026-11-09"]);
  });

  it("si no se puede leer lo que tiene que salir, el resumen sale igual", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps, enviados } = mundo({ leerPorSalir: vi.fn(async () => { throw new Error("la base no respondió"); }) });
    const informe = await enviarElResumenDelDia(deps, ahora);
    expect(enviados.map((e) => e.aviso.tag)).toEqual(["resumen-2026-11-09"]);
    expect(informe).toMatchObject({ motivo: "enviado", enviados: 1 });
    consola.mockRestore();
  });

  it("si la dirección de un teléfono caducó en el primer aviso, no se le manda el segundo", async () => {
    const { deps, enviados } = mundo({ leerPorSalir: vi.fn(async () => porSalir), enviar: vi.fn(async () => ({ estado: "caducada" }) as ResultadoEnvio) });
    const informe = await enviarElResumenDelDia(deps, ahora);
    expect(deps.enviar).toHaveBeenCalledTimes(1);
    expect(informe).toMatchObject({ caducadas: 1, enviados: 0 });
    expect(enviados).toEqual([]);
  });
});

describe("estadoHttpDelInforme", () => {
  const informe = (cambios: Partial<Informe>): Informe => ({ fecha: "2026-11-09", motivo: "enviado", destinatarios: 3, enviados: 0, caducadas: 0, fallos: 0, ...cambios });

  it("200 si salió al menos uno, aunque otros fallaran", () => {
    expect(estadoHttpDelInforme(informe({ enviados: 1, fallos: 2 }))).toBe(200);
  });

  it("502 si había a quién avisar y todos fallaron: el cron tiene que verse en rojo", () => {
    expect(estadoHttpDelInforme(informe({ fallos: 3 }))).toBe(502);
    expect(estadoHttpDelInforme(informe({ caducadas: 1, fallos: 2 }))).toBe(502);
  });

  it("200 si lo único que pasó es que las direcciones caducaron (gente que desinstaló la app), si no había nada que avisar o a quién", () => {
    expect(estadoHttpDelInforme(informe({ caducadas: 3 }))).toBe(200);
    expect(estadoHttpDelInforme(informe({ motivo: "sin-movimiento", destinatarios: 0 }))).toBe(200);
    expect(estadoHttpDelInforme(informe({ motivo: "sin-destinatarios", destinatarios: 0 }))).toBe(200);
  });
});
