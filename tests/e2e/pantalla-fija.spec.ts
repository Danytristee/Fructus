import { expect, test } from "@playwright/test";

// La pantalla queda fija: nada de ampliar con el pellizco ni con el doble toque. Android respeta el viewport; iPhone lo ignora y por eso
// también hay `touch-action` y el freno a los gestos de Safari. Se prueba con un pellizco de verdad (el protocolo del navegador lo sintetiza)
// y, como control, con una página que NO lo prohíbe: si esa tampoco se ampliara, la prueba no probaría nada.

const escala = (page: import("@playwright/test").Page) => page.evaluate(() => window.visualViewport?.scale ?? 1);

async function pellizcar(page: import("@playwright/test").Page, factor: number) {
  const cdp = await page.context().newCDPSession(page);
  const { width, height } = page.viewportSize()!;
  await cdp.send("Input.synthesizePinchGesture", { x: width / 2, y: height / 2, scaleFactor: factor, relativeSpeed: 600, gestureSourceType: "touch" });
  await page.waitForTimeout(400);
}

test("el viewport prohíbe ampliar y el HTML lo repite con touch-action", async ({ page }) => {
  await page.goto("/login");
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).toContain("width=device-width");
  expect(viewport).toContain("initial-scale=1");
  expect(viewport).toContain("minimum-scale=1");
  expect(viewport).toContain("maximum-scale=1");
  expect(viewport).toContain("user-scalable=no");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe("pan-x pan-y");
});

test("un pellizco no amplía la pantalla (y en una página sin el freno, el mismo pellizco sí)", async ({ page }) => {
  // Control: sin el freno, el pellizco amplía. Si esto no pasara, la comprobación de abajo no probaría nada.
  await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0"><div style="height:3000px;background:linear-gradient(red,blue)"></div></body>');
  expect(await escala(page)).toBe(1);
  await pellizcar(page, 2.5);
  expect(await escala(page), "el control sí se amplía").toBeGreaterThan(1.2);

  await page.goto("/login");
  expect(await escala(page)).toBe(1);
  await pellizcar(page, 2.5);
  expect(await escala(page), "la app no se amplía con el pellizco").toBe(1);
  await pellizcar(page, 0.4);
  expect(await escala(page), "ni se achica").toBe(1);
});

test("Safari: los gestos de pellizco se cancelan (iPhone ignora el viewport)", async ({ page }) => {
  await page.goto("/login");
  // El freno se pone cuando la página termina de montarse: se espera a que esté.
  await expect
    .poll(() =>
      page.evaluate(() =>
        ["gesturestart", "gesturechange", "gestureend"].map((tipo) => {
          const e = new Event(tipo, { cancelable: true, bubbles: true });
          document.body.dispatchEvent(e);
          return e.defaultPrevented;
        }),
      ),
    )
    .toEqual([true, true, true]);
});

test("lo que se toca no se selecciona ni abre el menú de «copiar enlace»; los campos sí se pueden seleccionar", async ({ page }) => {
  await page.goto("/login");
  const boton = page.getByRole("button", { name: "Entrar" });
  expect(await boton.evaluate((e) => getComputedStyle(e).userSelect)).toBe("none");
  expect(await boton.evaluate((e) => getComputedStyle(e).getPropertyValue("-webkit-touch-callout") || "none")).toBe("none");
  expect(await page.getByLabel("Correo").evaluate((e) => getComputedStyle(e).userSelect)).not.toBe("none");
});

test("los campos escriben a 16 px o más: iPhone no se acerca solo al tocarlos", async ({ page }) => {
  await page.goto("/login");
  const tamanos = await page.locator("input, textarea, select").evaluateAll((campos) => campos.map((c) => parseFloat(getComputedStyle(c).fontSize)));
  expect(tamanos.length).toBeGreaterThan(0);
  for (const px of tamanos) expect(px).toBeGreaterThanOrEqual(16);
});
