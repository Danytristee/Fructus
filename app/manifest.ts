import type { MetadataRoute } from "next";

import { COLOR_DEL_TEMA } from "@/lib/pwa-reglas";

// La app instalable (PWA). El navegador pide este archivo sin cookies: proxy.ts lo deja pasar sin sesión, o el teléfono diría «no se puede instalar».
// Los íconos los dibuja scripts/generar-iconos.mjs. Los «maskable» van a sangre: Android los recorta con la forma de su pantalla de inicio.
const icono = (src: string, tam: number, purpose: "any" | "maskable") => ({ src, sizes: `${tam}x${tam}`, type: "image/png", purpose });

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Fructus",
    short_name: "Fructus",
    description: "Ventas, deudas y stock del puesto, por voz.",
    lang: "es-PE",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: COLOR_DEL_TEMA,
    theme_color: COLOR_DEL_TEMA,
    categories: ["business", "finance", "productivity"],
    icons: [
      icono("/icons/icon-192.png", 192, "any"),
      icono("/icons/icon-512.png", 512, "any"),
      icono("/icons/icon-maskable-192.png", 192, "maskable"),
      icono("/icons/icon-maskable-512.png", 512, "maskable"),
    ],
    // Mantener el dedo sobre el ícono abre estos atajos (Android). «Hoy» ya es la pantalla de inicio.
    shortcuts: [
      { name: "Clientes", description: "Quién te debe", url: "/clientes", icons: [icono("/icons/icon-192.png", 192, "any")] },
      { name: "Stock", description: "Cajas por fruta", url: "/stock", icons: [icono("/icons/icon-192.png", 192, "any")] },
      { name: "Ventas", description: "Lo que vendiste", url: "/ventas", icons: [icono("/icons/icon-192.png", 192, "any")] },
    ],
  };
}
