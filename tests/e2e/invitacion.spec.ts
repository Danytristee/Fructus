import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

// Corre el comando real (scripts/invitar.mjs) contra la base local y devuelve el enlace que imprime.
function invitar(correo: string, nombre: string, rol: string) {
  const entorno = Object.fromEntries(
    readFileSync(".env.development.local", "utf8")
      .split("\n")
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  const salida = execFileSync("node", ["scripts/invitar.mjs", correo, nombre, rol], {
    env: { ...process.env, ...entorno, SITIO_URL: "http://127.0.0.1:3000" },
    encoding: "utf8",
  });
  const enlace = salida.match(/http\S+\/auth\/confirmar\S+/)?.[0];
  if (!enlace) throw new Error("El comando no imprimió el enlace");
  return enlace;
}

test("una persona invitada abre su enlace, elige su clave y entra con su rol", async ({ page }, info) => {
  const correo = `invitada-${Date.now()}-${info.project.name}@puesto.test`;
  const enlace = invitar(correo, "Rosa del puesto", "ayudante");

  await page.goto(enlace);
  await expect(page).toHaveURL("/login/clave");
  await page.waitForLoadState("networkidle");

  // Una clave corta se rechaza con su razón.
  await page.getByLabel("Tu clave nueva").fill("corta");
  await page.getByRole("button", { name: "Guardar y entrar" }).click();
  await expect(page.getByText("Usa 8 letras o números como mínimo.")).toBeVisible();

  await page.getByLabel("Tu clave nueva").fill("mango-kent-2026");
  await page.getByRole("button", { name: "Guardar y entrar" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });

  await page.getByRole("button", { name: /^Menú/ }).click();
  const menu = page.getByRole("dialog", { name: "Más" });
  await expect(menu.getByText("Entraste como")).toHaveText("Entraste como Rosa del puesto (Ayudante)");
  await expect(menu.getByRole("link", { name: "Ajustes" })).toHaveCount(0);
  await menu.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL("/login");

  // Con la clave que eligió, entra.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Clave", { exact: true }).fill("mango-kent-2026");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });

  // El enlace sirve una sola vez.
  await page.context().clearCookies();
  await page.goto(enlace);
  await expect(page).toHaveURL("/login?enlace=vencido");
  await expect(page.getByText("Ese enlace ya no sirve")).toBeVisible();
});

test("un enlace inventado no abre nada", async ({ page }) => {
  await page.goto("/auth/confirmar?token_hash=inventado&type=invite");
  await expect(page).toHaveURL("/login?enlace=vencido");
  await page.goto("/login/clave");
  await expect(page).toHaveURL("/login?enlace=vencido");
});
