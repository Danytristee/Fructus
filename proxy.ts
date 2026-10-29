import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { entornoSupabase } from "@/lib/supabase/entorno";
import { fetchWithTimeout } from "@/lib/supabase/fetch-con-tope";

// Se abren sin sesión. /auth canjea los enlaces de invitación. /piezas es solo de desarrollo (en producción da 404).
const RUTAS_PUBLICAS = ["/login", "/auth", "/piezas"];

const esPublica = (ruta: string) => RUTAS_PUBLICAS.some((p) => ruta === p || ruta.startsWith(`${p}/`));

// Renueva la sesión en cada navegación (las cookies que un Server Component no puede escribir)
// y manda a /login a quien no tiene sesión. La guarda de verdad está en el servidor de cada
// pantalla y en la RLS; esto solo evita mostrar una pantalla vacía.
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });
  const { url, clave } = entornoSupabase();
  const supabase = createServerClient(url, clave, {
    global: { fetch: fetchWithTimeout },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesNuevas) {
        for (const { name, value } of cookiesNuevas) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of cookiesNuevas) respuesta.cookies.set(name, value, options);
      },
    },
  });

  // getClaims valida el token y, si venció, lo renueva con el de refresco.
  const { data, error } = await supabase.auth.getClaims();
  const ruta = request.nextUrl.pathname;

  if (error) {
    // Supabase no respondió: no se saca a nadie de su sesión por una caída de red.
    // La pantalla decide qué mostrar (principio 8).
    console.error("proxy: no se pudo validar la sesión", { ruta, codigo: error.name });
    return respuesta;
  }

  // Las rutas /api contestan 401 ellas mismas: una API no redirige a una pantalla de login.
  if (ruta.startsWith("/api/")) return respuesta;
  // Las server actions también: cada una revisa la sesión y responde en lenguaje de puesto. Redirigidas, llegaban al
  // celular como una falla de red y la tarjeta decía «Revisa tu señal» con la sesión vencida (/chaos 2026-10-29).
  if (request.method === "POST" && request.headers.has("next-action")) return respuesta;

  const conSesion = Boolean(data?.claims);
  const destino = !conSesion && !esPublica(ruta) ? "/login" : conSesion && ruta === "/login" ? "/" : null; // /login/clave sí se abre con sesión
  if (!destino) return respuesta;

  const redireccion = NextResponse.redirect(new URL(destino, request.url));
  for (const cookie of respuesta.cookies.getAll()) redireccion.cookies.set(cookie);
  return redireccion;
}

export const config = {
  // Todo menos los archivos estáticos: sin esto, el login bloquearía el CSS, el JS y la fruta.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|frutas/|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
