import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { COLOR_DEL_TEMA, maneraDeInstalar, pasosParaInstalar, sistemaDe } from "./pwa-reglas";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const IPAD_NUEVO = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const MAC = IPAD_NUEVO;
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

describe("sistemaDe (de qué teléfono se abre)", () => {
  it("reconoce el iPhone, el Android y lo demás", () => {
    expect(sistemaDe(IPHONE, 5)).toBe("ios");
    expect(sistemaDe(ANDROID, 5)).toBe("android");
    expect(sistemaDe(WINDOWS, 0)).toBe("otro");
  });

  it("un iPad nuevo se presenta como Mac: se distingue por la pantalla táctil, y una Mac de verdad no es iOS", () => {
    expect(sistemaDe(IPAD_NUEVO, 5)).toBe("ios");
    expect(sistemaDe(MAC, 0)).toBe("otro");
  });
});

describe("maneraDeInstalar (qué se le ofrece a quien abre el menú)", () => {
  it("ya instalada: no se ofrece nada", () => {
    expect(maneraDeInstalar({ instalada: true, puedePedir: true, sistema: "android" })).toBe("instalada");
  });

  it("si el navegador deja pedir la instalación, se pide con un toque", () => {
    expect(maneraDeInstalar({ instalada: false, puedePedir: true, sistema: "android" })).toBe("pedir");
    expect(maneraDeInstalar({ instalada: false, puedePedir: true, sistema: "otro" })).toBe("pedir");
  });

  it("en iPhone no se puede pedir: se dicen los pasos de Compartir", () => {
    expect(maneraDeInstalar({ instalada: false, puedePedir: false, sistema: "ios" })).toBe("pasos-ios");
  });

  it("en cualquier otro navegador que no ofrece el diálogo, se dicen los pasos del menú del navegador", () => {
    expect(maneraDeInstalar({ instalada: false, puedePedir: false, sistema: "android" })).toBe("pasos-menu");
    expect(maneraDeInstalar({ instalada: false, puedePedir: false, sistema: "otro" })).toBe("pasos-menu");
  });
});

describe("pasosParaInstalar (en lenguaje de puesto)", () => {
  it("son tres pasos cortos, y los de iPhone nombran Compartir y «Añadir a pantalla de inicio»", () => {
    const ios = pasosParaInstalar("pasos-ios");
    expect(ios).toHaveLength(3);
    expect(ios.join(" ")).toContain("Compartir");
    expect(ios.join(" ")).toContain("Añadir a pantalla de inicio");
  });

  it("los del menú del navegador nombran «Instalar app»", () => {
    const menu = pasosParaInstalar("pasos-menu");
    expect(menu).toHaveLength(3);
    expect(menu.join(" ")).toContain("Instalar app");
  });
});

describe("COLOR_DEL_TEMA (la barra del teléfono y el arranque de la app)", () => {
  it("es el --acento de globals.css: si cambia la identidad, cambian los dos", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toMatch(new RegExp(`--acento:\\s*${COLOR_DEL_TEMA};`, "i"));
  });
});
