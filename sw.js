/* Campusly service worker: makes the app installable and usable offline.
   Bump VERSION whenever you deploy new files so installed apps pick up the update. */
const VERSION = "campusly-v1";
const SHELL = ["./", "index.html", "auth.html", "attendance.html", "schedule.html", "tasks.html", "more.html", "offline.html",
  "campusly-firebase.js", "pwa.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/favicon-32.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL))); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) { e.respondWith(appFile(req, e)); return; }
  // The Firebase SDK files are versioned and never change, so keep them for offline start-up.
  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) e.respondWith(sdkFile(req));
  // Everything else (Firestore, sign-in, Google) goes straight to the network, never cached.
});

async function appFile(req, e) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req, { ignoreSearch: true });
  const fresh = fetch(req).then((res) => { if (res && res.ok && res.type === "basic") cache.put(req, res.clone()); return res; }).catch(() => null);
  if (cached) { e.waitUntil(fresh); return cached; }              // instant from cache, refreshed in the background
  const res = await fresh;
  if (res) return res;
  if (req.mode === "navigate") return (await cache.match("offline.html")) || Response.error();
  return Response.error();
}
async function sdkFile(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}
