import { expect, test, type Page } from "@playwright/test";

import { baseLocal } from "./base";
import { entrarComo } from "./cuentas";

// Auditoría visual: que todo se lea y nada se corte, en cada pantalla y hoja, a 412 y 360 px.
//
// El problema: un cambio de diseño puede dejar un texto oscuro sobre el verde de la cabecera («Tus frutas» en Ajustes) o cortar el último cero
// de un monto, y las pruebas de cada pantalla no lo ven porque buscan textos, no cómo se ven. Esta prueba mira la PANTALLA, no el código:
// toma una captura, encuentra el color que de verdad hay detrás de cada texto y mide el contraste contra el color del texto (CLAUDE.md:
// 4.5:1, o 3:1 en texto grande). Y revisa que ningún texto se salga de la caja que lo recorta.

type Hallazgo = { que: string; texto: string; detalle: string };

/** Espera a que terminen las animaciones de entrada (las que se repiten, como el orbe, no terminan nunca). */
async function quieta(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity));
  await page.waitForTimeout(150);
}

/** Los textos visibles en la ventana, con su color, tamaño y si alguna caja los recorta. */
async function textosVisibles(page: Page) {
  return page.evaluate(() => {
    // Lo que deja pasar los toques (pointer-events: none, como la etiqueta «Toca o mantén para hablar») igual tapa a la vista: mientras se mide,
    // todo recibe toques para que elementFromPoint devuelva lo que de verdad está encima.
    const todoTocable = document.createElement("style");
    todoTocable.textContent = "* { pointer-events: auto !important; }";
    document.head.append(todoTocable);
    const salida: { texto: string; x: number; y: number; ancho: number; alto: number; color: string; grande: boolean; cortado: string | null }[] = [];
    const recorre = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = recorre.nextNode(); n; n = recorre.nextNode()) {
      const texto = n.textContent?.trim() ?? "";
      const el = n.parentElement;
      if (!texto || !el || el.closest("[aria-hidden='true'], .sr-only, script, style, noscript")) continue;
      const rango = document.createRange();
      rango.selectNodeContents(n);
      const estilo = getComputedStyle(el);
      if (estilo.visibility === "hidden") continue;
      // Si un antepasado transparente lo esconde (opacidad casi 0), no se ve: no se audita.
      let opacidad = 1;
      for (let a: Element | null = el; a; a = a.parentElement) opacidad *= Number(getComputedStyle(a).opacity);
      if (opacidad < 0.95) continue;
      const px = parseFloat(estilo.fontSize);
      const intencional = estilo.textOverflow === "ellipsis" || estilo.webkitLineClamp !== "none";
      // Cada línea del texto por separado: un nombre en dos líneas no tiene la misma forma que su caja.
      for (const r of rango.getClientRects()) {
        if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
        // Tapado por otra capa, aunque sea en parte (la barra de abajo, un botón flotante): lo que se ve ahí es esa capa, que se audita por su
        // lado. Se miran nueve puntos de la línea.
        const [x0, x1, y0, y1] = [Math.max(0, r.left), Math.min(innerWidth - 1, r.right), Math.max(0, r.top), Math.min(innerHeight - 1, r.bottom)];
        const tapado = [0.1, 0.5, 0.9].some((fx) =>
          [0.2, 0.5, 0.8].some((fy) => {
            const encima = document.elementFromPoint(x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy);
            return !encima || !(el.contains(encima) || encima.contains(el));
          }),
        );
        if (tapado) continue;
        // ¿Lo corta una caja que recorta (overflow distinto de visible) sin puntos suspensivos a propósito?
        let cortado: string | null = null;
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const ea = getComputedStyle(a);
          if (ea.overflowX === "visible" && ea.overflowY === "visible") continue;
          const ra = a.getBoundingClientRect();
          if (!intencional && (r.right > ra.right + 0.5 || r.left < ra.left - 0.5)) cortado = `${Math.round(r.right - ra.right)} px fuera de ${a.tagName.toLowerCase()}`;
          break;
        }
        salida.push({
          texto: texto.slice(0, 40),
          x: x0,
          y: y0,
          ancho: x1 - x0,
          alto: y1 - y0,
          color: estilo.color,
          grande: px >= 24 || (px >= 18.66 && Number(estilo.fontWeight) >= 700),
          cortado,
        });
      }
    }
    todoTocable.remove();
    return salida;
  });
}

/**
 * Para cada texto, el color que más se repite dentro de su caja en la captura es el fondo (las letras ocupan menos píxeles que el fondo).
 * Se mide en el navegador: la captura se pinta en un <canvas>.
 */
async function contrastes(page: Page, textos: Awaited<ReturnType<typeof textosVisibles>>) {
  const captura = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ captura, textos }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${captura}`;
      await img.decode();
      const escala = img.width / innerWidth;
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext("2d", { willReadFrequently: true })!;
      x.drawImage(img, 0, 0);
      const lum = ([r, g, b]: number[]) => {
        const l = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * l(r!) + 0.7152 * l(g!) + 0.0722 * l(b!);
      };
      const razon = (a: number[], b: number[]) => {
        const [m, n] = [lum(a), lum(b)].sort((p, q) => q - p);
        return (m! + 0.05) / (n! + 0.05);
      };
      return textos.map((t) => {
        const d = x.getImageData(Math.round(t.x * escala), Math.round(t.y * escala), Math.max(1, Math.round(t.ancho * escala)), Math.max(1, Math.round(t.alto * escala))).data;
        const cuenta = new Map<string, number>();
        for (let i = 0; i < d.length; i += 4) {
          const k = `${d[i]! >> 3},${d[i + 1]! >> 3},${d[i + 2]! >> 3}`;
          cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
        }
        // El color del texto puede venir en cualquier formato (oklab, color-mix, con transparencia): se pinta en un píxel y se lee.
        const uno = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
        const pintar = (debajo: string) => {
          uno.fillStyle = debajo;
          uno.fillRect(0, 0, 1, 1);
          uno.fillStyle = t.color;
          uno.fillRect(0, 0, 1, 1);
          return [...uno.getImageData(0, 0, 1, 1).data.slice(0, 3)];
        };
        // El fondo es el color que más se repite y que NO es el de las letras: en un título grande y grueso, las letras pueden ocupar más
        // píxeles que el fondo de su renglón.
        const letras = pintar("#808080");
        const lejos = (c: number[]) => Math.hypot(c[0]! - letras[0]!, c[1]! - letras[1]!, c[2]! - letras[2]!) > 60;
        const candidatos = [...cuenta.entries()].map(([k, n]) => [k.split(",").map((v) => Number(v) * 8 + 4), n] as const).sort((a, b) => b[1] - a[1]);
        const fondo = (candidatos.find(([c]) => lejos(c)) ?? candidatos[0]!)[0];
        const texto = pintar(`rgb(${fondo.join(",")})`);
        return { ...t, contraste: razon(texto, fondo), fondo: `rgb(${fondo.join(",")})` };
      });
    },
    { captura, textos },
  );
}

/** Recorre la pantalla de arriba abajo, ventana por ventana, y junta lo que no se lee o se corta. */
async function auditar(page: Page, donde: string, hallazgos: Hallazgo[]) {
  await quieta(page);
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  const ventana = page.viewportSize()!.height;
  const desborde = await page.evaluate(() => {
    const ancho = document.documentElement.clientWidth;
    const culpables = [...document.querySelectorAll("body *")]
      .filter((e) => e.getBoundingClientRect().right > ancho + 0.5 && !e.closest("nextjs-portal"))
      .slice(0, 3)
      .map((e) => `${e.tagName.toLowerCase()} «${(e.textContent ?? "").trim().slice(0, 30)}»`);
    return { px: document.documentElement.scrollWidth - ancho, culpables };
  });
  if (desborde.px > 0) hallazgos.push({ que: "scroll horizontal", texto: donde, detalle: `${desborde.px} px: ${desborde.culpables.join(", ")}` });
  for (let y = 0; y < alto; y += ventana - 140) {
    await page.evaluate((y) => scrollTo(0, y), y);
    await page.waitForTimeout(120);
    for (const t of await contrastes(page, await textosVisibles(page))) {
      const minimo = t.grande ? 3 : 4.5;
      if (t.contraste < minimo) hallazgos.push({ que: "no se lee", texto: `${donde} «${t.texto}»`, detalle: `${t.contraste.toFixed(2)}:1 (pide ${minimo}) sobre ${t.fondo}` });
      if (t.cortado) hallazgos.push({ que: "texto cortado", texto: `${donde} «${t.texto}»`, detalle: t.cortado });
    }
    if (y + ventana >= alto) break;
  }
  await page.evaluate(() => scrollTo(0, 0));
}

const sinRepetir = (h: Hallazgo[]) => [...new Map(h.map((x) => [`${x.que} ${x.texto}`, x])).values()];

test.use({ reducedMotion: "reduce" });

async function pantallasDelDuenio(page: Page) {
  test.setTimeout(180_000);
  const hallazgos: Hallazgo[] = [];
  await entrarComo(page, "duenio");
  const { data: cliente } = await baseLocal().from("v_saldo_clientes").select("cliente_id").gt("saldo", 0).limit(1).single();
  for (const ruta of ["/", "/clientes", `/clientes/${cliente?.cliente_id}`, "/stock", "/ventas", "/cierre", "/ajustes"]) {
    await page.goto(ruta);
    await auditar(page, ruta, hallazgos);
  }
  expect(sinRepetir(hallazgos)).toEqual([]);
}
test("todas las pantallas del dueño se leen y nada se corta", ({ page }) => pantallasDelDuenio(page));

async function hojasDelDuenio(page: Page) {
  test.setTimeout(180_000);
  const hallazgos: Hallazgo[] = [];
  await entrarComo(page, "duenio");
  const hoja = page.getByRole("dialog");
  const abrir = async (ruta: string, nombre: string | RegExp, donde: string) => {
    await page.goto(ruta);
    await page.getByRole("button", { name: nombre }).filter({ visible: true }).first().click();
    await expect(hoja).toBeVisible();
    await auditar(page, donde, hallazgos);
    await page.keyboard.press("Escape");
    await expect(hoja).toBeHidden();
  };
  await abrir("/", /Menú/, "menú «Más»");
  await abrir("/clientes", "Registrar abono", "hoja de abono");
  await abrir("/clientes", "Nuevo cliente", "hoja de cliente nuevo");
  await abrir("/stock", "Compra", "hoja de compra");
  await abrir("/stock", "Merma", "hoja de merma");
  await page.goto("/ventas");
  // Una venta: en celular es una fila de la lista; en escritorio, de la tabla (ADR-0015). Se toca la que se ve.
  await page.locator("li button, tbody tr button").filter({ visible: true }).first().click();
  await expect(hoja).toBeVisible();
  await auditar(page, "detalle de una venta", hallazgos);
  expect(sinRepetir(hallazgos)).toEqual([]);
}
test("las hojas del dueño se leen y nada se corta", ({ page }) => hojasDelDuenio(page));

test("el contador (solo lee) y la pantalla de entrar se leen y nada se corta", async ({ page, context }) => {
  test.setTimeout(120_000);
  const hallazgos: Hallazgo[] = [];
  await page.goto("/login");
  await auditar(page, "/login", hallazgos);
  await entrarComo(page, "contador");
  await auditar(page, "/ como contador", hallazgos);
  await context.clearCookies();
  expect(sinRepetir(hallazgos)).toEqual([]);
});

// El escritorio (ADR-0015): las mismas pantallas y hojas a 1280 × 800, con el panel lateral. Corre una sola vez.
test.describe("escritorio, 1280 px", () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "s25-412", "es el escritorio: corre una vez"));
  test("las pantallas del dueño se leen y nada se corta", ({ page }) => pantallasDelDuenio(page));
  test("las hojas del dueño se leen y nada se corta", ({ page }) => hojasDelDuenio(page));
});
