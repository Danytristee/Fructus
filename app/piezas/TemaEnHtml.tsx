"use client";

import { useEffect } from "react";

// La hoja se monta en <body> (portal de Radix): el tema tiene que estar en <html> para que la alcance.
export function TemaEnHtml({ tema }: { tema: "claro" | "oscuro" }) {
  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [tema]);
  return null;
}
