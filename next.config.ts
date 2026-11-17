import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Playwright y el navegador de pruebas entran por 127.0.0.1, no por localhost.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // Al arrancar, Next consulta los avisos de seguridad de npm. Si la versión instalada tiene uno, `pnpm dev` pinta una píldora sobre la
    // barra de abajo que se roba los toques, y si lo corre un agente, se cierra. Un aviso nuevo rompía así las e2e sin que cambiara el código
    // (16-11). Por eso, solo en el servidor que levantan las e2e (`PRUEBAS_E2E=1`, en playwright.config.ts), no se consulta.
    // En todo lo demás el aviso sigue: `next build` y `pnpm dev` lo muestran.
    agentUpgrade: process.env.PRUEBAS_E2E === "1" ? false : "security",
  },
  async headers() {
    // Las ilustraciones y los íconos no llevan el hash en el nombre: una semana en el teléfono (y un día más mientras se revalida) evita
    // preguntarle al servidor por ellos en cada pantalla. Si alguno cambia, se ve en una semana a lo más.
    const unaSemana = "public, max-age=604800, stale-while-revalidate=86400";
    return [
      { source: "/frutas/:archivo", headers: [{ key: "Cache-Control", value: unaSemana }] },
      { source: "/icons/:archivo", headers: [{ key: "Cache-Control", value: unaSemana }] },
      {
        // El service worker nunca se guarda en el caché del navegador: cada vez que se abre la app se compara con el del servidor, y si cambió,
        // el teléfono baja el nuevo. Con el caché normal, una versión rota se quedaba en los teléfonos hasta 24 horas.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
