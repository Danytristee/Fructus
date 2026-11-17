// En qué orden se le pide a cada proveedor de voz y cuándo se pasa al siguiente. Lógica pura: no llama a la red ni lee
// variables; recibe las claves y la función que pide.
//
// El orden es Claude (ADR-0024) → Groq con la clave principal → Groq con la de respaldo (otra cuenta, otro cupo gratuito) → Gemini.
// Si Claude falla, por lo que sea, se pasa a Groq: es otra empresa, así que siempre vale la pena probar.
// La de respaldo solo se prueba si la falla fue de la cuenta: sin cupo (429) o clave rechazada (401, 403). Si Groq no
// respondió, se cayó o devolvió algo que no sirve, la otra cuenta daría lo mismo y solo sumaría espera: se pasa a Gemini.

export type Cuenta = "principal" | "respaldo";

export type Intento = { modelo: string; cuenta?: Cuenta; error: string };

export type Pedido<T> = { ok: true; valor: T } | { ok: false; error: string; estado?: number };

export type Proveedor<T> = {
  servicio: "groq" | "gemini" | "anthropic";
  modelo: string;
  cuenta?: Cuenta;
  clave: string | undefined;
  pedir: (clave: string) => Promise<Pedido<T>>;
};

export type Resultado<T> = { ok: true; valor: T; modelo: string; intentos: Intento[] } | { ok: false; intentos: Intento[] };

/**
 * Las cuentas de Groq en el orden en que se prueban. La principal va siempre (sin clave queda anotada como «sin clave
 * configurada»); la de respaldo, solo si existe y no es la misma clave, que dos veces solo sumaría espera.
 */
export function cuentasGroq(principal: string | undefined, respaldo: string | undefined): { cuenta: Cuenta; clave: string | undefined }[] {
  const p = principal?.trim() || undefined;
  const r = respaldo?.trim() || undefined;
  return r && r !== p ? [{ cuenta: "principal", clave: p }, { cuenta: "respaldo", clave: r }] : [{ cuenta: "principal", clave: p }];
}

/** Si una cuenta de Groq falló con este estado HTTP, ¿sirve probar la otra? Solo cuando la falla es de la cuenta. */
export function otraCuentaAyuda(estado: number | undefined): boolean {
  return estado === 429 || estado === 401 || estado === 403;
}

/**
 * Pide a cada proveedor en orden hasta que uno responda. `avisar` recibe cada falla para el log (nunca la transcripción).
 * Una falla de Groq que no es de la cuenta salta las demás cuentas de Groq y va directo al siguiente servicio.
 */
export async function probarEnOrden<T>(proveedores: Proveedor<T>[], avisar: (intento: Intento) => void): Promise<Resultado<T>> {
  const intentos: Intento[] = [];
  let saltarGroq = false;
  for (const p of proveedores) {
    if (p.servicio === "groq" && saltarGroq) continue;
    if (!p.clave) {
      intentos.push({ modelo: p.modelo, cuenta: p.cuenta, error: "sin clave configurada" });
      continue;
    }
    const r = await p.pedir(p.clave);
    if (r.ok) return { ok: true, valor: r.valor, modelo: p.modelo, intentos };
    const intento: Intento = { modelo: p.modelo, cuenta: p.cuenta, error: r.error };
    avisar(intento);
    intentos.push(intento);
    if (p.servicio === "groq" && !otraCuentaAyuda(r.estado)) saltarGroq = true;
  }
  return { ok: false, intentos };
}
