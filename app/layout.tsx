import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

// Una sola familia (ADR-0007). Manrope trae cifras tabulares para los montos.
const manrope = Manrope({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "Fructus",
  description: "Ventas, deudas y stock del puesto, por voz.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eef3f8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-PE" className={manrope.variable}>
      <body className="min-h-dvh text-base antialiased">{children}</body>
    </html>
  );
}
