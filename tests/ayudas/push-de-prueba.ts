import { createDecipheriv, createECDH, hkdfSync, randomBytes } from "node:crypto";

// Un teléfono de mentira para probar el aviso del día: tiene las claves que da un navegador (curva P-256 y un secreto de autenticación)
// y sabe descifrar lo que el servidor le manda (RFC 8291 y RFC 8188). Lo usan las pruebas de Vitest y las de Playwright.

export type TelefonoDePrueba = ReturnType<typeof telefonoDePrueba>;

export function telefonoDePrueba(endpoint = "https://fcm.googleapis.com/fcm/send/dXNlcjpwcnVlYmE") {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = randomBytes(16);
  return {
    ecdh,
    auth,
    /** Lo que guarda la base de este teléfono. */
    destino: { endpoint, clave_p256dh: ecdh.getPublicKey().toString("base64url"), clave_auth: auth.toString("base64url") },
    /** La suscripción tal como la da `PushSubscription.toJSON()`. */
    suscripcion: { endpoint, keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: auth.toString("base64url") } },
  };
}

/** Lo que haría el navegador al recibir el aviso: lo descifra con las claves del teléfono y devuelve el texto. */
export function descifrar(cuerpo: Uint8Array, t: TelefonoDePrueba): string {
  const c = Buffer.from(cuerpo);
  const sal = c.subarray(0, 16);
  const largoDeLaClaveDelEmisor = c[20]!;
  const claveDelEmisor = c.subarray(21, 21 + largoDeLaClaveDelEmisor);
  const cifrado = c.subarray(21 + largoDeLaClaveDelEmisor);
  const secreto = t.ecdh.computeSecret(claveDelEmisor);
  const info = Buffer.concat([Buffer.from("WebPush: info\0"), t.ecdh.getPublicKey(), claveDelEmisor]);
  const ikm = Buffer.from(hkdfSync("sha256", secreto, t.auth, info, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, sal, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, sal, Buffer.from("Content-Encoding: nonce\0"), 12));
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(cifrado.subarray(cifrado.length - 16));
  const plano = Buffer.concat([decipher.update(cifrado.subarray(0, cifrado.length - 16)), decipher.final()]);
  let fin = plano.length - 1;
  while (plano[fin] === 0) fin--; // el relleno de ceros
  if (plano[fin] !== 2) throw new Error("el último bloque del aviso no termina en 0x02");
  return plano.subarray(0, fin).toString("utf8");
}
