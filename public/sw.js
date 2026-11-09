// Service worker de Fructus (ADR-0011). Hace UNA cosa: si no hay señal al abrir una pantalla, en vez de la página de error del navegador
// (el dinosaurio de Chrome, «No hay conexión a Internet» de Safari) se ve una página de la app que dice qué pasó y se reintenta sola.
//
// Lo que NO hace, a propósito:
//   - No guarda pantallas ni datos. Una venta, una deuda o el stock viejos mostrados como si fueran de hoy son peor que una página
//     que dice «sin señal» (principios 2 y 8). Cada pantalla se pide al servidor y trae lo que hay ahora.
//   - No toca los archivos de la app (_next/static): llevan el hash en el nombre y el navegador ya los guarda para siempre, así que un
//     segundo caché aquí solo gastaría espacio del teléfono.
//   - No intercepta nada que no sea abrir una pantalla: ni los envíos (POST), ni /api, ni lo de Supabase. Esos siguen directo a la red.
// Lo que sí hace además (ADR-0013): recibe el aviso del día (Web Push) y lo muestra; al tocarlo, abre el cierre del día. Más adelante
// (fase 2) aquí va también el último audio pendiente.
//
// Al cambiar este archivo, el teléfono baja el nuevo solo (no-cache en next.config.ts) y pasa a usarlo sin pedir nada. Si hay que
// cambiar la página sin conexión, se sube VERSION: la vieja se borra al activarse.

const VERSION = "v1";
const CACHE = `fructus-${VERSION}`;
const PAGINA_SIN_CONEXION = "/sin-conexion.html";
const PRECARGA = [PAGINA_SIN_CONEXION, "/icons/icon-192.png"];
// Una conexión que no responde en 12 s es, para quien está de pie en el mercado, una conexión caída.
const ESPERA_MAXIMA_MS = 12_000;

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECARGA)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      // Con «precarga de navegación» el teléfono empieza a pedir la pantalla mientras despierta este archivo: no se pierde ese tiempo.
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      for (const nombre of await caches.keys()) {
        if (nombre.startsWith("fructus-") && nombre !== CACHE) await caches.delete(nombre);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  evento.respondWith(responderNavegacion(evento));
});

async function responderNavegacion(evento) {
  try {
    const pedida = Promise.resolve(evento.preloadResponse).then((precargada) => precargada ?? fetch(evento.request));
    const sinRespuesta = new Promise((_, rechazar) => setTimeout(() => rechazar(new Error("sin respuesta")), ESPERA_MAXIMA_MS));
    return await Promise.race([pedida, sinRespuesta]);
  } catch (error) {
    console.warn("sw: la pantalla no respondió", { ruta: new URL(evento.request.url).pathname, motivo: error instanceof Error ? error.message : "desconocido" });
    const guardada = await caches.match(PAGINA_SIN_CONEXION);
    return guardada ?? Response.error();
  }
}

// -----------------------------------------------------------------------------------------------------------------------------------
// El aviso del día (Web Push, ADR-0013)
// -----------------------------------------------------------------------------------------------------------------------------------
// El servidor manda { titulo, cuerpo, url, tag } cifrado (lib/push-reglas.ts: «Aviso»). Chrome exige que cada aviso recibido muestre
// algo: si el contenido no llega o no se entiende, se muestra el aviso genérico en vez de dejar que el navegador ponga el suyo.
// La prueba lib/push/sw.test.ts corre este archivo con un navegador de mentira.

const AVISO_GENERICO = { titulo: "Tu día en Fructus", cuerpo: "Toca para ver cómo va el cierre del día.", url: "/cierre", tag: "resumen" };

// El toque solo puede llevar a una pantalla de la app: una ruta («/cierre»), nunca otra dirección («https://…» ni «//…»).
function rutaDeLaApp(url) {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") && !url.includes("\\") ? url : AVISO_GENERICO.url;
}

function leerAviso(evento) {
  try {
    const datos = evento.data ? evento.data.json() : null;
    if (datos && typeof datos.titulo === "string" && typeof datos.cuerpo === "string") {
      return {
        titulo: datos.titulo.slice(0, 120),
        cuerpo: datos.cuerpo.slice(0, 240),
        url: rutaDeLaApp(datos.url),
        tag: typeof datos.tag === "string" ? datos.tag.slice(0, 64) : AVISO_GENERICO.tag,
      };
    }
  } catch (error) {
    console.warn("sw: el aviso no se pudo leer", { motivo: error instanceof Error ? error.name : "desconocido" });
  }
  return AVISO_GENERICO;
}

self.addEventListener("push", (evento) => {
  const aviso = leerAviso(evento);
  evento.waitUntil(
    self.registration.showNotification(aviso.titulo, {
      body: aviso.cuerpo,
      icon: "/icons/icon-192.png",
      lang: "es-PE",
      // Un aviso nuevo con la misma etiqueta reemplaza al anterior en vez de apilarse.
      tag: aviso.tag,
      data: { url: aviso.url },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = new URL(rutaDeLaApp(evento.notification.data && evento.notification.data.url), self.location.origin).href;
  evento.waitUntil(abrirLaApp(destino));
});

// Si la app ya está abierta, se lleva esa ventana al destino; si no, se abre una.
async function abrirLaApp(destino) {
  const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin);
  if (abierta) {
    try {
      await abierta.focus();
      await abierta.navigate(destino);
      return;
    } catch (error) {
      // Una ventana que este service worker no controla no se deja navegar: se abre una nueva.
      console.warn("sw: no se pudo llevar la ventana abierta al aviso", { motivo: error instanceof Error ? error.name : "desconocido" });
    }
  }
  await self.clients.openWindow(destino);
}
