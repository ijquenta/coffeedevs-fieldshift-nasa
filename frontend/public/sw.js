/* Yapana Agro offline shell. Live analysis and geocoding are never cached. */
const SHELL_CACHE = "yapana-shell-v1";
const STATIC_CACHE = "yapana-static-v1";
const SHELL_URLS = ["/offline.html", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png"];
const STATIC_PREFIXES = ["/_next/static/", "/cesium/"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("yapana-") && ![SHELL_CACHE, STATIC_CACHE].includes(key)).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) void caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match("/offline.html"))));
    return;
  }

  if (STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request).then((response) => {
        if (response.ok && response.type === "basic") void cache.put(request, response.clone());
        return response;
      }).catch(() => cached || Response.error());
      return cached || network;
    }));
  }
});
