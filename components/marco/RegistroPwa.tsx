"use client";

import { useEffect } from "react";

import { escucharInstalacion } from "@/lib/pwa/instalacion";

// No dibuja nada: al cargar la página, deja al navegador avisar cuándo se puede instalar la app (se guarda para el menú «Más»).
export function RegistroPwa() {
  useEffect(() => {
    escucharInstalacion();
  }, []);
  return null;
}
