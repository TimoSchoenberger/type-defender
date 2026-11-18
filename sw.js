/* Offline support. Online, every request goes to the network so a new release shows up on the next load;
   the cache is only the fallback. Any edit to this file makes browsers install it again and refill the cache. */
const CACHE = 'type-defender-v1';
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'css/app.css', 'css/menu.css', 'fonts/fonts.css',
  'js/engine.js', 'js/music.js', 'js/s-neon-pixel.js', 'js/s-doodle-paper.js', 'js/s-comic-sea.js',
  'js/keys.js', 'js/db.js', 'js/menu.js', 'js/app.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const css = await (await fetch('fonts/fonts.css')).text();
    const fonts = [...css.matchAll(/url\(([^)]+\.woff2)\)/g)].map(m => 'fonts/' + m[1]);
    await cache.addAll([...FILES, ...fonts]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      return (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' && await cache.match('index.html')) || Response.error();
    }
  })());
});
