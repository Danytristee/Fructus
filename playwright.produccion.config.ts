import { readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// Las pruebas que solo se pueden hacer con la app COMPILADA (`next build` + `next start`): el service worker no se registra en desarrollo.
// Uso:  pnpm e2e:prod   (compila contra la base local y corre estas pruebas).
//
// Corren siempre contra la base LOCAL (.env.development.local), nunca contra el proyecto de Supabase de verdad: las pruebas inician sesión
// y escriben. Si el archivo falta o apunta a otro lado, esta configuración se niega a correr: no levanta el servidor y su globalSetup
// corta antes de la primera prueba. No se lanza el error al cargar el archivo: Knip lo lee (por `pnpm e2e:prod`) para saber cuáles son
// las pruebas, y en una copia limpia, como la del CI, se caía.
const archivoLocal = ".env.development.local";

function problemaDelEntorno(): string | null {
  let entorno = "";
  try {
    entorno = readFileSync(archivoLocal, "utf8");
  } catch {
    return `Falta ${archivoLocal} (la base local de Supabase). Las pruebas de producción no corren contra el proyecto de verdad.`;
  }
  const url = entorno.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim() ?? "";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    return `${archivoLocal} no apunta a la base local (NEXT_PUBLIC_SUPABASE_URL=${url.slice(0, 40)}…). Me niego a probar contra otra base.`;
  }
  return null;
}

const problema = problemaDelEntorno();
// El servidor compilado (`next start`) y las pruebas heredan este entorno: la base local, no la de .env.local.
if (problema === null) process.loadEnvFile(archivoLocal);
// Lo lee tests/e2e-produccion/negarse.ts para cortar la corrida con este mensaje.
else process.env.PRUEBAS_PRODUCCION_PROBLEMA = problema;

const puerto = process.env.PUERTO_PROD ?? "3400";
const inicio = `http://127.0.0.1:${puerto}`;

export default defineConfig({
  testDir: "tests/e2e-produccion",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: inicio,
    timezoneId: "America/Lima",
    trace: "retain-on-failure",
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    locale: "es-PE",
    viewport: { width: 412, height: 915 },
  },
  projects: [{ name: "s25-412-produccion" }],
  // Sin la base local no se levanta nada (el servidor tomaría .env.local, el proyecto de verdad) y se corta aquí.
  globalSetup: "./tests/e2e-produccion/negarse.ts",
  webServer: problema !== null ? undefined : {
    // Con el entorno cargado arriba: el mismo con el que se compiló (las claves públicas quedan escritas en el JavaScript al compilar).
    command: `pnpm exec next start -p ${puerto}`,
    url: `${inicio}/login`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
