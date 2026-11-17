import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  cronDeLaHora,
  desdeCuandoRige,
  esHoraDeCierre,
  HORA_DE_CIERRE_DE_FABRICA,
  HORAS_DE_CIERRE,
  horaDeLima,
  textoDeLaHora,
  tocaAvisar,
} from "./hora-cierre-reglas";

describe("las horas que se pueden elegir", () => {
  it("van de las 8 a. m. a las 11 p. m., de hora en hora, y la de fábrica es la de siempre: las 7 p. m.", () => {
    expect(HORAS_DE_CIERRE[0]).toBe(8);
    expect(HORAS_DE_CIERRE.at(-1)).toBe(23);
    expect(HORAS_DE_CIERRE).toHaveLength(16);
    expect(HORA_DE_CIERRE_DE_FABRICA).toBe(19);
    expect(esHoraDeCierre(HORA_DE_CIERRE_DE_FABRICA)).toBe(true);
  });

  it.each([7, 24, 0, -1, 19.5, Number.NaN])("no acepta %s", (hora) => {
    expect(esHoraDeCierre(hora)).toBe(false);
  });

  it("vercel.json tiene un cron por cada hora que se puede elegir, ni uno más ni uno menos (Hobby: cada uno una vez al día)", () => {
    const { crons } = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons?: { path: string; schedule: string }[] };
    const delAviso = (crons ?? []).filter((c) => c.path === "/api/cron/resumen-diario").map((c) => c.schedule);
    expect(delAviso.sort()).toEqual(HORAS_DE_CIERRE.map(cronDeLaHora).sort());
    for (const cron of delAviso) expect(cron).toMatch(/^0 \d{1,2} \* \* \*$/); // una vez al día: el plan Hobby no deja más
  });
});

describe("cronDeLaHora", () => {
  it("dice la hora de Lima en UTC: Lima es UTC−5 todo el año (sin horario de verano)", () => {
    expect(cronDeLaHora(19)).toBe("0 0 * * *");
    expect(cronDeLaHora(8)).toBe("0 13 * * *");
    expect(cronDeLaHora(23)).toBe("0 4 * * *");
  });
});

describe("horaDeLima", () => {
  it("a medianoche UTC en Lima son las 7 p. m. del día anterior", () => {
    expect(horaDeLima(new Date("2026-11-18T00:00:00Z"))).toBe(19);
    expect(horaDeLima(new Date("2026-11-18T00:59:59Z"))).toBe(19);
    expect(horaDeLima(new Date("2026-11-18T04:30:00Z"))).toBe(23);
    expect(horaDeLima(new Date("2026-11-17T13:05:00Z"))).toBe(8);
  });
});

describe("tocaAvisar", () => {
  // En Hobby el cron de «0 0 * * *» llega en cualquier minuto entre las 0:00 y las 0:59 UTC: dentro de esa hora siempre toca.
  it("toca cuando la hora de Lima es la elegida, en cualquier minuto de esa hora", () => {
    expect(tocaAvisar(19, new Date("2026-11-18T00:00:00Z"))).toBe(true);
    expect(tocaAvisar(19, new Date("2026-11-18T00:59:59Z"))).toBe(true);
    expect(tocaAvisar(15, new Date("2026-11-17T20:42:00Z"))).toBe(true);
  });

  it("no toca en las otras horas: los demás crons del día pasan sin hacer nada", () => {
    expect(tocaAvisar(19, new Date("2026-11-17T23:59:59Z"))).toBe(false);
    expect(tocaAvisar(19, new Date("2026-11-18T01:00:00Z"))).toBe(false);
    expect(tocaAvisar(15, new Date("2026-11-18T00:10:00Z"))).toBe(false);
  });
});

describe("textoDeLaHora", () => {
  it("dice «como a las»: en Hobby el cron corre dentro de la hora, no a la hora exacta", () => {
    expect(textoDeLaHora(19)).toBe("como a las 7 p. m.");
    expect(textoDeLaHora(12)).toBe("como a las 12 m.");
    expect(textoDeLaHora(8)).toBe("como a las 8 a. m.");
  });

  it("a la 1 es singular: «como a la 1 p. m.», no «a las 1»", () => {
    expect(textoDeLaHora(13)).toBe("como a la 1 p. m.");
  });
});

describe("desdeCuandoRige", () => {
  it("si la hora nueva todavía no llega hoy, el aviso sale hoy", () => {
    expect(desdeCuandoRige(19, new Date("2026-11-17T20:00:00Z"))).toBe("hoy"); // 3 p. m. en Lima
  });

  it("si ya pasó (o es esta misma hora y el cron pudo haber corrido), sale desde mañana", () => {
    expect(desdeCuandoRige(15, new Date("2026-11-17T22:00:00Z"))).toBe("mañana"); // 5 p. m. en Lima
    expect(desdeCuandoRige(17, new Date("2026-11-17T22:10:00Z"))).toBe("mañana"); // 5:10 p. m.: el cron de las 5 pudo correr ya
  });
});
