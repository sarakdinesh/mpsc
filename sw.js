/* गट-क सराव: offline service worker.
   App files: network first (so updates arrive), cache fallback when offline.
   Fonts: cache first after the first online visit. */
const CACHE = "gc2-v11";
const CORE = ["./", "./index.html", "./questions.js", "./current-affairs.js", "./ref.js", "./manifest.json", "./icon.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith("gc2-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const timeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))]);

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") c.put(req, res.clone());
      return res;
    }).catch(() => new Response("", { status: 504 })));
    return;
  }

  if (url.origin !== location.origin) return;

  const isPage = req.mode === "navigate";
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const res = await timeout(fetch(req, { cache: "no-cache" }), isPage ? 4000 : 8000);
      if (res.ok) c.put(isPage ? "./index.html" : req, res.clone());
      return res;
    } catch (err) {
      const hit = await c.match(isPage ? "./index.html" : req, { ignoreSearch: true });
      if (hit) return hit;
      if (isPage) { const p = await c.match("./"); if (p) return p; }
      throw err;
    }
  })());
});
