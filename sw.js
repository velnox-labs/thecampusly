/* Campusly service worker (OPTIONAL). Keep it next to index.html to get offline support.
   Bump VERSION every time you deploy a new index.html so installed apps pick up the update. */
const VERSION = "campusly-v5";
const SHELL = ["./", "index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) { e.respondWith(appFile(req)); return; }
  // Firebase SDK files are versioned and never change: keep them so the app can start offline.
  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) e.respondWith(sdkFile(req));
  // Firestore, sign-in and everything else go straight to the network.
});

async function appFile(req) {                       // online: always the freshest file; offline: the saved copy
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? await cache.match("index.html") : null) || Response.error();
  }
}
async function sdkFile(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}
