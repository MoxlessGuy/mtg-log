/* MTG Match Log: keeps the app usable offline. Bump VERSION whenever a file changes. */
const VERSION = 'mtglog-v5';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* The page: try the network for updates, but fall back to the saved copy after 3 s or when offline. */
function page(req) {
  return new Promise(resolve => {
    let done = false;
    const fromCache = () => caches.match('index.html').then(r => r || caches.match('./'));
    const finish = r => { if (!done && r) { done = true; resolve(r); } };
    const timer = setTimeout(() => fromCache().then(finish), 3000);
    fetch(req).then(r => {
      clearTimeout(timer);
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put('index.html', copy)); }
      finish(r);
    }).catch(() => {
      clearTimeout(timer);
      fromCache().then(r => finish(r || Response.error()));
    });
  });
}

/* Icons, manifest and fonts: saved copy first, network only the first time. */
function asset(req) {
  return caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return r;
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && url.origin === self.location.origin) { e.respondWith(page(req)); return; }
  if (url.origin === self.location.origin || FONT_HOSTS.includes(url.hostname)) e.respondWith(asset(req));
});
