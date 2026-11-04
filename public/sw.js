/* Cache only public artwork and bundles. Account pages and family API data never
   enter CacheStorage, so signing out cannot reveal another parent's HTML. */
const CACHE_PREFIX = 'fabelpad-static-';
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const CORE_ASSETS = ['/manifest.webmanifest','/brand/logo.webp','/brand/mascot.webp','/icons/icon-192.png','/icons/icon-512.png','/icons/apple-touch-icon.png','/icons/maskable-512.png','/art/station.webp','/art/dream.webp','/art/toy.webp','/art/weather.webp'];
function permittedPath(path) {
  return path === '/manifest.webmanifest' || /^\/(?:assets|art|brand|icons)\/[a-zA-Z0-9._/-]+$/.test(path);
}
function validAsset(response, path) {
  if (!response || response.status !== 200 || response.redirected || response.type === 'opaque') return false;
  const finalURL = new URL(response.url);
  if (finalURL.origin !== self.location.origin || finalURL.pathname !== path || !permittedPath(path)) return false;
  if (/\bno-store\b/i.test(response.headers.get('Cache-Control') || '')) return false;
  const mime = response.headers.get('Content-Type') || '';
  if (/text\/html/i.test(mime)) return false;
  if (/\.webmanifest$/.test(path)) return /(?:manifest\+json|application\/json)/i.test(mime);
  if (/\.(?:png|webp|jpg|jpeg|gif|svg|avif|ico)$/.test(path)) return /^image\//i.test(mime);
  if (/\.css$/.test(path)) return /text\/css/i.test(mime);
  if (/\.(?:js|mjs)$/.test(path)) return /(?:javascript|ecmascript)/i.test(mime);
  if (/\.(?:woff2?|ttf|otf)$/.test(path)) return /(?:font|octet-stream)/i.test(mime);
  return false;
}
async function preload(path, cache) {
  try { const response = await fetch(path, {cache:'reload',credentials:'same-origin'}); if (validAsset(response,path)) await cache.put(path,response.clone()); } catch { /* Decorative assets may be temporarily unavailable. */ }
}
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(CORE_ASSETS.map(path => preload(path,cache)));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  await Promise.all((await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
function offlinePage() {
  return new Response(`<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fabelpad — Even offline</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fcf9f0;color:#214e3d;font:600 17px/1.7 system-ui;text-align:center}main{max-width:360px;padding:30px}img{width:230px}h1{line-height:1.2}a{display:inline-block;background:#f9cd57;color:#214e3d;border-radius:15px;padding:12px 20px;text-decoration:none;margin-top:15px}</style><main><img src="/brand/logo.webp" alt="Fabelpad"><h1>Even een klein omweggetje.</h1><p>Je bent offline. Zodra er weer internet is, kun je veilig je ouderaccount en kindprofielen openen.</p><a href="/">Probeer opnieuw</a></main></html>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html')) {
    event.respondWith(fetch(request).catch(offlinePage)); return;
  }
  if (!permittedPath(url.pathname) || url.search) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try { const response = await fetch(request); if (validAsset(response,url.pathname)) await cache.put(request,response.clone()); return response; }
    catch { const cached = await cache.match(request) || await (await caches.open('fabelpad-downloads-v1')).match(request); if (cached) return cached; throw new TypeError('Dit Fabelpad-bestand is offline niet beschikbaar.'); }
  })());
});
