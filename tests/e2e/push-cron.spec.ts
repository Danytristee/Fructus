import { expect, test } from "@playwright/test";

import { diaDeLima } from "../../lib/formato";
import { leerResumen } from "../../lib/hoy-reglas";
import { avisoDelDia } from "../../lib/push-reglas";
import { descifrar, telefonoDePrueba, type TelefonoDePrueba } from "../ayudas/push-de-prueba";
import { baseLocal, entornoLocal } from "./base";
import { CLAVE_PRUEBA, cuentas } from "./cuentas";
import { venderAlPaso } from "./dictar";

// El aviso del día de punta a punta, sin salir de esta máquina: la ruta del cron (con su secreto) lee el día de la base, busca los
// teléfonos que lo pidieron, cifra el aviso para cada uno y lo manda al servicio de avisos de mentira (tests/e2e/push-simulado.mjs).
// La prueba descifra lo que llegó con las claves de cada «teléfono» y anota en la base lo que pasó con cada uno.
// Corre una sola vez (a 412 px): no depende del ancho y varias corridas a la vez se pisarían los teléfonos.

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => test.skip(info.project.name !== "s25-412", "no depende del ancho de la pantalla"));

const base = baseLocal();
const SECRETO = entornoLocal().CRON_SECRET ?? "";
const SERVICIO_DE_AVISOS = `http://127.0.0.1:${Number(process.env.PUERTO ?? "3000") + 300}`;
const MARCA = `e2e-cron-${Date.now()}`;
const RUTA = "/api/cron/resumen-diario";
const conSecreto = { authorization: `Bearer ${SECRETO}` };

type Recibido = { endpoint: string; ttl?: string; topic?: string; urgency?: string; contentEncoding?: string; autorizacion?: string; cuerpo: string };
const recibidos = async (): Promise<Recibido[]> => ((await (await fetch(`${SERVICIO_DE_AVISOS}/recibidos`)).json()) as Recibido[]).filter((r) => r.endpoint.includes(MARCA));

const telefonos = {
  duenio: telefonoDePrueba(`https://fcm.googleapis.com/fcm/send/${MARCA}-duenio`),
  contador: telefonoDePrueba(`https://updates.push.services.mozilla.com/wpush/v2/${MARCA}-contador`),
  caducado: telefonoDePrueba(`https://fcm.googleapis.com/fcm/send/${MARCA}-gone`),
  fallando: telefonoDePrueba(`https://fcm.googleapis.com/fcm/send/${MARCA}-falla`),
  deCuentaInactiva: telefonoDePrueba(`https://fcm.googleapis.com/fcm/send/${MARCA}-inactiva`),
};

const guardar = async (usuarioId: string, t: TelefonoDePrueba) => {
  const { error } = await base.from("suscripciones_push").insert({ usuario_id: usuarioId, endpoint: t.destino.endpoint, clave_p256dh: t.destino.clave_p256dh, clave_auth: t.destino.clave_auth });
  if (error) throw error;
};
const estadoDe = async (t: TelefonoDePrueba) => (await base.from("suscripciones_push").select("activa, desactivada_en, ultimo_aviso_en, ultimo_error").eq("endpoint", t.destino.endpoint).single()).data!;

let usuarioInactivo: string;
let frutaPorSalir: number;

test.beforeAll(async () => {
  // Un día con ventas: si la base local está limpia, se registra una.
  const { data: dia } = await base.rpc("resumen_dia");
  const resumen = leerResumen(dia);
  if (resumen.numeroVentas === 0 && resumen.abonos === 0) await venderAlPaso(1);

  const { data } = await base.auth.admin.listUsers();
  const id = (correo: string) => data.users.find((u) => u.email === correo)!.id;
  // Una cuenta desactivada: sus teléfonos no reciben nada (la persona ya no tiene acceso al cierre).
  const { data: creado, error } = await base.auth.admin.createUser({ email: `${MARCA}@puesto.test`, password: CLAVE_PRUEBA, email_confirm: true });
  if (error) throw error;
  usuarioInactivo = creado.user.id;
  await base.from("perfiles").insert({ id: usuarioInactivo, nombre: "Cuenta desactivada de prueba", rol: "ayudante", activo: false });

  // Fruta que tiene que salir: una papaya que llegó hace 5 días (dura 5 a temperatura normal). La base no acepta fechas de hace más
  // de 48 horas al insertar: entra hoy y se mueve.
  const { data: papaya } = await base.from("productos").insert({ nombre: "Papaya", calibre: MARCA, unidad: "caja" }).select("id").single();
  frutaPorSalir = papaya!.id;
  const { data: cajas } = await base.from("movimientos_stock").insert({ producto_id: frutaPorSalir, tipo: "ajuste", cantidad: 4, motivo: "prueba e2e", registrado_por: id(cuentas.duenio) }).select("id").single();
  await base.from("movimientos_stock").update({ fecha: new Date(Date.now() - 5 * 86_400_000).toISOString() }).eq("id", cajas!.id);

  await guardar(id(cuentas.duenio), telefonos.duenio);
  await guardar(id(cuentas.contador), telefonos.contador);
  await guardar(id(cuentas.duenio), telefonos.caducado);
  await guardar(id(cuentas.ayudante), telefonos.fallando);
  await guardar(usuarioInactivo, telefonos.deCuentaInactiva);
  await fetch(`${SERVICIO_DE_AVISOS}/recibidos`, { method: "DELETE" });
});

test.afterAll(async () => {
  // Datos de prueba de la base local: se limpian para que la tabla no acumule teléfonos de mentira que el cron del día siguiente recorra.
  await base.from("suscripciones_push").delete().like("endpoint", `%${MARCA}%`);
  if (usuarioInactivo) await base.auth.admin.deleteUser(usuarioInactivo);
  // La fruta de prueba no se borra (CLAUDE.md): queda inactiva.
  if (frutaPorSalir) await base.from("productos").update({ activo: false }).eq("id", frutaPorSalir);
});

test("el cron no responde a quien no trae el secreto, ni a quien trae otro", async ({ request }) => {
  const sinNada = await request.get(RUTA);
  expect(sinNada.status()).toBe(401);
  expect(await sinNada.json()).toEqual({ error: "no-autorizado" }); // no dice por qué
  expect((await request.get(RUTA, { headers: { authorization: "Bearer otro-secreto-que-no-es-el-correcto" } })).status()).toBe(401);
  expect((await request.get(RUTA, { headers: { authorization: SECRETO } })).status(), "sin «Bearer» tampoco").toBe(401);
  expect((await request.post(RUTA, { headers: conSecreto })).status(), "solo GET: es lo que manda Vercel").toBe(405);
  expect(await recibidos(), "y no salió ningún aviso").toEqual([]);
});

test("con el secreto manda el resumen del día a cada teléfono que lo pidió: cifrado, con lo que dice la base, y anota cómo salió cada uno", async ({ request }) => {
  const hoy = diaDeLima(new Date());
  const antes = avisoDelDia(leerResumen((await base.rpc("resumen_dia")).data), hoy);
  const respuesta = await request.get(RUTA, { headers: conSecreto });
  const despues = avisoDelDia(leerResumen((await base.rpc("resumen_dia")).data), hoy);

  expect(respuesta.headers()["cache-control"]).toBe("no-store");
  const informe = (await respuesta.json()) as { fecha: string; motivo: string; destinatarios: number; enviados: number; caducadas: number; fallos: number };
  expect(respuesta.status(), JSON.stringify(informe)).toBe(200);
  expect(informe).toMatchObject({ fecha: hoy, motivo: "enviado" });
  expect(informe.enviados).toBeGreaterThanOrEqual(2); // el del dueño y el del contador (y los que hayan dejado otras pruebas)
  expect(informe.caducadas).toBeGreaterThanOrEqual(1);
  expect(informe.fallos).toBeGreaterThanOrEqual(1);

  // A quién llegó: los de personas con cierre y cuenta activa (incluidos los que luego fallan), no el de la cuenta desactivada.
  // Un teléfono puede recibir dos avisos (el resumen y el de frescura): se miran los teléfonos, no los avisos.
  const llegados = await recibidos();
  expect([...new Set(llegados.map((r) => r.endpoint))].sort()).toEqual(
    [telefonos.duenio, telefonos.contador, telefonos.caducado, telefonos.fallando].map((t) => t.destino.endpoint).sort(),
  );

  // Cómo salió: firmado por el servidor, vence en 6 horas, y el tema es del día (un aviso repetido reemplaza al anterior).
  const delDueno = llegados.find((r) => r.endpoint === telefonos.duenio.destino.endpoint && r.topic === `resumen-${hoy}`)!;
  expect(delDueno).toMatchObject({ ttl: "21600", topic: `resumen-${hoy}`, urgency: "normal", contentEncoding: "aes128gcm" });
  expect(delDueno.autorizacion).toMatch(/^vapid t=\S+, k=\S+$/);

  // Lo que descifra cada teléfono es el aviso del día con las cifras de la base (de antes o de después del cron, por si entró una venta).
  for (const t of [telefonos.duenio, telefonos.contador]) {
    const aviso = JSON.parse(descifrar(Buffer.from(llegados.find((r) => r.endpoint === t.destino.endpoint && r.topic === `resumen-${hoy}`)!.cuerpo, "base64"), t)) as unknown;
    expect([antes, despues]).toContainEqual(aviso);
    expect(aviso).toMatchObject({ url: "/cierre", tag: `resumen-${hoy}` });
  }

  // El aviso de frescura: después del resumen, con su propio tema (no lo reemplaza), dice cuántas cajas tienen que salir mañana
  // y abre Stock. La papaya de la prueba está entre ellas.
  for (const t of [telefonos.duenio, telefonos.contador]) {
    const deEse = llegados.filter((r) => r.endpoint === t.destino.endpoint);
    expect(deEse.map((r) => r.topic)).toEqual([`resumen-${hoy}`, `frescura-${hoy}`]);
    const frescura = JSON.parse(descifrar(Buffer.from(deEse[1]!.cuerpo, "base64"), t)) as { titulo: string; cuerpo: string };
    expect(frescura).toMatchObject({ url: "/stock", tag: `frescura-${hoy}` });
    expect(frescura.titulo).toMatch(/^Mañana tienen? que salir [\d.]+ cajas?$/);
  }
  // Al que ya falló o caducó con el primero no se le manda el segundo.
  for (const t of [telefonos.caducado, telefonos.fallando]) expect(llegados.filter((r) => r.endpoint === t.destino.endpoint)).toHaveLength(1);

  // Lo que quedó anotado en la base.
  expect(await estadoDe(telefonos.duenio)).toMatchObject({ activa: true, ultimo_error: null });
  expect((await estadoDe(telefonos.duenio)).ultimo_aviso_en).not.toBeNull();
  expect(await estadoDe(telefonos.caducado)).toMatchObject({ activa: false, ultimo_error: "caducada" }); // el servicio dijo 410: se desactiva, no se borra
  expect((await estadoDe(telefonos.caducado)).desactivada_en).not.toBeNull();
  expect(await estadoDe(telefonos.fallando)).toMatchObject({ activa: true, ultimo_error: "http-503", ultimo_aviso_en: null }); // falló esta vez: se reintenta mañana
  expect(await estadoDe(telefonos.deCuentaInactiva)).toMatchObject({ activa: true, ultimo_aviso_en: null }); // ni se tocó
});

test("si el cron corre dos veces, el teléfono ya caducado no se vuelve a avisar y el aviso repetido lleva el mismo tema (se ve uno)", async ({ request }) => {
  await fetch(`${SERVICIO_DE_AVISOS}/recibidos`, { method: "DELETE" });
  const respuesta = await request.get(RUTA, { headers: conSecreto });
  expect(respuesta.status()).toBe(200);
  const llegados = await recibidos();
  expect(llegados.map((r) => r.endpoint)).not.toContain(telefonos.caducado.destino.endpoint);
  const hoy = diaDeLima(new Date());
  expect(llegados.find((r) => r.endpoint === telefonos.duenio.destino.endpoint)?.topic).toBe(`resumen-${hoy}`);
});
