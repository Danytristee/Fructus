// Las dos variables públicas de Supabase. Si falta una, se dice cuál: un
// `undefined` silencioso termina en un error de red difícil de leer.
export function entornoSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ver .env.example)",
    );
  }
  return { url, clave };
}
