const CACHE_NAME = "turnosmed-pwa-v1";

const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  /*
    Seguridad:
    No cacheamos backend, API, usuarios, pacientes, turnos, solicitudes,
    cuentas de cobro ni ningún dato sensible.
    Solo se permite cachear archivos del frontend servidos desde el mismo dominio.
  */
  if (url.origin !== self.location.origin) return;

  /*
    Navegación principal:
    Primero intenta cargar desde internet.
    Si no hay conexión, intenta mostrar la app base cacheada.
  */
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }

  /*
    Archivos estáticos del frontend:
    assets generados por Vite, íconos y manifest.
  */
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (!response || response.status !== 200) return response;

          const copy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });

          return response;
        });
      })
    );
  }
});
