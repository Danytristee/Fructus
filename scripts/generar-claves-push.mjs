// Genera las claves del aviso del día (Web Push): el par VAPID del servidor y el secreto con el que Vercel llama al cron.
//
//   node scripts/generar-claves-push.mjs                          → las imprime para copiarlas a .env.local y a las variables de Vercel
//   node scripts/generar-claves-push.mjs --archivo .env.local     → las agrega a ese archivo, sin imprimir los valores
//   node scripts/generar-claves-push.mjs --asunto mailto:yo@correo.pe   → con el contacto que va en VAPID_SUBJECT
//
// Las claves no se pegan en un chat ni se versionan (CLAUDE.md, «Seguridad y claves»): solo en .env.local (fuera de git), en las variables
// de Vercel y, si hace falta, en los secrets de GitHub. Si el archivo ya tiene una de estas variables, no se toca.
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";

import webpush from "web-push";

const argumento = (nombre) => {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const archivo = argumento("--archivo");
const asunto = argumento("--asunto");

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
const nuevas = {
  VAPID_PUBLIC_KEY: publicKey,
  VAPID_PRIVATE_KEY: privateKey,
  // Un correo (mailto:) o la dirección https de la app: el servicio de avisos lo pide. Apple rechaza los que no son ninguno de los dos.
  VAPID_SUBJECT: asunto ?? (archivo ? "mailto:dev@fructus.test" : ""),
  CRON_SECRET: randomBytes(32).toString("base64url"),
};

if (!archivo) {
  console.log("# Pégalas en .env.local (fuera de git) y en las variables de Vercel. No las pegues en un chat.");
  console.log("# En VAPID_SUBJECT pon un correo (mailto:tu@correo.pe) o la dirección https de la app.");
  for (const [nombre, valor] of Object.entries(nuevas)) console.log(`${nombre}=${valor}`);
  process.exit(0);
}

const actual = existsSync(archivo) ? readFileSync(archivo, "utf8") : "";
const yaEstan = Object.keys(nuevas).filter((nombre) => new RegExp(`^${nombre}=`, "m").test(actual));
const aAgregar = Object.entries(nuevas).filter(([nombre]) => !yaEstan.includes(nombre));
if (aAgregar.length > 0) {
  const sinSalto = actual.length > 0 && !actual.endsWith("\n");
  appendFileSync(archivo, `${sinSalto ? "\n" : ""}${aAgregar.map(([nombre, valor]) => `${nombre}=${valor}`).join("\n")}\n`);
}
console.log(`${archivo}: agregadas ${aAgregar.map(([n]) => n).join(", ") || "ninguna"}${yaEstan.length ? `; ya estaban ${yaEstan.join(", ")}` : ""}.`);
