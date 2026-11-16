// Service Worker：让行程页在国外没网/弱网时也能打开。
//  - 页面本体与 Leaflet：先用缓存，后台静默更新（下次打开即为新版）。
//  - 地图瓦片：缓存优先，访问过或"离线准备"过的区域断网也能看。
const SHELL = 'trip-shell-v1';
const TILES = 'trip-tiles-v1';
const MAX_TILES = 2500;
const ASSETS = [
  './', 'index.html', 'style.css', 'data.js', 'trip.js', 'app.js', 'manifest.webmanifest',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'vendor/leaflet/images/layers.png', 'vendor/leaflet/images/layers-2x.png',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('trip-shell-') && k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'tile.openstreetmap.org') return e.respondWith(tile(req));
  if (url.origin === location.origin) e.respondWith(shell(req));
});

async function shell(req) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req, { ignoreSearch: true });
  const refresh = fetch(req, { cache: 'no-cache' }).then(res => {
    if (res.ok) cache.put(req.url.split('#')[0].split('?')[0], res.clone());
    return res;
  });
  if (hit) {
    refresh.catch(() => {});
    return hit;
  }
  try {
    return await refresh;
  } catch {
    if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    return Response.error();
  }
}

async function tile(req) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(req.url, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    await cache.put(req.url, res.clone());
    if (Math.random() < 0.02) trimTiles(cache);
  }
  return res;
}

async function trimTiles(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await cache.delete(keys[i]);
}
