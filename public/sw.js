// Service worker de Fructus (ADR-0011). Hace UNA cosa: si no hay señal al abrir una pantalla, en vez de la página de error del navegador
// (el dinosaurio de Chrome, «No hay conexión a Internet» de Safari) se ve una página de la app que dice qué pasó y se reintenta sola.
//
// Lo que NO hace, a propósito:
//   - No guarda pantallas ni datos. Una venta, una deuda o el stock viejos mostrados como si fueran de hoy son peor que una página
//     que dice «sin señal» (principios 2 y 8). Cada pantalla se pide al servidor y trae lo que hay ahora.
//   - No toca los archivos de la app (_next/static): llevan el hash en el nombre y el navegador ya los guarda para siempre, así que un
//     segundo caché aquí solo gastaría espacio del teléfono.
//   - No intercepta nada que no sea abrir una pantalla: ni los envíos (POST), ni /api, ni lo de Supabase. Esos siguen directo a la red.
// Más adelante (fase 2) aquí van el último audio pendiente y las notificaciones (Web Push).
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
