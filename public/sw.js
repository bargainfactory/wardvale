// FlowForge AI service worker — NETWORK-FIRST for same-origin GETs, with an
// offline cache fallback.
//
// Why not stale-while-revalidate: serving a cached JS chunk or HTML document
// that no longer matches a freshly-deployed page breaks hydration (the client
// bundle mismatches the served HTML). Network-first keeps HTML and its chunks in
// lockstep — the cache is consulted only when the network is unavailable.
//
// The CACHE version bump makes `activate` purge any older (stale-while-revalidate)
// cache so returning clients self-heal on their next navigation.
const CACHE = "ff-cache-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin
  if (url.pathname.startsWith("/api/")) return; // never cache API responses

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req)) // offline fallback only
  );
});
