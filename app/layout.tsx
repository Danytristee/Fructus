import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fructus",
  description: "Ventas, deudas y stock del puesto, por voz.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-PE">
      <body className="min-h-dvh text-[17px] antialiased">{children}</body>
    </html>
  );
}
