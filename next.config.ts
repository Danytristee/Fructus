import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Playwright y el navegador de pruebas entran por 127.0.0.1, no por localhost.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
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
