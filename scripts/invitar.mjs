// Crea (o reactiva) la cuenta de una persona del puesto y deja su perfil con su rol.
// No manda correos: imprime un enlace de un solo uso para enviarlo por WhatsApp. La persona lo abre y elige su clave.
// Ninguna contraseña pasa por este comando ni por el chat.
//
// Uso (las claves salen de --env-file, nunca de la línea de comandos):
//   pnpm cuentas:invitar <correo> "<nombre>" <duenio|administrador|ayudante|contador>
// Necesita NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY y SITIO_URL (la dirección de la app, por ejemplo https://fructus.vercel.app).
import { createClient } from "@supabase/supabase-js";

const ROLES = ["duenio", "administrador", "ayudante", "contador"];
const [correo, nombre, rol] = process.argv.slice(2);

if (!correo?.includes("@") || !nombre || !ROLES.includes(rol)) {
  console.error(`Uso: pnpm cuentas:invitar <correo> "<nombre>" <${ROLES.join("|")}>`);
  process.exit(1);
}
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: secreta, SITIO_URL: sitio } = process.env;
if (!url || !secreta || !sitio) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY o SITIO_URL en el archivo de entorno.");
  process.exit(1);
}

const supabase = createClient(url, secreta, { auth: { autoRefreshToken: false, persistSession: false } });

// Si la cuenta no existe, «invite» la crea. Si ya existe (se reenvía), «recovery» da un enlace nuevo para elegir clave.
let { data, error } = await supabase.auth.admin.generateLink({ type: "invite", email: correo });
let tipo = "invite";
if (error?.code === "email_exists") {
  ({ data, error } = await supabase.auth.admin.generateLink({ type: "recovery", email: correo }));
  tipo = "recovery";
}
if (error || !data?.user) {
  console.error("No se pudo crear el enlace:", error?.code ?? error?.message ?? "sin usuario");
  process.exit(1);
}

const { error: errorPerfil } = await supabase
  .from("perfiles")
  .upsert({ id: data.user.id, nombre, rol, activo: true }, { onConflict: "id" });
if (errorPerfil) {
  console.error("La cuenta existe, pero no se pudo guardar su perfil:", errorPerfil.code);
  process.exit(1);
}

const enlace = new URL("/auth/confirmar", sitio);
enlace.searchParams.set("token_hash", data.properties.hashed_token);
enlace.searchParams.set("type", tipo);

console.log(`\nCuenta lista: ${nombre} (${rol}).`);
console.log("Mándale este enlace por WhatsApp. Sirve una sola vez y vence en 1 hora:\n");
console.log(enlace.toString());
console.log("");
