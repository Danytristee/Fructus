import type { Page } from "@playwright/test";

/** Espera a que terminen las animaciones de entrada: durante ellas todo está a escala 0.985 y las medidas salen corridas. */
export async function quieto(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
  );
}

/** Cuánto se sale de la pantalla y qué controles miden menos de 48 px (CLAUDE.md, «Celular primero»). Mide con todo quieto. */
export async function medir(page: Page) {
  await quieto(page);
  return page.evaluate(() => ({
    desborde: document.documentElement.scrollWidth - innerWidth,
    chicos: [...document.querySelectorAll("button, a, input")]
      .filter((e) => !e.closest("nextjs-portal") && !e.getAttribute("aria-label")?.startsWith("Open Next.js"))
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.width < 48 || r.height < 48);
      })
      .map((e) => e.textContent?.trim()),
  }));
}
