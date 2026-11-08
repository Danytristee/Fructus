import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { RegistroPwa } from "@/components/marco/RegistroPwa";
import { COLOR_DE_FONDO } from "@/lib/pwa-reglas";
import "./globals.css";

// Una sola familia (ADR-0007). Manrope trae cifras tabulares para los montos.
const manrope = Manrope({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "Fructus",
  description: "Ventas, deudas y stock del puesto, por voz.",
  applicationName: "Fructus",
  // Al abrirla desde el ícono se ve como app, sin la barra del navegador: Next lo escribe como `mobile-web-app-capable` (la etiqueta de Apple
  // quedó en desuso; desde iOS 16.4 Safari también lee `display: standalone` del manifest).
  appleWebApp: { capable: true, title: "Fructus", statusBarStyle: "default" },
  // El teléfono no convierte números, correos ni direcciones del texto en enlaces: los montos y los RUC no son teléfonos.
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: COLOR_DE_FONDO,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-PE" className={manrope.variable}>
      <body className="min-h-dvh text-base antialiased">
        <RegistroPwa />
        {children}
      </body>
    </html>
  );
}
