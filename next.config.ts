import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Playwright y el navegador de pruebas entran por 127.0.0.1, no por localhost.
  allowedDevOrigins: ["127.0.0.1"],
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
