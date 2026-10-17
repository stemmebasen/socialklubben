// The app's offline memory. Pages are always fetched fresh when there is a connection; a copy of each
// page seen is kept, so it can still be opened offline. Pages that hold a visitor's position or saved
// events (no-store) are never kept, and nothing from the administration or the way on to organizers is.
const VERSION = "v1";
const SHELL = `shell-${VERSION}`, PAGES = `pages-${VERSION}`;
const SHELL_FILES = ["/app.js", "/explore.js", "/vendor/leaflet/leaflet.js", "/vendor/leaflet/leaflet.css", "/icons/icon-192.png"];
const MAX_PAGES = 40;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== PAGES).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const OFFLINE = `<!doctype html><html lang="da"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;font:17px/1.5 system-ui,sans-serif;background:#eef1f4;color:#16202e;text-align:center;padding:24px">
<div><h1 style="font-size:26px;margin:0 0 8px">Du er offline</h1><p style="margin:0;color:#5a6675">Sider, du har set før, kan stadig åbnes. Prøv igen, når du har forbindelse.</p></div></body></html>`;

async function keep(request, response) {
  const cache = await caches.open(PAGES);
  await cache.put(request, response);
  const keys = await cache.keys();
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_PAGES))) await cache.delete(old);
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/admin") || url.pathname.startsWith("/ud/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && !/no-store/.test(response.headers.get("cache-control") || "")) event.waitUntil(keep(request, response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || new Response(OFFLINE, { headers: { "content-type": "text/html; charset=utf-8" } })));
    return;
  }
  if (SHELL_FILES.includes(url.pathname)) {
    // The scripts: from memory at once, and refreshed behind the scenes.
    event.respondWith(caches.open(SHELL).then(async cache => {
      const cached = await cache.match(request);
      const fresh = fetch(request).then(response => { if (response.ok) cache.put(request, response.clone()); return response; });
      if (cached) { event.waitUntil(fresh.catch(() => undefined)); return cached; }
      return fresh;
    }));
  }
});
