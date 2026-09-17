// Service Worker für Wochenatelier: hält die App-Hülle offline bereit.
// Daten (Supabase) laufen immer über das Netz – nur eigene statische Dateien werden gecacht.
const VERSION = "wochenatelier-v1";
// Basis aus dem Scope ableiten, damit lokal ("/") und auf GitHub Pages ("/unterrichtsplanung-opfikon/") dasselbe Skript läuft.
const BASE = new URL(self.registration.scope).pathname;
const SHELL = [BASE, `${BASE}manifest.webmanifest`, `${BASE}icons/icon-192.png`, `${BASE}icons/icon-512.png`];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("wochenatelier-") && key !== VERSION) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "ACTIVATE_UPDATE") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (request.mode === "navigate") {
    // Netz zuerst, bei Ausfall die zuletzt gespeicherte Startseite.
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) (await caches.open(VERSION)).put(BASE, response.clone());
      return response;
    }).catch(async () => (await caches.match(BASE)) || Response.error()));
    return;
  }

  if (url.pathname.startsWith(`${BASE}_next/static/`) || SHELL.includes(url.pathname) || url.pathname.startsWith(`${BASE}icons/`)) {
    // Statische Dateien tragen einen Hash im Namen und dürfen aus dem Cache kommen.
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then(async (response) => {
      if (response.ok) (await caches.open(VERSION)).put(request, response.clone());
      return response;
    })));
  }
});
