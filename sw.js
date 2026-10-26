// Crochet Studio service worker: lets the app open and work with no internet.
// When you change any app file, bump this version so phones pick up the update.
const CACHE = 'crochet-studio-v24-3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/core.js',
  './js/native.js',
  './js/money.js',
  './js/ui.js',
  './js/nav.js',
  './js/storage.js',
  './js/photos.js',
  './js/xlsx.js',
  './js/home.js',
  './js/products.js',
  './js/materials.js',
  './js/stock.js',
  './js/patterns.js',
  './js/markets.js',
  './js/expenses.js',
  './js/receipts.js',
  './js/yearend.js',
  './js/reminders.js',
  './js/checkout.js',
  './js/reports.js',
  './js/report-files.js',
  './js/settings.js',
  './js/import.js',
  './js/sync.js',
  './js/account-screens.js',
  './js/start.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './lib/pdf.min.js',
  './lib/pdf.worker.min.js',
  './fonts/DancingScript.ttf',
  './guides/whats-new-24.pdf',
  './guides/tester-guide.pdf'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && !k.endsWith('-fonts')).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Serve from the cache straight away (fast, works offline), then refresh the
// cache in the background so the next launch gets any update.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Google Fonts: keep a copy so the app's fonts also work offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(CACHE + '-fonts').then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  const isPage = req.mode === 'navigate';
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = isPage
        ? (await cache.match('./index.html')) || (await cache.match('./'))
        : await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then(res => {
          if (res && res.ok) cache.put(isPage ? './index.html' : req, res.clone());
          return res;
        })
        .catch(() => cached);
      if (cached) {
        event.waitUntil(network.catch(() => {}));
        return cached;
      }
      return network;
    })
  );
});
