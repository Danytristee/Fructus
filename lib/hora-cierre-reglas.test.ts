import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  cronDeLaHora,
  desdeCuandoRige,
  esHoraDeCierre,
  esMinutoDeCierre,
  formatearHoraDeCierre,
  HORA_DE_CIERRE_DE_FABRICA,
  HORAS_DE_CIERRE,
  horaDeLima,
  horaDeReloj,
  MINUTOS_DE_CIERRE,
  periodoDe,
  textoDeLaHora,
} from "./hora-cierre-reglas";

describe("lo que se puede elegir", () => {
  it("horas de las 8 a. m. a las 11 p. m., y la de fábrica es la de siempre: las 7 p. m. en punto", () => {
    expect(HORAS_DE_CIERRE[0]).toBe(8);
    expect(HORAS_DE_CIERRE.at(-1)).toBe(23);
    expect(HORAS_DE_CIERRE).toHaveLength(16);
    expect(HORA_DE_CIERRE_DE_FABRICA).toEqual({ hora: 19, minuto: 0 });
  });

  it("minutos de 5 en 5, como exige la base", () => {
    expect(MINUTOS_DE_CIERRE).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    expect(esMinutoDeCierre(30)).toBe(true);
    for (const m of [37, 60, -5, 2.5]) expect(esMinutoDeCierre(m)).toBe(false);
  });

  it.each([7, 24, 0, -1, 19.5, Number.NaN])("no acepta la hora %s", (hora) => {
    expect(esHoraDeCierre(hora)).toBe(false);
  });

  it("vercel.json tiene un cron por cada hora que se puede elegir (el respaldo del reloj de la base; Hobby: cada uno una vez al día)", () => {
    const { crons } = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons?: { path: string; schedule: string }[] };
    const delAviso = (crons ?? []).filter((c) => c.path === "/api/cron/resumen-diario").map((c) => c.schedule);
    expect(delAviso.sort()).toEqual(HORAS_DE_CIERRE.map(cronDeLaHora).sort());
    for (const cron of delAviso) expect(cron).toMatch(/^0 \d{1,2} \* \* \*$/);
  });
});

describe("cronDeLaHora y horaDeLima", () => {
  it("Lima es UTC−5 todo el año (sin horario de verano)", () => {
    expect(cronDeLaHora(19)).toBe("0 0 * * *");
    expect(cronDeLaHora(8)).toBe("0 13 * * *");
    expect(cronDeLaHora(23)).toBe("0 4 * * *");
    expect(horaDeLima(new Date("2026-11-18T00:00:00Z"))).toBe(19);
    expect(horaDeLima(new Date("2026-11-18T04:30:00Z"))).toBe(23);
    expect(horaDeLima(new Date("2026-11-17T13:05:00Z"))).toBe(8);
  });
});

describe("cómo se dice la hora", () => {
  it.each([
    [{ hora: 19, minuto: 0 }, "7 p. m.", "a las 7 p. m."],
    [{ hora: 16, minuto: 30 }, "4:30 p. m.", "a las 4:30 p. m."],
    [{ hora: 8, minuto: 5 }, "8:05 a. m.", "a las 8:05 a. m."],
    [{ hora: 12, minuto: 0 }, "12 m.", "a las 12 m."],
    [{ hora: 12, minuto: 45 }, "12:45 p. m.", "a las 12:45 p. m."],
    [{ hora: 13, minuto: 0 }, "1 p. m.", "a la 1 p. m."],
    [{ hora: 13, minuto: 15 }, "1:15 p. m.", "a la 1:15 p. m."],
    [{ hora: 23, minuto: 55 }, "11:55 p. m.", "a las 11:55 p. m."],
  ])("%o → «%s», «%s»", (h, corto, frase) => {
    const plano = (t: string) => t.replace(/\u00a0/g, " ");
    expect(plano(formatearHoraDeCierre(h))).toBe(corto);
    expect(plano(textoDeLaHora(h))).toBe(frase);
  });

  it("la hora no se parte en dos renglones: espacios duros dentro de «4:30 p. m.», normales alrededor", () => {
    expect(formatearHoraDeCierre({ hora: 16, minuto: 30 })).toBe("4:30\u00a0p.\u00a0m.");
    expect(textoDeLaHora({ hora: 16, minuto: 30 })).toBe("a las 4:30\u00a0p.\u00a0m.");
  });

  it("la rueda muestra la hora de 1 a 12 y el periodo aparte (el mediodía en punto es «m.»)", () => {
    expect(HORAS_DE_CIERRE.map(horaDeReloj)).toEqual([8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(periodoDe({ hora: 11, minuto: 30 })).toBe("a. m.");
    expect(periodoDe({ hora: 12, minuto: 0 })).toBe("m.");
    expect(periodoDe({ hora: 12, minuto: 5 })).toBe("p. m.");
    expect(periodoDe({ hora: 16, minuto: 0 })).toBe("p. m.");
  });
});

describe("desdeCuandoRige", () => {
  it("si la hora nueva todavía no llega hoy, el aviso sale hoy", () => {
    expect(desdeCuandoRige({ hora: 16, minuto: 30 }, new Date("2026-11-17T21:10:00Z"))).toBe("hoy"); // 4:10 p. m. en Lima
  });

  it("si ya pasó, o es este mismo minuto (el reloj pudo haber llamado), sale desde mañana", () => {
    expect(desdeCuandoRige({ hora: 16, minuto: 0 }, new Date("2026-11-17T21:10:00Z"))).toBe("mañana");
    expect(desdeCuandoRige({ hora: 16, minuto: 10 }, new Date("2026-11-17T21:10:30Z"))).toBe("mañana");
  });
});
