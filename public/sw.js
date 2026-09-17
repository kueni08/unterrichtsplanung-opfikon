const CACHE = "wochenatelier-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))); });
self.addEventListener("activate", event => { event.waitUntil((async () => { for (const key of await caches.keys()) if (key.startsWith("wochenatelier-shell-") && key !== CACHE) await caches.delete(key); await self.clients.claim(); })()); });
self.addEventListener("message", event => { if (event.data === "ACTIVATE_UPDATE") self.skipWaiting(); });
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(async response => { if (response.ok) (await caches.open(CACHE)).put("/", response.clone()); return response; }).catch(async () => (await caches.match("/")) || Response.error()));
  } else if (url.pathname.startsWith("/assets/") || SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(async response => { if (response.ok) (await caches.open(CACHE)).put(event.request, response.clone()); return response; })));
  }
});
self.addEventListener("push", event => {
  // Never expose lesson notes or children identifiers on the lock screen.
  event.waitUntil(self.registration.showNotification("Wochenatelier: wichtige Änderung", { body: "Der gemeinsame Plan wurde aktualisiert. Bitte öffne die App.", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "plan-update", data: { url: "/" } }));
});
self.addEventListener("notificationclick", event => { event.notification.close(); event.waitUntil((async () => { const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true }); for (const client of windows) if (new URL(client.url).origin === self.location.origin) return client.focus(); return self.clients.openWindow("/"); })()); });
