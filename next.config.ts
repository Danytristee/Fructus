import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Playwright y el navegador de pruebas entran por 127.0.0.1, no por localhost.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
